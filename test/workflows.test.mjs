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
import { commandHelp } from '../src/commands.mjs';

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
    const canReadTasks = tool.inputSchema.properties.collection.enum.includes('tasks');
    assert.equal(Object.hasOwn(tool.inputSchema.properties, 'taskState'), canReadTasks);
    if (canReadTasks) {
      assert.deepEqual(tool.inputSchema.properties.taskState.enum, ['v1', 'v2']);
      assert.equal(tool.inputSchema.required.includes('taskState'), false);
    }
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
  const instructions = client.getInstructions();
  assert.match(instructions, /InProgress means current identifiable execution/);
  assert.match(instructions, /silence or lease expiry does not prove interruption/);
  const listed = (await client.listTools()).tools;
  for (const name of ['tasker_resources', 'tasker_changes', 'tasker_watch']) {
    const tool = listed.find((item) => item.name === name);
    assert.ok(tool, name);
    assert.deepEqual(tool.inputSchema.properties.taskState.enum, ['v1', 'v2']);
    assert.equal(tool.inputSchema.required.includes('taskState'), false);
  }
  assert.equal(
    Object.hasOwn(
      listed.find((item) => item.name === 'tasker_read_metrics').inputSchema.properties,
      'taskState',
    ),
    false,
  );
  for (const topic of ['projects', 'planning', 'protocols', 'runs', 'checklist']) {
    const result = await client.callTool({
      name: 'tasker_workflow',
      arguments: { topic },
    });
    assert.notEqual(result.isError, true);
    const texts = result.content.filter((item) => item.type === 'text');
    assert.equal(texts.length, 1);
    assert.deepEqual(JSON.parse(texts[0].text), workflow({ topic }));
  }
  for (const kind of [
    'protocol.publish',
    'project.configureInstructions',
    'task.create',
    'task.update',
    'task.lock',
    'task.unlock',
    'run.lock',
    'run.unlock',
    'task.pause',
    'task.resume',
    'run.pause',
    'run.resume',
    'checklist.create',
    'checklist.update',
    'checklist.move',
    'checklist.remove',
    'run.checklist',
  ]) {
    const help = await client.callTool({ name: 'tasker_command_help', arguments: { kind } });
    assert.notEqual(help.isError, true);
    assert.deepEqual(help.structuredContent.data, commandHelp({ kind }));
  }
  assert.equal(diagnostics, '');
  assert.deepEqual(await readdir(root), ['runtime']);
});
