import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { browserLogin, deviceLogin } from '../src/login.mjs';
import { fixture, tokens } from './helpers.mjs';
import { main } from '../src/cli.mjs';

test('CLI beta defaults to browser PKCE and keeps stdout credential-free', async t => {
  const f = await fixture(t, () => {}, { authenticated: false });
  let opened = 0, output = '', progress = '';
  const status = await main(['auth', 'login'], { directory: f.directory, isTTY: true,
    stdout: { write: value => output += value }, stderr: { write: value => progress += value },
    fetchImpl: async (url, options) => {
      assert.equal(url.origin, 'https://dev-api-geniustasker.pulsarinteractive.cloud');
      assert.equal(options.body.get('grant_type'), 'authorization_code');
      return Response.json(tokens());
    },
    openBrowserImpl: async value => {
      opened++;
      const url = new URL(value), callback = new URL(url.searchParams.get('redirect_uri'));
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(url.searchParams.get('scope').includes('memory:write'));
      callback.search = new URLSearchParams({ state: url.searchParams.get('state'), code: '00.consent' });
      assert.equal((await fetch(callback)).status, 200);
    },
  });
  assert.equal(status, 0); assert.equal(opened, 1);
  assert.match(output, /Connected to GeniusTasker/);
  assert.match(progress, /Waiting for your decision/);
  assert.ok(!progress.includes('"event":'));
  assert.ok(!`${output}${progress}`.includes('gta1.'));
});

for (const noBrowser of [false, true]) test(`CLI manual consent still works when ${noBrowser ? 'browser opening is disabled' : 'browser launch fails'}`, async t => {
  const f = await fixture(t, () => {}, { authenticated: false });
  let diagnostics = '', output = '', completion;
  const status = await main(['auth', 'login', '--json', ...(noBrowser ? ['--no-browser'] : [])], {
    directory: f.directory, isTTY: true, fetchImpl: async () => Response.json(tokens()),
    stdout: { write: value => output += value },
    stderr: { write: value => {
      diagnostics += value; const event = JSON.parse(value);
      if (event.event === 'consent_required') {
        const url = new URL(event.url), callback = new URL(url.searchParams.get('redirect_uri'));
        callback.search = new URLSearchParams({ state: url.searchParams.get('state'), code: '00.manual' });
        completion = fetch(callback);
      }
    } },
    openBrowserImpl: async () => { if (noBrowser) assert.fail('must not launch'); throw Error('private local launch detail'); },
  });
  assert.equal(status, 0); assert.equal((await completion).status, 200);
  assert.equal(diagnostics.includes('browser_unavailable'), !noBrowser);
  assert.ok(!diagnostics.includes('private local launch detail'));
  assert.equal(JSON.parse(output).data.connected, true);
});

test('device flow waits, increases slow-down interval, stores only after consent and omits tokens from output', async t => {
  let polls = 0, time = 0; const waits = [], notifications = [];
  const f = await fixture(t, async (url, options) => {
    if (url.pathname.endsWith('/device')) return Response.json({ device_code: '00.device', user_code: '00-AB89-CDEF', verification_uri_complete: 'http://127.0.0.1:9000/agents/connect?userCode=00-AB89-CDEF', expires_in: 600, interval: 5 });
    assert.equal(options.body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code');
    polls++;
    if (polls === 1) return Response.json({ error: 'authorization_pending' }, { status: 400 });
    if (polls === 2) return Response.json({ error: 'slow_down', interval: 10 }, { status: 400 });
    return Response.json(tokens());
  }, { authenticated: false });
  const result = await deviceLogin(f.client, { notify: data => notifications.push(data), now: () => time, wait: async ms => { waits.push(ms); time += ms; } });
  assert.deepEqual(waits, [5000, 5000, 10000]); assert.equal(result.connected, true);
  assert.ok(!JSON.stringify([result, notifications]).includes('gta1.')); assert.ok(!JSON.stringify(notifications).includes('device_code'));
  assert.equal((await f.store.read()).refresh_token, tokens().refresh_token);
});

test('device denial exits without persistence; untrusted consent URLs never open', async t => {
  const f = await fixture(t, async url => url.pathname.endsWith('/device') ? Response.json({ device_code: '00.device', user_code: '00-ABCD-EFGH', verification_uri_complete: 'http://127.0.0.1:9000/agents/connect', expires_in: 600, interval: 5 }) : Response.json({ error: 'access_denied' }, { status: 400 }), { authenticated: false });
  await assert.rejects(deviceLogin(f.client, { wait: async () => {} }), { code: 'access_denied' });
  assert.equal(await f.store.read(), null);
  f.transport.fetch = async () => Response.json({ device_code: '00.device', user_code: '00-ABCD-EFGH', verification_uri_complete: 'https://evil.test/agents/connect', expires_in: 600, interval: 5 });
  await assert.rejects(deviceLogin(f.client, { openBrowser: () => assert.fail('must not open') }), { code: 'invalid_response' });
});

test('real PKCE loopback ignores wrong state/duplicate values and validates the code verifier', async t => {
  let authorization;
  const f = await fixture(t, async (url, options) => {
    assert.equal(options.body.get('code'), '00.valid-code');
    assert.equal(options.body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
    assert.equal(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
    return Response.json(tokens());
  }, { authenticated: false });
  const result = await browserLogin(f.client, { lifetimeMs: 5000, openBrowser: async value => {
    authorization = new URL(value); const callback = new URL(authorization.searchParams.get('redirect_uri'));
    assert.equal(callback.hostname, '127.0.0.1'); callback.searchParams.set('code', '00.valid-code');
    callback.searchParams.set('state', 'é'.repeat(43)); assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', authorization.searchParams.get('state')); callback.searchParams.append('code', 'duplicate'); assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.delete('code'); callback.searchParams.set('code', '00.valid-code'); assert.equal((await fetch(callback)).status, 200);
  } });
  assert.equal(result.connected, true);
  await assert.rejects(fetch(authorization.searchParams.get('redirect_uri')));
});

test('PKCE cancellation returns a bounded failure and releases the credential lock', async t => {
  const f = await fixture(t, () => assert.fail('no token exchange'), { authenticated: false });
  await assert.rejects(browserLogin(f.client, { lifetimeMs: 2000, openBrowser: async value => {
    const url = new URL(value), callback = new URL(url.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({ state: url.searchParams.get('state'), error: 'access_denied' });
    assert.equal((await fetch(callback)).status, 200);
  } }), { code: 'access_denied' });
  assert.equal(await f.store.read(), null);
  await f.store.locked(async () => {});
});
