import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import schemas from '../src/command-input-schemas.mjs';
import { commandHelp, CommandJournal } from '../src/commands.mjs';
import { workflow } from '../src/workflows.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fixture } from './helpers.mjs';

test('run examples use the generated public schemas and distinguish reports from human controls', async () => {
  const guide = await readFile(
    new URL('../skills/geniustasker/references/agent-runs.md', import.meta.url),
    'utf8',
  );
  const [claim, checkpoint, patch] = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  const validate = (kind) => new Ajv({ strict: true }).compile(commandHelp({ kind }).dataSchema);
  assert.equal(validate('run.claim')(claim), true);
  assert.equal(validate('run.checkpoint')(checkpoint), true);
  assert.equal(validate('run.patch')(patch), true);
  assert.equal(validate('run.claim')({ ...claim, leaseSeconds: 901 }), false);
  assert.equal(validate('run.claim')({ ...claim, profile: 'another-agent' }), false);
  assert.equal(validate('run.checkpoint')({ ...checkpoint, state: 'Completed' }), false);
  assert.equal(
    validate('run.finish')({ state: 'Completed', summary: 'Verified work is complete.' }),
    true,
  );
  for (const state of ['Working', 'TakenOver', 'Superseded', 'Expired']) {
    assert.equal(validate('run.finish')({ state, summary: 'No human impersonation.' }), false);
  }
  assert.ok(!JSON.stringify(schemas).includes('x-web-core-'));
  const guidance = JSON.stringify(workflow({ topic: 'runs' }));
  assert.match(guidance, /stale/);
  assert.match(guidance, /does not|neither starts/);
  assert.match(guidance, /immutable/);
  assert.match(guidance, /human/i);
});

test('hosted generic and permission-specific discovery include runs without exposing human takeover', () => {
  const names = ['run.claim', 'run.checkpoint', 'run.finish', 'run.patch'];
  for (const name of [
    'tasker_command_help',
    'tasker_prepare_command',
    'tasker_execute_command',
    'tasker_edit_tasks',
  ]) {
    const tool = tools.find((tool) => tool.name === name);
    for (const kind of names) {
      assert.ok(tool.inputSchema.properties.kind.enum.includes(kind), `${name}: ${kind}`);
    }
    assert.ok(
      !tool.inputSchema.properties.kind.enum.some((kind) => /takeover|cancelRun/.test(kind)),
    );
  }
  for (const name of ['tasker_resources', 'tasker_read_tasks']) {
    assert.ok(
      tools
        .find((tool) => tool.name === name)
        .inputSchema.properties.collection.enum.includes('agentRuns'),
    );
  }
});

test('the ordinary immutable journal sends run commands individually and keeps run/task revisions distinct', async (t) => {
  const runId = crypto.randomUUID(),
    task = 'task-a',
    calls = [];
  const dataByKind = {
    'run.claim': {
      task,
      taskRevision: '7',
      summary: 'Check accepted behavior.',
      leaseSeconds: 300,
    },
    'run.checkpoint': {
      state: 'Working',
      summary: 'Targeted tests executed.',
      nextSteps: 'Review the result.',
      evidence: [],
    },
    'run.patch': { taskRevision: '8', patch: { description: 'Verified acceptance criteria.' } },
    'run.finish': {
      state: 'Completed',
      summary: 'Requested verification is complete.',
      evidence: [],
    },
  };
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    assert.equal(options.method, 'POST');
    const input = JSON.parse(options.body);
    calls.push(input);
    assert.equal(input.id, runId);
    assert.equal(input.scope, 'project:work');
    assert.equal(input.expectedRevision, calls.length === 1 ? null : String(calls.length));
    return Response.json({
      operationId: input.operationId,
      scope: input.scope,
      kind: input.kind,
      epoch: input.epoch,
      cursor: String(calls.length + 1),
      items: [
        { id: runId, revision: String(calls.length + 1), collection: 'agentRuns', deleted: false },
      ],
      affectedCollections: input.kind === 'run.patch' ? ['agentRuns', 'tasks'] : ['agentRuns'],
    });
  });
  const journal = new CommandJournal(f.client);
  for (const [kind, data] of Object.entries(dataByKind)) {
    const expected = calls.length;
    const prepared = await journal.prepare({
      kind,
      data,
      id: runId,
      scope: 'project:work',
      epoch: 'current-epoch',
      expectedRevision: expected ? String(expected + 1) : null,
    });
    assert.equal(calls.length, expected, 'Preparing a run is not execution or a heartbeat');
    const result = await journal.execute(prepared.request);
    assert.equal(calls.length, expected + 1);
    assert.deepEqual(calls.at(-1), prepared.request);
    assert.ok(result);
    const saved = await journal.inspect(prepared.operationId);
    assert.deepEqual(saved.request, prepared.request);
  }
  assert.equal(calls[2].data.taskRevision, '8');
  assert.equal(calls[2].expectedRevision, '3');
  assert.deepEqual(
    calls.map((call) => call.kind),
    Object.keys(dataByKind),
  );
});
