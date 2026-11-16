import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { acquireRuntime, acquireInstallation } from '../src/update-runtime.mjs';
import { installUpdate } from '../src/update.mjs';
import { main } from '../src/cli.mjs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'tasker-update-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('parallel operations block installation; writer prevents new work until released', async (t) => {
  const root = await directory(t);
  const [a, b] = await Promise.all([acquireRuntime(root), acquireRuntime(root)]);
  await assert.rejects(acquireInstallation(root), { code: 'update_runtime_busy' });
  await a();
  await assert.rejects(acquireInstallation(root), { code: 'update_runtime_busy' });
  await b();
  const writer = await acquireInstallation(root);
  await assert.rejects(acquireRuntime(root), { code: 'update_runtime_busy' });
  await assert.rejects(acquireInstallation(root), { code: 'update_runtime_busy' });
  assert.deepEqual(await readdir(join(root, 'active')), []);
  await writer();
  const next = await acquireRuntime(root);
  await next();
});
test('competing admissions never admit an installer alongside a reader', async (t) => {
  const root = await directory(t);
  for (let i = 0; i < 12; i++) {
    const result = await Promise.allSettled([acquireRuntime(root), acquireInstallation(root)]);
    assert.ok(result.some((x) => x.status === 'rejected'));
    for (const r of result) {
      if (r.status === 'fulfilled') {
        await r.value();
      } else {
        assert.equal(r.reason.code, 'update_runtime_busy');
      }
    }
  }
});
test('active command cannot be replaced and its private journal remains byte-for-byte unchanged', async (t) => {
  const root = await directory(t),
    runtimeDirectory = join(root, 'runtime');
  const globalRoot = join(root, 'node_modules');
  const installedDirectory = join(globalRoot, '@pulsarinteractive', 'geniustasker');
  await mkdir(installedDirectory, { recursive: true });
  const privateFile = join(root, 'immutable-operation.json');
  await writeFile(privateFile, '{"state":"uncertain","operationId":"saved"}');
  const before = await readFile(privateFile);
  const release = await acquireRuntime(runtimeDirectory);
  let installs = 0;
  await assert.rejects(
    installUpdate({
      installedDirectory,
      runtimeDirectory,
      fetchImpl: () =>
        Response.json({ name: '@pulsarinteractive/geniustasker', version: '99.0.0' }),
      npmImpl: async (args) => {
        if (args[0] === 'install') {
          installs++;
        }
        return { stdout: globalRoot };
      },
    }),
    { code: 'update_runtime_busy' },
  );
  assert.equal(installs, 0);
  assert.deepEqual(await readFile(privateFile), before);
  await release();
});
test('a held installer blocks the CLI before authentication or API work', async (t) => {
  const runtimeDirectory = await directory(t),
    release = await acquireInstallation(runtimeDirectory);
  const out = [],
    err = [];
  const code = await main(['whoami', '--json'], {
    runtimeDirectory,
    stdout: { write: (x) => out.push(x) },
    stderr: { write: (x) => err.push(x) },
    fetchImpl: () => assert.fail('No API access while installation is in progress'),
  });
  assert.equal(code, 5);
  assert.equal(out.length, 0);
  assert.equal(JSON.parse(err[0]).error.code, 'update_runtime_busy');
  await release();
});
test('dead-process leases are reclaimed; a crashed installer remains explicit and fails closed', async (t) => {
  const root = await directory(t),
    active = join(root, 'active');
  await mkdir(active, { mode: 0o700 });
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  const pid = child.pid;
  await once(child, 'exit');
  await writeFile(join(active, `${pid}-${randomUUID()}.lock`), '', { mode: 0o600 });
  const release = await acquireInstallation(root);
  assert.deepEqual(await readdir(active), []);
  await release();
  await mkdir(join(root, 'install.lock'));
  await assert.rejects(acquireRuntime(root), { code: 'update_runtime_busy' });
  await assert.rejects(acquireInstallation(root), { code: 'update_runtime_busy' });
});
test('real stdio MCP holds its process lease even after main returns and writes no update notice', async (t) => {
  const root = await directory(t),
    runtimeDirectory = join(root, 'runtime');
  const script = fileURLToPath(new URL('fixtures/update-mcp-process.mjs', import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [script, runtimeDirectory, join(root, 'credentials')],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'tasker-update-runtime-test', version: '1.0.0' });
  let errors = '';
  transport.stderr?.on('data', (b) => {
    errors += b.toString();
  });
  t.after(async () => {
    await client.close();
  });
  await client.connect(transport);
  const listed = await client.listTools();
  assert.ok(listed.tools.some((tool) => tool.name === 'tasker_capabilities'));
  await assert.rejects(acquireInstallation(runtimeDirectory), { code: 'update_runtime_busy' });
  assert.equal(errors, '');
  await client.close();
  // close() waits for the child exit; the normal exit handler releases its lease.
  const release = await acquireInstallation(runtimeDirectory);
  await release();
});
