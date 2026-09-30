import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { credentials } from './client.mjs';
import { fail, AgentError } from './errors.mjs';
import { CLIENT_ID, ORIGINS } from './transport.mjs';

// Fixed copy only: callback codes, state and private account data never enter HTML.
function callbackPage(response, approved) {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  response.end(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>GeniusTasker · ${approved ? 'Authorization received' : 'Access declined'}</title><style>:root{font-family:system-ui,sans-serif;color:#18232b;background:#f4f6f7}body{margin:0;padding:80px 20px}main{max-width:440px;margin:auto;padding:36px;border:1px solid #d5dde2;border-radius:22px;background:#fff}b{color:#6139d7;font-size:14px}h1{font-size:26px;line-height:1.3;margin:28px 0 12px;letter-spacing:-.6px}p{font-size:15px;line-height:1.7;color:#52616b}small{display:block;margin-top:28px;color:#52616b}@media(prefers-color-scheme:dark){:root{background:#080b10;color:#edf1f3}main{background:#12171f;border-color:#303b47}p,small{color:#a7b3bd}b{color:#b19aff}}</style><main><b>GeniusTasker</b><h1>${approved ? 'Authorization received.' : 'Access declined.'}</h1><p>${approved ? 'Return to your terminal. It is securely completing the connection with the access you chose.' : 'This request has no access to your account. You can return to your terminal.'}</p><small>You can close this tab.</small></main></html>`,
  );
}

function loginResult(session) {
  return {
    connected: true,
    origin: session.origin,
    connectionId: session.connection_id,
    profileId: session.profile_id,
    sessionId: session.session_id,
  };
}
async function saveLogin(client, exchange) {
  // Hold the context lock throughout consent so two terminals cannot overwrite
  // independent connections and leave an inaccessible active session behind.
  return client.store.locked(async () => {
    if (await client.store.read()) {
      fail('already_authenticated', 'This context already has a session.', {
        remediation: 'Run auth logout first, or choose another --context.',
      });
    }
    const result = await exchange();
    const session = credentials(result, client.transport.origin);
    try {
      await client.store.write(session);
    } catch {
      try {
        await client.transport.oauth('revoke', { token: session.refresh_token });
      } catch {
        fail(
          'credential_save_failed',
          'Login succeeded but local storage failed; server revocation could not be confirmed.',
          { remediation: 'Revoke the new connection in Account → Agents before trying again.' },
        );
      }
      fail('credential_save_failed', 'Local storage failed. The new server session was revoked.');
    }
    return loginResult(session);
  }, client.transport.signal);
}

/** Consent URLs are server data. Restrict automatic navigation to the product
 * app paired with this API (or the explicitly opted-in local development app). */
export function consentUrl(value, origin) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('invalid_response', 'Invalid consent URL.');
  }
  const expected =
    origin === ORIGINS.production
      ? 'https://app-geniustasker.pulsarinteractive.cloud'
      : origin === ORIGINS.development
        ? 'https://dev-app-geniustasker.pulsarinteractive.cloud'
        : null;
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== '/agents/connect' ||
    (expected
      ? url.origin !== expected
      : url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))
  ) {
    fail('invalid_response', 'The consent URL is not a trusted GeniusTasker application.');
  }
  return url.href;
}

/**
 * Complete device consent within the server's expiry and polling bounds.
 * The context lock covers the full exchange; credentials are saved only after
 * a validated response. notify/openBrowser are presentation callbacks.
 */
