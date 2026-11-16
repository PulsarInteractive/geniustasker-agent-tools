import test from 'node:test';
import assert from 'node:assert/strict';
import guides from '../remote/workflows.json' with { type: 'json' };
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { workflow } from '../src/workflows.mjs';
import { main } from '../src/cli.mjs';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('workflow discovery is exhaustive, bounded, and rejects unknown topics', async () => {
  const tool = tools.find((t) => t.name.endsWith('_workflow'));
  assert.deepEqual(tool.inputSchema.properties.topic.enum, Object.keys(guides.topics));
  assert.equal(tool.write, undefined);
  for (const topic of Object.keys(guides.topics)) {
    const result = workflow({ topic });
    assert.equal(result.version, guides.version);
    assert.ok(result.title && result.steps.length >= 4);
    assert.ok(JSON.stringify(result).length < 10000);
    const output = [];
    const status = await main(['workflow', 'show', '--topic', topic, '--json'], {
      stdout: { write: (value) => output.push(value) },
      stderr: { write: () => {} },
      fetchImpl: () => {
        throw Error('Static guidance must not contact the API');
      },
    });
    assert.equal(status, 0);
    assert.deepEqual(JSON.parse(output.join('')).data, result);
  }
  for (const input of [
    { topic: 'unknown' },
    { topic: 'connection', url: 'https://example.test' },
    {},
  ]) {
    assert.throws(() => workflow(input));
  }
});

test('hosted archive filters use the API values, not boolean strings', () => {
  for (const tool of tools.filter((t) => t.route === 'resources')) {
    assert.deepEqual(tool.inputSchema.properties.archive.enum, ['active', 'archived', 'all']);
  }
});

test('project guidance is served intact by real local MCP without credentials or account reads', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'tasker-workflow-'));
  const client = new Client({ name: 'workflow-distribution-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('fixtures/update-mcp-process.mjs', import.meta.url)),
      join(root, 'runtime'),
      join(root, 'credentials'),
    ],
    stderr: 'pipe',
  });
  t.after(async () => {
    await client.close();
    await rm(root, { recursive: true, force: true });
  });
  let diagnostics = '';
  transport.stderr?.on('data', (value) => {
    diagnostics += value.toString();
  });
  await client.connect(transport);
  const result = await client.callTool({
    name: 'tasker_workflow',
    arguments: { topic: 'projects' },
  });
  assert.notEqual(result.isError, true);
  const texts = result.content.filter((item) => item.type === 'text');
  assert.equal(texts.length, 1);
  assert.deepEqual(JSON.parse(texts[0].text), workflow({ topic: 'projects' }));
  assert.equal(diagnostics, '');
  assert.deepEqual(await readdir(root), ['runtime']);
});
