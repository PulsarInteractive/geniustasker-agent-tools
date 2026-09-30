/** Never forward raw network exceptions: URLs, HTML and provider diagnostics
 * can contain credentials. API messages are data, never terminal control. */
export class AgentError extends Error {
  constructor(code, message, { status = 0, retryable = false, remediation = 'Check help and retry.', ...details } = {}) {
    super(message); this.code = code; this.status = status; this.retryable = retryable;
    this.remediation = remediation; this.details = details;
  }
  toJSON() { return { code: this.code, message: this.message, retryable: this.retryable, remediation: this.remediation, ...this.details }; }
}
export const fail = (code, message, options) => { throw new AgentError(code, message, options); };
export function safeError(error) {
  return error instanceof AgentError ? error : new AgentError('internal_error', 'The command could not complete.', { remediation: 'Retry once; run doctor if the problem persists.' });
}
export function exitCode(error) {
  if (['invalid_arguments', 'invalid_origin'].includes(error.code)) return 2;
  if (error.status === 401 || ['not_authenticated', 'reauthentication_required', 'access_denied', 'expired_token', 'invalid_grant'].includes(error.code)) return 3;
  if (error.status === 403 || error.code === 'profile_selection_denied') return 4;
  if (error.status === 409 || error.code === 'profile_selection_conflict') return 5;
  if (error.status === 429) return 6;
  if (error.retryable) return 7;
  return 1;
}
