import { fail } from './errors.mjs';

/**
 * Bounded process-local LRU for conditional resource reads. Every access calls
 * the server; TTL controls retention only, never permission freshness. Document
 * data is neither persisted to disk nor served as an offline fallback.
 */
export class ConditionalReadCache {
  constructor({
    maxBytes = 8 * 1024 * 1024,
    maxEntries = 64,
    maxAgeMs = 900000,
    now = Date.now,
  } = {}) {
    for (const value of [maxBytes, maxEntries, maxAgeMs]) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError('Read cache limits must be positive integers.');
      }
    }
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    this.maxAgeMs = maxAgeMs;
    this.now = now;
    this.entries = new Map();
    this.pending = new Map();
    this.bytes = 0;
    this.generation = 0;
  }

  clear() {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
    this.bytes = 0;
  }

  remove(key) {
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.bytes;
      this.entries.delete(key);
    }
  }

  async read(key, load) {
    const existing = this.pending.get(key);
    if (existing) {
      return structuredClone(await existing);
    }
    const generation = this.generation;
    for (const [entryKey, entry] of this.entries) {
      if (this.now() - entry.at >= this.maxAgeMs) {
        this.remove(entryKey);
      }
    }
    const cached = this.entries.get(key);
    const pending = (async () => {
      const received = await load(cached?.value.etag);
      if (generation !== this.generation) {
        fail('read_context_changed', 'The read context changed while this request was running.', {
          retryable: true,
          remediation: 'Read again in the currently selected account and profile.',
        });
      }
      if (!received || typeof received !== 'object' || Array.isArray(received)) {
        fail('invalid_response', 'The resource response was invalid.');
      }
      let value = received;
      if (received?.notModified === true) {
        if (
          !cached ||
          received.etag !== cached.value.etag ||
          received.scope !== cached.value.scope ||
          received.collection !== cached.value.collection ||
          received.epoch !== cached.value.epoch ||
          received.checkpoint !== cached.value.checkpoint ||
          !Array.isArray(received.items) ||
          received.items.length !== 0
        ) {
          fail('invalid_response', 'A conditional response did not match the cached resource.');
        }
        value = cached.value;
      }
      this.remove(key);
      const size = Buffer.byteLength(JSON.stringify(value));
      if (typeof value?.etag === 'string' && value.etag.length <= 8192 && size <= this.maxBytes) {
        this.entries.set(key, { value: structuredClone(value), bytes: size, at: this.now() });
        this.bytes += size;
        while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
          this.remove(this.entries.keys().next().value);
        }
      }
      return value;
    })();
    this.pending.set(key, pending);
    try {
      return structuredClone(await pending);
    } catch (error) {
      // A permission, authentication, network or schema failure can never turn
      // into stale private success, or let another in-flight read refill it.
      if (generation === this.generation) {
        this.clear();
      }
      throw error;
    } finally {
      if (this.pending.get(key) === pending) {
        this.pending.delete(key);
      }
    }
  }
}
