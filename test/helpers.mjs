import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CredentialStore } from '../src/store.mjs';
import { Transport } from '../src/transport.mjs';
import { AgentClient, credentials } from '../src/client.mjs';
export const origin = 'http://127.0.0.1:9788';
export const tokens = (letter = 'a') => ({ access_token: `gta1.${'1'.repeat(64)}.wda_${letter.repeat(43)}`, refresh_token: `gta1.${'1'.repeat(64)}.wdr_${letter.repeat(43)}`, token_type: 'Bearer', expires_in: 900, connection_id: 'connection', profile_id: 'profile', session_id: 'session' });
export async function fixture(t, fetchImpl, { authenticated = true, expired = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new CredentialStore({ directory });
  if (authenticated) await store.locked(() => store.write(credentials(tokens(), origin, expired ? Date.now() - 1000000 : Date.now())));
  const transport = new Transport(origin, { fetchImpl });
  return { directory, store, transport, client: new AgentClient(transport, store) };
}
