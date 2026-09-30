import { fail } from './errors.mjs';

export function credentials(result, origin, now = Date.now()) {
  const token = (value, kind) => typeof value === 'string' && new RegExp(`^gta1\\.[a-f0-9]{64}\\.wd${kind}_[A-Za-z0-9_-]{43}$`).test(value);
  if (!token(result?.access_token, 'a') || !token(result?.refresh_token, 'r') || result.token_type !== 'Bearer' ||
      !Number.isSafeInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 3600 ||
      ['connection_id', 'profile_id', 'session_id'].some(key => typeof result[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result[key])))
    fail('invalid_response', 'The authorization response was invalid.', { remediation: 'Revoke the new session in Account → Agents and retry login.' });
  return { formatVersion: 1, origin, clientId: 'geniustasker-cli',
    access_token: result.access_token, refresh_token: result.refresh_token, token_type: 'Bearer', expires_in: result.expires_in,
    connection_id: result.connection_id, profile_id: result.profile_id, session_id: result.session_id,
    expiresAt: now + result.expires_in * 1000, refreshPending: false };
}

export class AgentClient {
  constructor(transport, store) { this.transport = transport; this.store = store; }
  async session() {
    const session = await this.store.read();
    if (!session) fail('not_authenticated', 'This context is not connected.', { remediation: 'Run auth login with this context and environment.' });
    if (session.formatVersion !== 1 || session.origin !== this.transport.origin || session.clientId !== 'geniustasker-cli')
      fail('credential_origin_mismatch', 'This context belongs to another API environment.', { remediation: 'Select its original environment, or use a different --context for the new environment.' });
    // Validate private storage before ever sending any token to the network.
    credentials(session, session.origin);
    if (!Number.isSafeInteger(session.expiresAt)) fail('invalid_credential_store', 'The session expiry is invalid.');
    return session;
  }
  async authorizedSession() {
    return this.store.locked(async () => {
      const session = await this.session();
      if (session.refreshPending) fail('reauthentication_required', 'The previous renewal outcome is unknown.', { remediation: 'Run auth logout, then auth login. Do not replay the previous refresh token.' });
      if (session.expiresAt > Date.now() + 30000) return session;
      return this.renewLocked(session);
    }, this.transport.signal);
  }
  /** Only called while holding the credential store lock. Selection rotates
   * access and refresh together so an in-flight old command cannot acquire the
   * new profile's identity. It never extends the server's absolute lifetime. */
  async renewLocked(session, selection) {
    await this.store.write({ ...session, refreshPending: true });
    let result;
    try {
      result = await this.transport.oauth('token', { grant_type: 'refresh_token', refresh_token: session.refresh_token,
        ...(selection ? { profile_id: selection.profileId, profile_revision: String(selection.expectedRevision), source_revision: String(selection.expectedSourceRevision) } : {}) });
    } catch (error) {
      // These two server outcomes happen before token consumption/rotation.
      // Every other refusal or lost reply retains the uncertainty marker.
      if (selection && error?.status === 400 && ['profile_selection_conflict', 'profile_selection_denied'].includes(error.code)) {
        await this.store.write(session);
        error.remediation = 'List profiles again. Only a human can approve broader access; a changed profile requires a fresh selection.';
      }
      throw error;
    }
    const next = credentials(result, this.transport.origin);
    if (next.connection_id !== session.connection_id || next.profile_id !== (selection?.profileId ?? session.profile_id) || next.session_id !== session.session_id)
      fail('invalid_response', 'Renewal returned an unexpected identity.');
    await this.store.write(next);
    return next;
  }
  async selectProfile(selection) {
    return this.store.locked(async () => {
      const session = await this.session();
      if (session.refreshPending) fail('reauthentication_required', 'The previous renewal outcome is unknown.', { remediation: 'Run auth logout, then auth login; do not replay the previous refresh token.' });
      if (selection.sourceProfileId !== session.profile_id || selection.connectionId !== session.connection_id)
        fail('profile_selection_conflict', 'Another process changed this context.', { status: 409, remediation: 'Read profiles again. Use separate --context names for independent terminals.' });
      const next = await this.renewLocked(session, selection);
      return { connected: true, connectionId: next.connection_id, profileId: next.profile_id, sessionId: next.session_id };
    }, this.transport.signal);
  }
  async accessToken() { return (await this.authorizedSession()).access_token; }
  async get(resource, query) {
    if (!['me', 'capabilities', 'projects', 'memories', 'resources', 'profiles', 'answers', 'changes'].includes(resource)) fail('invalid_arguments', 'Unknown delegated resource.');
    const token = await this.accessToken();
    // No blanket retries, no automatic writes. Revocation and ACL errors remain
    // visible to the agent. A caller chooses how to recover using the envelope.
    return this.transport.request(`/api/agents/v1/${resource}`, { token, query });
  }
  async logout() {
    return this.store.locked(async () => {
      if (!await this.store.read()) return { connected: false, alreadyDisconnected: true };
      const session = await this.session();
      // Keep credentials on failure so revocation can be retried. A used refresh
      // token can revoke a family whose rotation response was lost.
      await this.transport.oauth('revoke', { token: session.refresh_token, token_type_hint: 'refresh_token' });
      await this.store.remove();
      return { connected: false, revoked: true };
    }, this.transport.signal);
  }
  async doctor() {
    const session = await this.store.read();
    return { node: process.versions.node, origin: this.transport.origin, connectedLocally: Boolean(session),
      sameEnvironment: session ? session.origin === this.transport.origin : null,
      needsLogin: session ? session.refreshPending === true : true, storage: 'private OS-user file',
      publication: 'local preview; npm distribution is not enabled', writes: 'Discover server capabilities before attempting changes.' };
  }
}
