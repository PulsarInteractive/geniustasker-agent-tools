import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, symlink, mkdir } from 'node:fs/promises';
import { AgentClient, credentials } from '../src/client.mjs';
import { CredentialStore } from '../src/store.mjs';
import { Transport, originOf, ORIGINS } from '../src/transport.mjs';
import { main, parse } from '../src/cli.mjs';
import { fixture, tokens, origin } from './helpers.mjs';

test('private storage rejects readable or linked credentials and never exposes tokens in doctor', async t => {
  const f = await fixture(t);
  assert.equal((await lstat(f.store.path)).mode & 0o777, 0o600);
  assert.equal((await lstat(f.directory)).mode & 0o777, 0o700);
  assert.ok(!JSON.stringify(await f.client.doctor()).includes('gta1.'));
  await chmod(f.store.path, 0o644);
  await assert.rejects(f.store.read(), { code: 'unsafe_credential_store' });
  await chmod(f.store.path, 0o600);
  const second = new CredentialStore({ directory: f.directory, context: 'linked' });
  await symlink(f.store.path, second.path);
  await assert.rejects(second.read(), { code: 'unsafe_credential_store' });
});

test('concurrent clients share a lock and rotate an expired credential only once', async t => {
  let rotations = 0;
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/oauth/token'); assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('refresh_token'), tokens().refresh_token);
    rotations++; await new Promise(resolve => setTimeout(resolve, 25));
    return Response.json(tokens('b'));
  }, { expired: true });
  const second = new AgentClient(f.transport, new CredentialStore({ directory: f.directory }));
  const results = await Promise.all([f.client.accessToken(), second.accessToken(), f.client.accessToken()]);
  assert.deepEqual(results, Array(3).fill(tokens('b').access_token)); assert.equal(rotations, 1);
  assert.equal((await f.store.read()).refreshPending, false);
});

test('lost refresh response is not replayed; logout revokes with retained token before deleting', async t => {
  let calls = 0;
  const f = await fixture(t, async () => { calls++; throw new Error('secret private URL'); }, { expired: true });
  await assert.rejects(f.client.accessToken(), { code: 'network_unavailable' });
  await assert.rejects(f.client.accessToken(), { code: 'reauthentication_required' });
  assert.equal(calls, 1);
  await assert.rejects(f.client.logout(), { code: 'network_unavailable' });
  assert.ok(await f.store.read());
  f.transport.fetch = async (url, options) => { assert.equal(url.pathname, '/api/agents/oauth/revoke'); assert.equal(options.body.get('token'), tokens().refresh_token); return new Response(null); };
  assert.equal((await f.client.logout()).revoked, true); assert.equal(await f.store.read(), null);
});

test('environment mismatch and stale locks fail closed before any request', async t => {
  const f = await fixture(t, () => assert.fail('no network'));
  const wrong = new AgentClient(new Transport(ORIGINS.production, { fetchImpl: () => assert.fail('no network') }), f.store);
  await assert.rejects(wrong.accessToken(), { code: 'credential_origin_mismatch' });
  await mkdir(f.store.lockPath);
  f.store.lockTimeoutMs = 1;
  await assert.rejects(f.client.accessToken(), { code: 'credential_store_busy' });
  assert.ok(await lstat(f.store.lockPath));
});

test('transport limits origins, routes, redirects, response size and raw diagnostics', async () => {
  for (const value of ['https://evil.test', 'http://localhost:9788', 'http://127.0.0.1:9788/api', 'https://api-geniustasker.pulsarinteractive.cloud@evil.test'])
    assert.throws(() => originOf(value, true), { code: 'invalid_origin' });
  assert.equal(originOf(origin, true), origin);
  assert.throws(() => originOf(origin), { code: 'invalid_origin' });
  const transport = new Transport(origin, { fetchImpl: async () => Response.json({ error: { code: 'agent_rate_limited', message: '\u001b[31msecret', requestId: 'request-1', retryable: true, remediation: 'wait_for_reset' } }, { status: 429, headers: { 'Retry-After': '12' } }) });
  await assert.rejects(transport.request('/api/agents/v1/me'), e => e.code === 'agent_rate_limited' && e.details.retryAfterSeconds === 12 && !JSON.stringify(e).includes('secret'));
  await assert.rejects(transport.request('/api/Authorization/LogIn'), { code: 'invalid_arguments' });
  transport.fetch = async () => new Response('x'.repeat(262145));
  await assert.rejects(transport.request('/api/agents/v1/me'), { code: 'invalid_response' });
  transport.fetch = async () => new Response('<html>private exception</html>', { status: 500 });
  await assert.rejects(transport.request('/api/agents/v1/me'), e => e.code === 'invalid_response' && !JSON.stringify(e).includes('private exception'));
});

test('CLI JSON separates stdout/stderr, refuses noninteractive login and invalid pagination', async t => {
  const f = await fixture(t); let stdout = '', stderr = '';
  const options = { directory: f.directory, stdout: { write: x => { stdout += x; } }, stderr: { write: x => { stderr += x; } }, isTTY: false };
  assert.equal(await main(['help', '--json'], options), 0);
  assert.equal(JSON.parse(stdout).formatVersion, 1); assert.equal(stderr, ''); stdout = '';
  assert.equal(await main(['auth', 'login'], options), 2); assert.equal(stdout, ''); assert.equal(JSON.parse(stderr).error.code, 'invalid_arguments'); stderr = '';
  assert.equal(await main(['resources', 'list', '--scope', 'project:a', '--collection', 'tasks', '--after', 'cursor'], options), 2);
  for (const args of [['whoami', '--token', 'secret'], ['whoami', '--json', '--json'], ['delete', 'everything']]) assert.throws(() => parse(args), { code: 'invalid_arguments' });
});


test('token responses cannot replace local origin binding or inject persisted fields', () => {
  const value = credentials({ ...tokens(), origin: 'https://evil.test', clientId: 'other', arbitrary: 'discarded' }, origin);
  assert.equal(value.origin, origin); assert.equal(value.clientId, 'geniustasker-cli');
  assert.equal(Object.hasOwn(value, 'arbitrary'), false);
});
