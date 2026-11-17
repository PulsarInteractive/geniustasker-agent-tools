import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommandJournal, commandHelp, validateCommand } from '../src/commands.mjs';
import { main } from '../src/cli.mjs';
import { fixture } from './helpers.mjs';

const draft = (instructions = 'Describe verified work.\nPreserve human decisions.') => ({
  kind: 'project.configureInstructions',
  scope: 'project:work',
  id: 'work',
  epoch: 'test-epoch',
  expectedRevision: '7',
  data: { instructions },
});
const command = (instructions) => ({
  ...draft(instructions),
  operationId: randomUUID(),
  issuedAt: Date.now(),
});

test('project instruction help and validation expose only bounded replacement text', async () => {
  const help = commandHelp({ kind: 'project.configureInstructions' });
  assert.equal(help.permission, 'projects:write');
  assert.deepEqual(help.fields, ['instructions']);
  assert.deepEqual(help.requiredFields, ['instructions']);
  assert.equal(help.properties.instructions.maxLength, 12000);
  for (const text of ['', '界'.repeat(12000), '\tNotes\nline\rbreak']) {
    assert.equal(validateCommand(command(text)).data.instructions, text);
  }
  for (const text of ['x'.repeat(12001), 'control\u0000', 'control\u007f']) {
    assert.throws(() => validateCommand(command(text)), { code: 'invalid_arguments' });
  }
  for (const data of [
    {},
    { instructions: null },
    { instructions: 'Keep', enabled: true },
    { instructions: 'Keep', agentsEnabled: true },
    { instructions: 'Keep', grant: {} },
    { instructions: 'Keep', membership: [] },
    { agentInstructions: 'Keep' },
  ]) {
    assert.throws(() => validateCommand({ ...command(), data }), { code: 'invalid_arguments' });
  }
  assert.throws(() => validateCommand({ ...command(), expectedRevision: null }), {
    code: 'invalid_arguments',
  });
  let output = '';
  assert.equal(
    await main(['commands', 'describe', '--kind', 'project.configureInstructions', '--json'], {
      stdout: { write: (value) => (output += value) },
      stderr: { write: () => assert.fail('Unexpected diagnostic') },
      fetchImpl: () => assert.fail('Command help is local'),
      updateFetchImpl: () => assert.fail('No update check'),
    }),
    0,
  );
  assert.deepEqual(JSON.parse(output).data, help);
});

test('instruction replacement preserves exact journal intent after uncertainty and supports normal project readback', async (t) => {
  const requests = [];
  let stored = 'Previous instructions';
  const f = await fixture(t, async (url, options) => {
    if (url.pathname === '/api/agents/v1/resources') {
      assert.equal(options.method, 'GET');
      assert.equal(url.searchParams.get('collection'), 'project');
      assert.equal(url.searchParams.get('id'), 'work');
      return Response.json({
        scope: 'project:work',
        collection: 'project',
        epoch: 'test-epoch',
        checkpoint: '8',
        items: [
          { id: 'work', revision: '8', data: { agentInstructions: stored, agentsEnabled: true } },
        ],
        nextAfter: null,
        omittedIds: [],
        changeCursor: null,
      });
    }
    assert.equal(url.pathname, '/api/agents/v1/commands');
    const input = JSON.parse(options.body);
    requests.push(input);
    assert.deepEqual(Object.keys(input.data), ['instructions']);
    stored = input.data.instructions.trim();
    if (requests.length === 1) {
      throw Error('Synthetic lost reply after commit');
    }
    return Response.json({
      operationId: input.operationId,
      scope: input.scope,
      epoch: input.epoch,
      kind: input.kind,
      cursor: '8',
      items: [{ id: 'work', revision: '8', collection: 'project', deleted: false }],
      affectedCollections: ['project'],
    });
  });
  const journal = new CommandJournal(f.client),
    prepared = await journal.prepare(draft());
  assert.equal(requests.length, 0);
  await assert.rejects(journal.retry(prepared.operationId), { code: 'network_unavailable' });
  await journal.retry(prepared.operationId);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal((await journal.retry(prepared.operationId)).source, 'local_receipt');
  assert.equal(requests.length, 2);
  const project = await f.client.get('resources', {
    scope: 'project:work',
    collection: 'project',
    id: 'work',
  });
  assert.equal(project.items[0].data.agentInstructions, prepared.request.data.instructions);
  assert.equal(project.items[0].data.agentsEnabled, true);
  await assert.rejects(
    journal.execute({ ...prepared.request, data: { instructions: 'Unrelated rewrite' } }),
    { code: 'idempotency_mismatch' },
  );
});
