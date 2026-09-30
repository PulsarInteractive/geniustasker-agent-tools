import test from 'node:test';
import assert from 'node:assert/strict';
import { searchMemory, exploreGraph, resolveMemory } from '../src/knowledge.mjs';

test('search keeps its page cursor and does not silently read the whole corpus', async () => {
  const calls = [];
  const client = {
    get: async (resource, query) => {
      calls.push({ resource, query });
      return { scope: query.scope, mode: 'search', items: [], nextAfter: 'next', truncated: true };
    },
  };
  const result = await searchMemory(client, { scope: 'memory:one', query: 'owl' });
  assert.equal(result.nextAfter, 'next');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    resource: 'knowledge',
    query: { scope: 'memory:one', query: 'owl', mode: 'search' },
  });
  await assert.rejects(searchMemory(client, { scope: 'memory:one', query: 'owl', after: 'next' }), {
    code: 'invalid_arguments',
  });
  await assert.rejects(searchMemory(client, { scope: 'project:one', query: 'owl' }), {
    code: 'invalid_arguments',
  });
  assert.equal(calls.length, 1);
});

test('Graph validates scope and bounded neighborhood without accepting dangling edges', async () => {
  const input = { scope: 'memory:one', center: 'owl', depth: 2 };
  let result = {
    scope: 'memory:one',
    mode: 'graph',
    nodes: [{ id: 'owl' }, { id: 'story' }],
    edges: [{ data: { source: 'owl', target: 'story' } }],
    truncated: true,
  };
  const calls = [],
    client = {
      get: async (resource, query) => {
        calls.push({ resource, query });
        return result;
      },
    };
  assert.equal((await exploreGraph(client, input)).truncated, true);
  assert.equal(calls[0].query.mode, 'graph');
  await assert.rejects(exploreGraph(client, { ...input, depth: 4 }), { code: 'invalid_arguments' });
  result = { ...result, scope: 'memory:other' };
  await assert.rejects(exploreGraph(client, input), { code: 'invalid_response' });
  result = { ...result, scope: 'memory:one', nodes: [{ id: 'owl' }] };
  await assert.rejects(exploreGraph(client, input), { code: 'invalid_response' });
});

test('reference resolution never reuses a revoked response or returns leaked unavailable content', async () => {
  const input = { scope: 'memory:friend', pageId: 'owl', blockId: 'face' };
  let result = {
    ...input,
    status: 'available',
    epoch: 'one',
    accessRevision: '1',
    page: { id: 'owl', data: { blocks: [] } },
  };
  let count = 0;
  const client = {
    get: async () => {
      count++;
      return result;
    },
  };
  assert.equal((await resolveMemory(client, input)).status, 'available');
  result = { ...input, status: 'unavailable', epoch: null, accessRevision: null, page: null };
  assert.equal((await resolveMemory(client, input)).page, null);
  assert.equal(count, 2);
  result = { ...result, page: { id: 'owl', data: { title: 'Stale content' } } };
  await assert.rejects(resolveMemory(client, input), { code: 'invalid_response' });
  result = {
    ...input,
    status: 'available',
    epoch: 'one',
    accessRevision: '3',
    page: { id: 'owl', data: { title: 'Access restored' } },
  };
  assert.equal((await resolveMemory(client, input)).page.data.title, 'Access restored');
});
