import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

/** Shared by the product's real Worker integration check; never packaged. */
export async function connectFixtureMcp(directory, origin) {
  const client = new Client({ name: 'tasker-worker-acceptance', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('./client-process.mjs', import.meta.url)),
      'mcp',
      directory,
      origin,
    ],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close();
    throw error;
  }
  return { client, diagnostics: () => stderr };
}
