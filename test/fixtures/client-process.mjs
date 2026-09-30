import { createHash } from 'node:crypto';
import { AgentClient } from '../../src/client.mjs';
import { CredentialStore } from '../../src/store.mjs';
import { Transport } from '../../src/transport.mjs';
import { CommandJournal } from '../../src/commands.mjs';
import { runMcp } from '../../src/mcp.mjs';
const [mode, directory, origin, operationId] = process.argv.slice(2);
const client = new AgentClient(new Transport(origin), new CredentialStore({ directory }));
if (mode === 'refresh') {
  process.stdout.write(
    createHash('sha256')
      .update(await client.accessToken())
      .digest('hex'),
  );
} else if (mode === 'command') {
  process.stdout.write(JSON.stringify(await new CommandJournal(client).retry(operationId)));
} else if (mode === 'mcp') {
  await runMcp(client);
} else {
  process.exitCode = 2;
}
