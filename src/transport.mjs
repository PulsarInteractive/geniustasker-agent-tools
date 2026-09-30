import { AgentError, fail } from './errors.mjs';
import catalog from './command-catalog.mjs';

export const ORIGINS = Object.freeze({
  production: 'https://api-geniustasker.pulsarinteractive.cloud',
  development: 'https://dev-api-geniustasker.pulsarinteractive.cloud',
});
export const CLIENT_ID = 'geniustasker-cli';
/** Resolve an approved API origin; loopback is available only by explicit opt-in. */
export function originOf(value = ORIGINS.production, allowLocal = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('invalid_origin', 'An absolute API origin is required.');
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !(
      Object.values(ORIGINS).includes(url.origin) ||
      (allowLocal && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))
    )
  ) {
    fail(
      'invalid_origin',
      'Use a GeniusTasker API origin or an explicit loopback origin with --allow-local.',
    );
  }
  return url.origin;
}

const identifier = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : undefined;
const boundedText = (value) =>
  typeof value === 'string' &&
  value.length <= 500 &&
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
  !/[\u0000-\u001f\u007f]/u.test(value) &&
  !/gta1\.|wd[ar]_|sk-proj-/u.test(value)
    ? value
    : undefined;
/**
 * Bounded HTTP transport for delegated endpoints, with no implicit retries.
 * Call originOf before construction; inject fetch/signal for controlled tests
 * and operation-level cancellation. Error serialization excludes raw responses.
 */
export class Transport {
  constructor(origin, { fetchImpl = fetch, timeoutMs = 15000, signal } = {}) {
    this.origin = origin;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.signal = signal;
  }
  async request(path, { method = 'GET', form, json, token, query, bytes, binary = false } = {}) {
    if (
      !(path.startsWith('/api/agents/') || path === '/.well-known/oauth-authorization-server') ||
      path.startsWith('//')
    ) {
      fail('invalid_arguments', 'Only delegated endpoints are available.');
    }
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      !(
        url.pathname.startsWith('/api/agents/') ||
        url.pathname === '/.well-known/oauth-authorization-server'
      )
    ) {
      fail('invalid_origin', 'Cross-origin or non-delegated requests are refused.');
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    if (
      (bytes !== undefined || binary) &&
      (url.pathname !== '/api/agents/v1/media/content' ||
        (bytes !== undefined && (!Buffer.isBuffer(bytes) || bytes.length > 15000000)) ||
        (bytes !== undefined && (json !== undefined || form)))
    ) {
      fail('invalid_arguments', 'Binary transfer requires the bounded delegated media endpoint.');
    }
    if (form && json !== undefined) {
      fail('invalid_arguments', 'Choose one request body format.');
    }
    const jsonBody = json === undefined ? undefined : JSON.stringify(json);
    if (jsonBody && Buffer.byteLength(jsonBody) > catalog.maxCommandBytes) {
      fail(
        'invalid_arguments',
        `Command exceeds the ${catalog.maxCommandBytes} byte request limit.`,
      );
    }
    let response;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = this.signal ? AbortSignal.any([timeout, this.signal]) : timeout;
    try {
      response = await this.fetch(url, {
        method,
        redirect: 'error',
        signal,
        headers: {
          Accept: binary ? 'application/octet-stream' : 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(bytes !== undefined
            ? { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) }
            : form
              ? { 'Content-Type': 'application/x-www-form-urlencoded' }
              : jsonBody
                ? { 'Content-Type': 'application/json' }
                : {}),
        },
        ...(bytes !== undefined
          ? { body: bytes }
          : form
            ? { body: new URLSearchParams(form) }
            : jsonBody
              ? { body: jsonBody }
              : {}),
      });
    } catch {
      throw new AgentError('network_unavailable', 'The API did not return a usable response.', {
        retryable: true,
        remediation:
          'Check connectivity. Authentication exchanges are never retried automatically.',
        execution: method === 'GET' ? 'not_applicable' : 'unknown',
      });
    }
    const chunks = [];
    let size = 0;
    try {
      if (response.body) {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > (binary && response.ok ? 15000000 : 262144)) {
            fail('invalid_response', 'The API response exceeded the size limit.');
          }
          chunks.push(chunk);
        }
      }
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      fail('network_unavailable', 'The API response was interrupted.', {
        retryable: true,
        execution: method === 'GET' ? 'not_applicable' : 'unknown',
      });
    }
    if (binary && response.ok) {
      return Buffer.concat(chunks);
    }
    let data;
    try {
      data = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
    } catch {
      fail('invalid_response', 'The API returned an unexpected format.', {
        status: response.status,
      });
    }
    if (!response.ok) {
      const e = data?.error;
      const code = identifier(typeof e === 'string' ? e : e?.code) ?? 'api_error';
      const retry = Number(response.headers.get('Retry-After') ?? e?.retryAfterSeconds);
      throw new AgentError(code, boundedText(e?.message) ?? 'The API refused the request.', {
        status: response.status,
        retryable:
          typeof e?.retryable === 'boolean'
            ? e.retryable
            : response.status === 429 || response.status === 503,
        remediation:
          boundedText(e?.remediation) ??
          (response.status === 401
            ? 'Run auth login again; check the connection in Account → Agents.'
            : 'Check permissions, availability and command help.'),
        ...(identifier(e?.requestId) ? { requestId: e.requestId } : {}),
        ...(Number.isFinite(retry) && retry >= 0 && retry <= 86400
          ? { retryAfterSeconds: retry }
          : {}),
        ...(Number.isSafeInteger(data?.interval) && data.interval > 0
          ? { interval: data.interval }
          : {}),
        ...(identifier(e?.execution) ? { execution: e.execution } : {}),
        ...(Number.isSafeInteger(e?.resetAt) && e.resetAt > 0 ? { resetAt: e.resetAt } : {}),
      });
    }
    return data;
  }
  oauth(endpoint, form) {
    return this.request(`/api/agents/oauth/${endpoint}`, {
      method: 'POST',
      form: { client_id: CLIENT_ID, ...form },
    });
  }
}
