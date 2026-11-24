import test from 'node:test';
import assert from 'node:assert/strict';
import guides from '../remote/workflows.json' with { type: 'json' };

import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { workflow } from '../src/workflows.mjs';
import { withFeedbackDiscovery } from '../src/presentation.mjs';
import { main } from '../src/cli.mjs';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { commandHelp } from '../src/commands.mjs';

test('host-discovered workflows teach ticket parentage and identify the quota on a refused first write', () => {
  for (const topic of ['first-mission', 'projects', 'planning', 'project-work']) {
    const steps = workflow({ topic }).steps.join(' ');
    for (const term of ['Epic', 'Ticket', 'Subtask', 'immediate parent']) {
      assert.ok(steps.includes(term), topic + ' is missing ' + term);
    }
  }
  for (const topic of ['storage', 'storage-cleanup']) {
    const steps = workflow({ topic }).steps.join(' ');
    assert.match(steps, /account_data/);
    assert.match(steps, /media_storage/);
  }
  const cleanup = workflow({ topic: 'storage-cleanup' }).steps.join(' ');
  assert.match(cleanup, /documentContent/);
  assert.match(cleanup, /index_incomplete/);
  assert.match(
    workflow({ topic: 'guide-components' }).steps.join(' '),
    /text cards.*tasker_memory_view_image/,
  );
});

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

test('the base Memory guide covers safe imports and clients with a limited topic list', () => {
  const instructions = workflow({ topic: 'memory' }).steps.join(' ');
  assert.match(instructions, /UUID v4.*both id and epoch/);
  assert.match(instructions, /checkpoint, epoch and continuation/);
  assert.match(instructions, /existing note in its language and style/);
});

test('Documentation pages and published Skills have distinct workflows while the previous procedure topic retains its meaning', () => {
  const reference = workflow({ topic: 'memory' });
  const skill = workflow({ topic: 'space-skills' });
  const prior = workflow({ topic: 'space-guides' });
  assert.deepEqual({ ...prior, topic: 'space-skills' }, skill);
  assert.match(reference.steps.join(' '), /parentId/);
  assert.match(reference.examples.fr, /dans Documentation/);
  assert.match(skill.examples.fr, /skill publiée/);
  assert.match(skill.steps.join(' '), /Skills space \(kind playbooks\).*status=published/);
  const projectWork = workflow({ topic: 'project-work' }).summary;
  assert.match(projectWork, /Documentation.*library.*Skills.*playbooks/);
  assert.doesNotMatch(projectWork, /\bGuides\b/);
});

test('CLI workflow help lists the actual topics and an invalid selection reports a usage error', async () => {
  for (const args of [['--help'], [], ['--topic', 'checklists']]) {
    let output = '';
    let error = '';
    const status = await main(['workflow', 'show', ...args, '--json'], {
      stdout: { write: (value) => (output += value) },
      stderr: { write: (value) => (error += value) },
      fetchImpl: () => assert.fail('Workflow discovery must stay offline'),
    });
    if (args.includes('--help')) {
      assert.equal(status, 0);
      assert.equal(error, '');
      assert.deepEqual(
        JSON.parse(output).data.commands['workflow show'].topics,
        Object.keys(guides.topics),
      );
    } else {
      assert.equal(status, 2);
      assert.equal(output, '');
      const result = JSON.parse(error);
      assert.equal(result.error.code, 'invalid_arguments');
      assert.equal(result.error.retryable, false);
      assert.match(result.error.remediation, /workflow show --help/);
    }
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
  assert.ok(instructions.includes(workflow({ topic: 'project-work' }).summary));
  assert.match(instructions, /InProgress means current identifiable execution/);
  assert.match(instructions, /silence or lease expiry does not prove interruption/);
  assert.match(instructions, /run\.claim can leave a task New.*run\.patch.*read the task back/);
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
  for (const topic of ['projects', 'planning', 'protocols', 'runs', 'checklist', 'project-work']) {
    const result = await client.callTool({
      name: 'tasker_workflow',
      arguments: { topic },
    });
    assert.notEqual(result.isError, true);
    const texts = result.content.filter((item) => item.type === 'text');
    assert.equal(texts.length, 1);
    assert.deepEqual(JSON.parse(texts[0].text), workflow({ topic }));
    if (topic === 'project-work') {
      const { steps, examples } = result.structuredContent.data;
      assert.match(steps.join(' '), /incomplete result cannot establish absence/i);
      assert.match(steps.join(' '), /another ticket’s actual output is required/);
      assert.match(steps.join(' '), /operationId, receipt and returned identifiers/);
      assert.ok(examples.some(({ action }) => action.includes('No ticket or status change')));
      assert.ok(examples.some(({ action }) => action.includes('Reuse the matching open ticket')));
      assert.ok(examples.some(({ action }) => action.includes('pending Design link')));
    }
    if (topic === 'runs') {
      const start = result.structuredContent.data.steps.find((step) =>
        step.includes('Working run while the task stays New'),
      );
      assert.ok(start);
      for (const term of [
        'expectedRevision',
        'taskRevision',
        'status: "InProgress"',
        'Read the task again',
        'run.resume',
        'locks',
      ]) {
        assert.ok(start.includes(term), 'Missing claimed-task start guidance: ' + term);
      }
    }
    if (topic === 'checklist') {
      const guidance = result.structuredContent.data.steps.join(' ');
      for (const term of [
        'agentRuns',
        'affectedCollections',
        'itemId',
        'tasker_retry_command',
        'tasker_edit_tasks',
      ]) {
        assert.ok(guidance.includes(term), 'Missing public checklist guidance: ' + term);
      }
    }
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

test('first mission discovery uses the current grant and advertises only supported run commands', () => {
  const readOnly = withFeedbackDiscovery({
    permissions: ['tasks:read'],
    commands: [],
  }).firstMission;
  assert.equal(readOnly.canListProjects, false);
  assert.equal(readOnly.canReadTickets, true);
  assert.deepEqual(readOnly.runCommands, []);
  const partial = withFeedbackDiscovery({
    permissions: ['projects:read', 'tasks:read', 'tasks:write'],
    commands: [{ kind: 'run.claim' }, { kind: 'task.update' }, { kind: 'run.patch' }],
  }).firstMission;
  assert.deepEqual(partial.runCommands, ['run.claim', 'run.patch']);
  const guide = workflow({ topic: partial.workflowTopic });
  const instructions = guide.steps.join(' ');
  for (const operation of [
    'tasker_identity',
    'agentsEnabled',
    'run.pause',
    'run.resume',
    'run.finish',
    'NeedsReview',
  ]) {
    assert.ok(instructions.includes(operation));
  }
});
