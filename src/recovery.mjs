import { AgentError } from './errors.mjs';

/** Seconds and IMF-fixdate, using the response clock when supplied. No early cap. */
export function retryAfterSeconds(response, error, now = Date.now()) {
  const value = response.headers.get('Retry-After');
  if (value !== null && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const seconds = Number(value);
    if (seconds >= 0) {
      return Math.min(Number.MAX_SAFE_INTEGER, seconds);
    }
  }
  const date =
    value && /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)
      ? Date.parse(value)
      : NaN;
  if (Number.isFinite(date)) {
    const serverDate = Date.parse(response.headers.get('Date') ?? '');
    return Math.max(0, (date - (Number.isFinite(serverDate) ? serverDate : now)) / 1000);
  }
  if (Number.isFinite(error?.retryAfterMs) && error.retryAfterMs >= 0) {
    return error.retryAfterMs / 1000;
  }
  if (Number.isFinite(error?.retryAfterSeconds) && error.retryAfterSeconds >= 0) {
    return error.retryAfterSeconds;
  }
  if (Number.isSafeInteger(error?.resetAt) && error.resetAt > now) {
    return (error.resetAt - now) / 1000;
  }
  return undefined;
}

/** An explicit edge challenge never reached the origin. An opaque refusal may have. */
export function edgeRefusal(response, data) {
  const challenge = response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge';
  const error = data?.error;
  const code = typeof error === 'string' ? error : error?.code;
  const recognized =
    typeof code === 'string' &&
    /^[a-zA-Z0-9_.:-]{1,100}$/.test(code) &&
    !response.headers.get('content-type')?.toLowerCase().includes('text/html');
  if (!challenge && (![401, 403].includes(response.status) || recognized)) {
    return null;
  }
  return new AgentError(
    challenge ? 'edge_challenge' : 'edge_refusal_unknown',
    'A temporary protection refused the request. The saved session and operation are retained.',
    {
      status: 503,
      retryable: true,
      remediation:
        'Wait for retryAfterSeconds, then retry the same saved operation. Do not discard its journal.',
      retryAfterSeconds: retryAfterSeconds(response, error) ?? 60,
      execution: challenge ? 'not_started' : 'unknown',
    },
  );
}

/** Persist a positive jitter once; extreme waits suspend rather than overflow a timer. */
export function retryAt(error, now = Date.now(), random = Math.random) {
  const seconds = error?.details?.retryAfterSeconds;
  if (!error?.retryable || !Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  const jitter = 1000 + Math.floor(Math.max(0, Math.min(1, random())) * 29000);
  return Math.min(Number.MAX_SAFE_INTEGER, now + Math.ceil(seconds * 1000) + jitter);
}

export function requireRetryReady(deadline, now = Date.now()) {
  if (Number.isSafeInteger(deadline) && deadline > now) {
    throw new AgentError('retry_pending', 'The saved request is waiting for the server cooldown.', {
      status: 429,
      retryable: true,
      execution: 'not_started',
      retryAfterSeconds: Math.ceil((deadline - now) / 1000),
      retryAt: deadline,
      remediation:
        'Wait for the saved deadline, then retry the same operation. No request was sent.',
    });
  }
}