export function deviceLogin(
  client,
  { scope, notify, openBrowser, wait = delay, now = Date.now } = {},
) {
  return saveLogin(client, async () => {
    const startedAt = now();
    const device = await client.transport.oauth('device', scope ? { scope } : {});
    if (
      !device ||
      typeof device.device_code !== 'string' ||
      device.device_code.length > 256 ||
      !/^[0-9A-F]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(device.user_code) ||
      !Number.isSafeInteger(device.expires_in) ||
      device.expires_in < 1 ||
      device.expires_in > 900 ||
      !Number.isSafeInteger(device.interval) ||
      device.interval < 1 ||
      device.interval > 60
    ) {
      fail('invalid_response', 'The device authorization response was invalid.');
    }
    const url = consentUrl(device.verification_uri_complete, client.transport.origin);
    notify?.({
      event: 'consent_required',
      url,
      userCode: device.user_code,
      expiresIn: device.expires_in,
    });
    await openBrowser?.(url);
    const deadline = startedAt + device.expires_in * 1000;
    let interval = device.interval;
    while (now() + interval * 1000 < deadline) {
      await wait(interval * 1000, undefined, { signal: client.transport.signal });
      try {
        return await client.transport.oauth('token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: device.device_code,
        });
      } catch (error) {
        if (!(error instanceof AgentError)) {
          throw error;
        }
        if (error.code === 'authorization_pending') {
          continue;
        }
        if (error.code === 'slow_down') {
          interval = Math.max(interval + 5, error.details.interval ?? 0);
          continue;
        }
        // Rate limits are explicit; no endless polling or accidental login loop.
        throw error;
      }
    }
    fail('expired_token', 'The authorization request expired.', {
      remediation: 'Start auth login again and confirm it in the application.',
    });
  });
}

/**
 * Complete browser PKCE consent through one validated loopback callback.
 * The ephemeral listener closes on success, denial, cancellation or expiry.
 * Authentication codes and tokens never enter the callback's HTML response.
 */
export function browserLogin(client, { scope, notify, openBrowser, lifetimeMs = 600000 } = {}) {
  return saveLogin(client, async () => {
    const verifier = randomBytes(48).toString('base64url'),
      state = randomBytes(32).toString('base64url');
    let resolveCode,
      rejectCode,
      used = false,
      redirect;
    const codePromise = new Promise((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    // Attach immediately so abort during navigation cannot become unhandled.
    codePromise.catch(() => {});
    const server = createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      let url;
      try {
        url = new URL(request.url, redirect);
      } catch {
        response.writeHead(400).end('Invalid callback.');
        return;
      }
      const received = url.searchParams.get('state') ?? '';
      const validState =
        Buffer.byteLength(received) === Buffer.byteLength(state) &&
        timingSafeEqual(Buffer.from(received), Buffer.from(state));
      if (
        used ||
        request.method !== 'GET' ||
        request.headers.host !== new URL(redirect).host ||
        url.origin !== new URL(redirect).origin ||
        url.pathname !== '/callback' ||
        !validState ||
        [...url.searchParams.keys()].some(
          (key) =>
            !['state', 'code', 'error'].includes(key) || url.searchParams.getAll(key).length !== 1,
        )
      ) {
        response.writeHead(400).end('Invalid callback. Return to your terminal.');
        return;
      }
      const code = url.searchParams.get('code');
      if (url.searchParams.has('error')) {
        used = true;
        callbackPage(response, false);
        rejectCode(new AgentError('access_denied', 'Connection declined.'));
        return;
      }
      if (!code || !/^[A-Za-z0-9_.-]{1,256}$/.test(code)) {
        response.writeHead(400).end('Invalid callback.');
        return;
      }
      used = true;
      callbackPage(response, true);
      resolveCode(code);
    });
    const abort = () => rejectCode(new AgentError('login_cancelled', 'Login was cancelled.'));
    let timer;
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      redirect = `http://127.0.0.1:${server.address().port}/callback`;
      timer = setTimeout(
        () => rejectCode(new AgentError('expired_token', 'The authorization request expired.')),
        lifetimeMs,
      );
      client.transport.signal?.addEventListener('abort', abort, { once: true });
      if (client.transport.signal?.aborted) {
        abort();
      }
      const url = new URL('/api/agents/oauth/authorize', client.transport.origin);
      url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirect,
        state,
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        ...(scope ? { scope } : {}),
      }).toString();
      notify?.({ event: 'consent_required', url: url.href, expiresIn: lifetimeMs / 1000 });
      await openBrowser?.(url.href);
      const code = await codePromise;
      return await client.transport.oauth('token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        code_verifier: verifier,
      });
    } finally {
      clearTimeout(timer);
      client.transport.signal?.removeEventListener('abort', abort);
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
