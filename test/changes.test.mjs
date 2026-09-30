import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { readChanges, watchChanges } from '../src/changes.mjs';
import { main } from '../src/cli.mjs';
import { fixture } from './helpers.mjs';
const query = { scope: 'project:work', collection: 'tasks', cursor: 'initial' };
const page = (items = []) => ({
  scope: query.scope,
  collection: query.collection,
  epoch: 'epoch',
  checkpoint: '12',
  items,
  omittedIds: [],
  nextCursor: 'next',
  hasMore: false,
  pollAfterSeconds: 5,
});

test('watch returns one changed page immediately; CLI exposes the same resumable result', async (t) => {
  let calls = 0;
  const f = await fixture(t, async (url, init) => {
    assert.equal(url.searchParams.get('cursor'), 'initial');
    assert.ok(init.headers.Authorization);
    calls++;
    return Response.json(page([{ id: 'one', revision: '12', kind: 'remove', data: null }]));
  });
  const result = await watchChanges(f.client, query);
  assert.equal(result.reason, 'changes');
  assert.equal(result.polls, 1);
  assert.equal(calls, 1);
  let out = '',
    err = '';
  const status = await main(
    [
      'changes',
      'list',
      '--scope',
      query.scope,
      '--collection',
      'tasks',
      '--cursor',
      'initial',
      '--origin',
      f.transport.origin,
      '--allow-local',
      '--json',
    ],
    {
      directory: f.directory,
      fetchImpl: f.transport.fetch,
      stdout: { write: (x) => (out += x) },
      stderr: { write: (x) => (err += x) },
    },
  );
  assert.equal(status, 0);
  assert.equal(err, '');
  assert.equal(JSON.parse(out).data.nextCursor, 'next');
  assert.ok(!out.includes('gta1.'));
});
test('an empty wait ends within its budget without launching an extra poll or leaking credentials', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json(page());
  });
  const start = performance.now(),
    result = await watchChanges(f.client, { ...query, waitSeconds: 1 });
  assert.equal(result.reason, 'timeout');
  assert.equal(result.nextCursor, 'next');
  assert.equal(result.polls, 1);
  assert.equal(calls, 1);
  assert.ok(performance.now() - start < 2500);
  assert.ok(!JSON.stringify(result).includes('gta1.'));
});
test('cancellation interrupts the sleep and an already cancelled wait sends no request', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json(page());
  });
  const controller = new AbortController();
  const running = watchChanges(f.client, query, controller.signal);
  await sleep(80);
  controller.abort();
  await assert.rejects(
    running,
    (error) => error.code === 'cancelled' && error.details.nextCursor === 'next',
  );
  assert.equal(calls, 1);
  await assert.rejects(watchChanges(f.client, query, controller.signal), { code: 'cancelled' });
  assert.equal(calls, 1);
});
test('deadline interrupts an in-flight request; it never invents a completed empty page', async (t) => {
  const f = await fixture(t, async (_url, init) => {
    await sleep(10000, undefined, { signal: init.signal });
    return Response.json(page());
  });
  const start = performance.now(),
    result = await watchChanges(f.client, { ...query, waitSeconds: 1 });
  assert.equal(result.reason, 'timeout');
  assert.equal(result.polls, 0);
  assert.equal(result.page, null);
  assert.equal(result.nextCursor, 'initial');
  assert.ok(performance.now() - start < 2500);
});
test('access errors, expired history and monthly exhaustion stop without retry; retry hints keep their meaning', async (t) => {
  let calls = 0,
    status = 403,
    code = 'agent_permission_denied';
  const f = await fixture(t, async () => {
    calls++;
    return Response.json(
      { error: { code, retryable: false, remediation: 'review_access', resetAt: 1800000000000 } },
      { status },
    );
  });
  for (const pair of [
    [403, 'agent_permission_denied'],
    [401, 'invalid_agent_token'],
    [409, 'agent_change_history_expired'],
    [429, 'agent_monthly_budget_exhausted'],
  ]) {
    [status, code] = pair;
    await assert.rejects(
      watchChanges(f.client, query),
      (error) =>
        error.code === code &&
        error.retryable === false &&
        error.details.nextCursor === 'initial' &&
        error.details.resetAt === 1800000000000,
    );
  }
  assert.equal(calls, 4);
});
test('wrong contexts, malformed pages and unbounded requests never advance the saved cursor', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json({ ...page(), scope: 'project:other' });
  });
  await assert.rejects(readChanges(f.client, query), { code: 'invalid_response' });
  for (const waitSeconds of [0, -1, 61, Infinity, '30']) {
    await assert.rejects(watchChanges(f.client, { ...query, waitSeconds }), {
      code: 'invalid_arguments',
    });
  }
  assert.equal(calls, 1);
});

test('a later poll stops on revoked access and preserves the last fully read continuation', async (t) => {
  let calls = 0,
    firstAt = 0;
  const f = await fixture(t, async (url) => {
    calls++;
    if (calls === 1) {
      firstAt = performance.now();
      return Response.json(page());
    }
    assert.ok(performance.now() - firstAt >= 4900, 'Honor the minimum poll delay');
    assert.equal(url.searchParams.get('cursor'), 'next');
    return Response.json(
      { error: { code: 'invalid_agent_token', retryable: false } },
      { status: 401 },
    );
  });
  await assert.rejects(
    watchChanges(f.client, { ...query, waitSeconds: 8 }),
    (error) => error.code === 'invalid_agent_token' && error.details.nextCursor === 'next',
  );
  assert.equal(calls, 2);
});
