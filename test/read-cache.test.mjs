import test from 'node:test';
import assert from 'node:assert/strict';
import { ConditionalReadCache } from '../src/read-cache.mjs';
import { AgentClient } from '../src/client.mjs';

const page = (etag = 'version-one') => ({
  scope: 'memory:one',
  collection: 'pages',
  epoch: 'epoch',
  checkpoint: '5',
  etag,
  items: [{ id: 'one', revision: '5', data: { title: 'Guide', text: 'Document' } }],
  nextAfter: null,
  omittedIds: [],
  changeCursor: 'cursor',
});
const unchanged = (value) => ({ ...value, items: [], notModified: true });

test('every hit revalidates and restores only its matching complete response', async () => {
  const cache = new ConditionalReadCache();
  let requests = 0;
  const load = async (etag) => {
    requests++;
    return etag ? unchanged(page()) : page();
  };
  const first = await cache.read('document', load);
  first.items[0].data.text = 'Caller mutation';
  const second = await cache.read('document', load);
  assert.equal(requests, 2);
  assert.equal(second.items[0].data.text, 'Document');
  assert.equal(second.notModified, undefined);
  assert.equal(second.changeCursor, 'cursor');
});

test('identical in-flight reads coalesce but return isolated result objects', async () => {
  const cache = new ConditionalReadCache();
  let release,
    requests = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const load = async () => {
    requests++;
    await gate;
    return page();
  };
  const first = cache.read('same', load),
    second = cache.read('same', load);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(requests, 1);
  a.items.length = 0;
  assert.equal(b.items.length, 1);
});

test('revocation and network failure clear data; there is no stale offline success', async () => {
  for (const status of [401, 403, 404, 409, 429, 500, 503]) {
    const cache = new ConditionalReadCache();
    await cache.read('one', async () => page());
    await assert.rejects(
      cache.read('one', async () => {
        throw Object.assign(new Error('Refused'), { status });
      }),
      { status },
    );
    assert.equal(cache.entries.size, 0);
    assert.equal(cache.bytes, 0);
    await cache.read('one', async (etag) => {
      assert.equal(etag, undefined);
      return page();
    });
  }
});

test('a context change fences a late response and cannot refill the cache', async () => {
  const cache = new ConditionalReadCache();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const request = cache.read('one', async () => {
    await gate;
    return page();
  });
  cache.clear();
  release();
  await assert.rejects(request, { code: 'read_context_changed' });
  assert.equal(cache.entries.size, 0);
});

test('LRU, byte and age limits bound retained private data independently of network validation', async () => {
  let now = 0;
  const cache = new ConditionalReadCache({
    maxEntries: 2,
    maxBytes: 1000,
    maxAgeMs: 10,
    now: () => now,
  });
  await cache.read('a', async () => page('a'));
  await cache.read('b', async () => page('b'));
  await cache.read('a', async () => unchanged(page('a')));
  await cache.read('c', async () => page('c'));
  assert.deepEqual([...cache.entries.keys()], ['a', 'c']);
  now = 11;
  await cache.read('a', async (etag) => {
    assert.equal(etag, undefined);
    return page('a');
  });
  assert.deepEqual([...cache.entries.keys()], ['a']);
  await cache.read('large', async () => ({
    ...page('large'),
    items: [{ text: '界'.repeat(1000) }],
  }));
  assert.equal(cache.entries.has('large'), false);
  assert.ok(cache.bytes <= 1000);
});

test('unmatched or malformed not-modified replies never invent content', async () => {
  const cache = new ConditionalReadCache();
  await assert.rejects(
    cache.read('one', async () => unchanged(page())),
    { code: 'invalid_response' },
  );
  for (const patch of [
    { etag: 'other' },
    { scope: 'memory:other' },
    { epoch: 'restored' },
    { checkpoint: '6' },
    { collection: 'nodes' },
    { items: [{ text: 'Unrequested' }] },
  ]) {
    await cache.read('one', async () => page());
    await assert.rejects(
      cache.read('one', async () => ({ ...unchanged(page()), ...patch })),
      { code: 'invalid_response' },
    );
  }
});

test('client isolates tokens, origins and exact queries, and remains compatible with older servers', async () => {
  const queries = [];
  const client = new AgentClient(
    {
      origin: 'https://api.example.test',
      request: async (_path, options) => {
        queries.push(options.query);
        return options.query.ifNoneMatch ? unchanged(page()) : page();
      },
    },
    {},
  );
  let token = 'first';
  client.accessToken = async () => token;
  const query = { scope: 'memory:one', collection: 'pages', id: 'one' };
  await client.get('resources', query);
  await client.get('resources', { id: 'one', collection: 'pages', scope: 'memory:one' });
  assert.equal(queries[1].ifNoneMatch, 'version-one');
  await client.get('resources', { ...query, id: 'two' });
  assert.equal(queries[2].ifNoneMatch, undefined);
  token = 'second';
  await client.get('resources', query);
  assert.equal(queries[3].ifNoneMatch, undefined);
  client.transport.origin = 'https://other.example.test';
  await client.get('resources', query);
  assert.equal(queries[4].ifNoneMatch, undefined);
  client.transport.request = async () => {
    const value = page();
    delete value.etag;
    return value;
  };
  client.invalidateReads();
  await client.get('resources', query);
  await client.get('resources', query);
  assert.equal(client.readCache.entries.size, 0);
});

test('identity failure also fences previously cached and in-flight resource reads', async () => {
  const client = new AgentClient(
    { origin: 'https://api.example.test', request: async () => page() },
    {},
  );
  client.accessToken = async () => 'one';
  await client.get('resources', { scope: 'memory:one', collection: 'pages' });
  client.accessToken = async () => {
    throw Object.assign(new Error('Disconnected'), { code: 'not_authenticated' });
  };
  await assert.rejects(client.get('me'), { code: 'not_authenticated' });
  assert.equal(client.readCache.entries.size, 0);
});

test('foreign resource responses never enter the client cache', async () => {
  const client = new AgentClient(
    {
      origin: 'https://api.example.test',
      request: async () => ({ ...page(), scope: 'memory:other' }),
    },
    {},
  );
  client.accessToken = async () => 'one';
  await assert.rejects(client.get('resources', { scope: 'memory:one', collection: 'pages' }), {
    code: 'invalid_response',
  });
  assert.equal(client.readCache.entries.size, 0);
});

test('malformed resource bodies fail explicitly without retaining an entry', async () => {
  for (const value of [undefined, null, [], 'wrong']) {
    const cache = new ConditionalReadCache();
    await assert.rejects(
      cache.read('one', async () => value),
      { code: 'invalid_response' },
    );
    assert.equal(cache.entries.size, 0);
  }
});
