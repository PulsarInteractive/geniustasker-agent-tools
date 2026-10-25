import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Transport } from '../src/transport.mjs';
import { CommandJournal } from '../src/commands.mjs';
import { AgentClient } from '../src/client.mjs';
import { fixture, origin, tokens } from './helpers.mjs';
import { retryAfterSeconds, retryAt } from '../src/recovery.mjs';

const path = '/api/agents/v1/me';
test('edge refusals retain intent; recognized API denial and CF-Ray alone retain semantics', async () => {
  const cases = [
    [403, '<html>private credential</html>', {}, 'edge_refusal_unknown', 503],
    [401, { message: 'opaque' }, {}, 'edge_refusal_unknown', 503],
    [200, 'challenge', { 'cf-mitigated': 'challenge' }, 'edge_challenge', 503],
    [403, { error: { code: 'scope_denied' } }, { 'cf-ray': 'trace' }, 'scope_denied', 403],
    [401, { error: 'invalid_token' }, { 'cf-ray': 'trace' }, 'invalid_token', 401],
  ];
  for (const [status, body, headers, code, expectedStatus] of cases) {
    const transport = new Transport(origin, {
      fetchImpl: async () =>
        typeof body === 'string'
          ? new Response(body, { status, headers })
          : Response.json(body, { status, headers }),
    });
    await assert.rejects(transport.request(path), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, expectedStatus);
      assert.ok(!JSON.stringify(error.toJSON()).includes('private credential'));
      return true;
    });
  }
  const binary = new Transport(origin, {
    fetchImpl: async () => new Response('challenge', { headers: { 'cf-mitigated': 'challenge' } }),
  });
  await assert.rejects(binary.request('/api/agents/v1/media/content', { binary: true }), {
    code: 'edge_challenge',
  });
});

test('HTTP-date uses server clock; long delays and extreme waits are never shortened', () => {
  const response = new Response(null, {
    headers: {
      Date: 'Mon, 26 Oct 2026 10:00:00 GMT',
      'Retry-After': 'Mon, 26 Oct 2026 12:00:00 GMT',
    },
  });
  assert.equal(retryAfterSeconds(response, null, 1), 7200);
  assert.equal(
    retryAfterSeconds(new Response(null, { headers: { 'Retry-After': '172800' } })),
    172800,
  );
  assert.equal(
    retryAt({ retryable: true, details: { retryAfterSeconds: 1e20 } }, 1, () => 0),
    Number.MAX_SAFE_INTEGER,
  );
});

test('restart preserves two-hour command cooldown, then retries identical bytes and saves receipt', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const sent = [];
  const f = await fixture(t, async (_url, options) => {
    sent.push(options.body);
    if (sent.length === 1) {
      return new Response('temporary protection', {
        status: 403,
        headers: { 'cf-mitigated': 'challenge', 'Retry-After': '7200' },
      });
    }
    // Test tokens are made long-lived below, so every call here is a command.
    const input = JSON.parse(options.body);
    return Response.json({
      operationId: input.operationId,
      scope: input.scope,
      epoch: input.epoch,
      kind: input.kind,
      cursor: '3',
      items: [],
      affectedCollections: [],
    });
  });
  const session = await f.store.read();
  await f.store.locked(() => f.store.write({ ...session, expiresAt: Date.now() + 86400000 }));
  const journal = new CommandJournal(f.client);
  const saved = await journal.prepare({
    scope: 'project:work',
    epoch: 'test-epoch',
    id: randomUUID(),
    expectedRevision: null,
    kind: 'task.create',
    data: { title: 'Prepare release', owner: 'owner' },
  });
  await assert.rejects(journal.retry(saved.operationId), { code: 'edge_challenge' });
  const row = await journal.inspect(saved.operationId);
  assert.ok(row.retryAt > Date.now() + 7200000);
  const reopened = new CommandJournal(new AgentClient(f.transport, f.store));
  t.mock.timers.tick(660000);
  await assert.rejects(reopened.retry(saved.operationId), { code: 'retry_pending' });
  assert.equal(sent.length, 1);
  t.mock.timers.setTime(row.retryAt + 1);
  assert.equal((await reopened.retry(saved.operationId)).source, 'server');
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
  assert.equal((await reopened.inspect(saved.operationId)).state, 'confirmed');
});

test('explicit challenge before OAuth rotation preserves refresh token and durable cooldown', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  let calls = 0;
  const f = await fixture(
    t,
    async () => {
      if (++calls === 1) {
        return new Response('challenge', {
          status: 403,
          headers: { 'cf-mitigated': 'challenge', 'Retry-After': '120' },
        });
      }
      return Response.json(tokens('b'));
    },
    { expired: true },
  );
  await assert.rejects(f.client.accessToken(), { code: 'edge_challenge' });
  const saved = await f.store.read();
  assert.equal(saved.refresh_token, tokens().refresh_token);
  assert.equal(saved.refreshPending, false);
  const reopened = new AgentClient(f.transport, f.store);
  await assert.rejects(reopened.accessToken(), { code: 'retry_pending' });
  assert.equal(calls, 1);
  t.mock.timers.setTime(saved.retryAt + 1);
  assert.equal(await reopened.accessToken(), tokens('b').access_token);
  assert.equal(calls, 2);
});
