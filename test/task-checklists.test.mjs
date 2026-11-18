import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { randomUUID } from 'node:crypto';
import { commandHelp, validateCommand, CommandJournal } from '../src/commands.mjs';
import { readResources, readMetrics } from '../src/resources.mjs';
import { main } from '../src/cli.mjs';
import { fixture } from './helpers.mjs';
const kinds = [
  'checklist.create',
  'checklist.update',
  'checklist.move',
  'checklist.remove',
  'run.checklist',
];
const scope = 'project:work',
  task = 'legacy-task-id',
  item = randomUUID(),
  neighbor = randomUUID();
const operation = (kind, data) => ({
  operationId: randomUUID(),
  issuedAt: Date.now(),
  scope,
  epoch: 'epoch',
  id: item,
  expectedRevision: kind === 'checklist.create' ? null : '7',
  kind,
  data,
});
test('checklist help exposes exact parent/item/run fences and public commands validate data before network', () => {
  const check = Object.fromEntries(
    kinds.map((kind) => {
      const help = commandHelp({ kind });
      assert.equal(help.permission, 'tasks:write');
      assert.equal(help.dataSchema.additionalProperties, false);
      assert.deepEqual(Object.keys(help.properties), help.fields);
      return [kind, new Ajv({ strict: true }).compile(help.dataSchema)];
    }),
  );
  assert.equal(check['checklist.create']({ task, title: 'Milestone', sectionId: item }), true);
  assert.equal(
    check['checklist.create']({ task, title: 'Milestone', sectionId: 'unknown section' }),
    false,
  );
  for (const title of ['Step', 'x'.repeat(240)]) {
    assert.equal(check['checklist.create']({ task, title }), true);
  }
  for (const title of ['', null, 'x'.repeat(241)]) {
    assert.equal(check['checklist.create']({ task, title }), false);
  }
  for (const checked of [false, true]) {
    assert.equal(check['checklist.update']({ task, checked }), true);
    assert.deepEqual(validateCommand(operation('checklist.update', { task, checked })).data, {
      task,
      checked,
    });
  }
  for (const [kind, data] of [
    ['checklist.create', { title: 'step' }],
    ['checklist.update', { checked: true }],
    ['checklist.move', { task, neighborId: neighbor }],
    ['checklist.remove', {}],
    ['checklist.update', { task, toggle: true }],
    ['checklist.update', { task, checked: 'false' }],
    ['checklist.remove', { task, action: 'removeChecklistItem' }],
  ]) {
    assert.equal(check[kind](data), false);
    assert.throws(() => validateCommand(operation(kind, data)), { code: 'invalid_arguments' });
  }
  assert.equal(
    check['checklist.move']({ task, neighborId: neighbor, neighborRevision: '8' }),
    true,
  );
  assert.equal(check['checklist.remove']({ task }), true);
  for (const [action, data] of [
    ['createChecklistItem', { title: 'step' }],
    ['updateChecklistItem', { checked: false }],
    ['moveChecklistItem', { neighborId: neighbor, neighborRevision: '8' }],
    ['removeChecklistItem', {}],
  ]) {
    const change = { action, task, ...data };
    const body = {
      taskRevision: '9',
      itemId: item,
      itemRevision: action === 'createChecklistItem' ? null : '7',
      change,
    };
    assert.equal(check['run.checklist'](body), true);
    assert.deepEqual(validateCommand(operation('run.checklist', body)).data, body);
    assert.equal(
      check['run.checklist']({ ...body, change: { ...change, task: undefined } }),
      false,
    );
    assert.equal(
      check['run.checklist']({ ...body, change: { ...change, action: 'toggleChecklistItem' } }),
      false,
    );
  }
});
test('generated command data limits reject oversized descriptions before journaling and preserve valid exact input', async (t) => {
  const f = await fixture(t, () => assert.fail('Invalid command must not contact a server'));
  const journal = new CommandJournal(f.client);
  for (const kind of ['task.create', 'task.update']) {
    const base = operation(kind, { title: 'Task', description: 'x'.repeat(601) });
    if (kind === 'task.create') {
      base.expectedRevision = null;
    }
    assert.throws(() => validateCommand(base), { code: 'invalid_arguments' });
    const { operationId, issuedAt, ...draft } = base;
    assert.ok(operationId && issuedAt);
    await assert.rejects(journal.prepare(draft), { code: 'invalid_arguments' });
    const valid = { ...base, data: { ...base.data, description: 'x'.repeat(600) } };
    assert.deepEqual(validateCommand(valid), valid);
  }
});
test('checklist parent filter is explicit, cache-separated and carried through CLI pagination', async (t) => {
  const counts = new Map();
  const f = await fixture(t, async (url) => {
    assert.equal(url.pathname, '/api/agents/v1/resources');
    assert.equal(url.searchParams.get('collection'), 'checklist');
    const parent = url.searchParams.get('taskId');
    assert.ok(['legacy-task-id', 'other-task'].includes(parent));
    const after = url.searchParams.get('after');
    if (after) {
      assert.equal(parent, task);
      assert.equal(url.searchParams.get('epoch'), 'epoch');
      assert.equal(url.searchParams.get('checkpoint'), '20');
    }
    const key = parent + (after ?? '');
    const previous = counts.get(key) ?? 0;
    counts.set(key, previous + 1);
    assert.equal(url.searchParams.get('ifNoneMatch'), previous ? key : null);
    return Response.json({
      scope,
      collection: 'checklist',
      epoch: 'epoch',
      checkpoint: '20',
      etag: key,
      notModified: previous > 0,
      items: previous
        ? []
        : [
            {
              id: item,
              revision: '7',
              data: { task: parent, title: 'Step', checked: false, order: 0 },
            },
          ],
      omittedIds: [],
      nextAfter: after ? null : 'next',
      changeCursor: null,
    });
  });
  for (let round = 0; round < 2; round++) {
    for (const taskId of [task, 'other-task']) {
      const result = await readResources(f.client, { scope, collection: 'checklist', taskId });
      assert.equal(result.items[0].data.task, taskId);
      assert.equal(result.changeCursor, null);
    }
  }
  let stdout = '',
    stderr = '';
  const status = await main(
    [
      'resources',
      'list',
      '--scope',
      scope,
      '--collection',
      'checklist',
      '--task-id',
      task,
      '--after',
      'next',
      '--epoch',
      'epoch',
      '--checkpoint',
      '20',
      '--origin',
      f.transport.origin,
      '--allow-local',
      '--json',
    ],
    {
      directory: f.directory,
      fetchImpl: f.transport.fetch,
      stdout: { write: (v) => (stdout += v) },
      stderr: { write: (v) => (stderr += v) },
    },
  );
  assert.equal(status, 0, stderr);
  assert.equal(JSON.parse(stdout).data.nextAfter, null);
});
test('unbounded checklist and wrong taskId collections fail before authentication; exact item reads remain supported', async (t) => {
  const f = await fixture(t, () => assert.fail('Invalid read must not contact a server'), {
    authenticated: false,
  });
  for (const query of [
    { collection: 'checklist' },
    { collection: 'tasks', taskId: task },
    { collection: 'comments', taskId: task },
    { collection: 'checklist', taskId: '' },
  ]) {
    await assert.rejects(readResources(f.client, { scope, ...query }), {
      code: 'invalid_arguments',
    });
  }
  await assert.rejects(readMetrics(f.client, { scope, collection: 'metrics', taskId: task }), {
    code: 'invalid_arguments',
  });
  const reader = await fixture(t, async (url) => {
    assert.equal(url.searchParams.get('id'), item);
    assert.equal(url.searchParams.has('taskId'), false);
    return Response.json({
      scope,
      collection: 'checklist',
      epoch: 'epoch',
      items: [{ id: item, data: { task, checked: false } }],
    });
  });
  assert.equal(
    (await readResources(reader.client, { scope, collection: 'checklist', id: item })).items[0].id,
    item,
  );
});
function checklistReceipt(input, removed = false) {
  const claimed = input.kind === 'run.checklist';
  return {
    operationId: input.operationId,
    scope,
    kind: input.kind,
    epoch: 'epoch',
    cursor: '20',
    affectedCollections: claimed ? ['agentRuns', 'tasks', 'checklist'] : ['tasks', 'checklist'],
    items: [
      {
        collection: claimed ? 'agentRuns' : 'checklist',
        id: input.id,
        revision: '20',
        deleted: !claimed && removed,
      },
    ],
  };
}
test('an uncertain desired checkbox value replays one immutable direct or claimed operation', async (t) => {
  const calls = new Map();
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    const input = JSON.parse(options.body),
      prior = calls.get(input.operationId) ?? [];
    prior.push(input);
    calls.set(input.operationId, prior);
    if (prior.length === 1) {
      throw Error('Synthetic response lost');
    }
    return Response.json(checklistReceipt(input));
  });
  const journal = new CommandJournal(f.client);
  for (const kind of ['checklist.update', 'run.checklist']) {
    const data =
      kind === 'checklist.update'
        ? { task, checked: false }
        : {
            taskRevision: '10',
            itemId: item,
            itemRevision: '7',
            change: { action: 'updateChecklistItem', task, checked: false },
          };
    const prepared = await journal.prepare({
      scope,
      epoch: 'epoch',
      kind,
      id: kind === 'run.checklist' ? 'run-id' : item,
      expectedRevision: '7',
      data,
    });
    await assert.rejects(journal.retry(prepared.operationId), { code: 'network_unavailable' });
    await journal.retry(prepared.operationId);
    assert.equal((await journal.retry(prepared.operationId)).source, 'local_receipt');
    const requests = calls.get(prepared.operationId);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.deepEqual(requests[0].data, data);
  }
});

test('direct removal returns the item tombstone and claimed removal returns the primary run on exact retry', async (t) => {
  assert.equal(commandHelp({ kind: 'checklist.remove' }).delete, true);
  assert.notEqual(commandHelp({ kind: 'run.checklist' }).delete, true);
  const requests = new Map();
  const f = await fixture(t, async (_url, options) => {
    const input = JSON.parse(options.body);
    const calls = requests.get(input.operationId) ?? [];
    calls.push(input);
    requests.set(input.operationId, calls);
    if (calls.length === 1) {
      throw Error('Synthetic deletion acknowledgement lost');
    }
    return Response.json(checklistReceipt(input, true));
  });
  const journal = new CommandJournal(f.client);
  for (const kind of ['checklist.remove', 'run.checklist']) {
    const data =
      kind === 'checklist.remove'
        ? { task }
        : {
            taskRevision: '10',
            itemId: item,
            itemRevision: '7',
            change: { action: 'removeChecklistItem', task },
          };
    const prepared = await journal.prepare({
      scope,
      epoch: 'epoch',
      kind,
      id: kind === 'run.checklist' ? 'run-id' : item,
      expectedRevision: '7',
      data,
    });
    await assert.rejects(journal.retry(prepared.operationId), { code: 'network_unavailable' });
    const result = await journal.retry(prepared.operationId);
    const entry = result.receipt.items[0];
    assert.equal(entry.id, prepared.request.id);
    assert.equal(entry.deleted, kind === 'checklist.remove');
    assert.equal(entry.collection, kind === 'checklist.remove' ? 'checklist' : 'agentRuns');
    const recovered = await journal.retry(prepared.operationId);
    assert.equal(recovered.source, 'local_receipt');
    assert.deepEqual(recovered.receipt, result.receipt);
    const calls = requests.get(prepared.operationId);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.deepEqual(calls[0].data, data);
  }
});

test('a claimed create recovers its saved item ID after a lost acknowledgement and reads current progress', async (t) => {
  let committed;
  let attempts = 0;
  const f = await fixture(t, async (url, options) => {
    if (url.pathname === '/api/agents/v1/commands') {
      const request = JSON.parse(options.body);
      attempts++;
      if (!committed) {
        committed = request;
        throw Error('Synthetic acknowledgement lost after create');
      }
      assert.deepEqual(request, committed);
      return Response.json(checklistReceipt(committed));
    }
    assert.equal(url.pathname, '/api/agents/v1/resources');
    assert.equal(url.searchParams.get('scope'), scope);
    const collection = url.searchParams.get('collection');
    const id = url.searchParams.get('id');
    const { itemId, change } = committed.data;
    if (collection === 'checklist' && id === itemId) {
      return Response.json({
        scope,
        collection,
        epoch: 'epoch',
        items: [
          { id, revision: '20', data: { task: change.task, title: change.title, checked: false } },
        ],
      });
    }
    assert.equal(collection, 'tasks');
    assert.equal(id, change.task);
    return Response.json({
      scope,
      collection,
      epoch: 'epoch',
      items: [{ id, revision: '21', data: { checklistCount: 4, checklistDoneCount: 2 } }],
    });
  });
  const journal = new CommandJournal(f.client);
  const { operationId } = await journal.prepare({
    scope,
    epoch: 'epoch',
    kind: 'run.checklist',
    id: 'run-id',
    expectedRevision: '6',
    data: {
      taskRevision: '10',
      itemId: item,
      itemRevision: null,
      change: {
        action: 'createChecklistItem',
        task,
        title: 'Check the preview',
      },
    },
  });
  await assert.rejects(journal.retry(operationId), { code: 'network_unavailable' });
  const resumed = new CommandJournal(f.client);
  const { request } = await resumed.inspect(operationId);
  const result = await resumed.retry(operationId);
  assert.equal(result.source, 'server');
  assert.deepEqual(result.receipt.items, [
    { id: 'run-id', revision: '20', collection: 'agentRuns', deleted: false },
  ]);
  assert.ok(result.receipt.affectedCollections.includes('checklist'));
  const entry = (
    await readResources(f.client, { scope, collection: 'checklist', id: request.data.itemId })
  ).items[0];
  assert.deepEqual(entry.data, { task, title: 'Check the preview', checked: false });
  const parent = (
    await readResources(f.client, { scope, collection: 'tasks', id: request.data.change.task })
  ).items[0];
  assert.equal(parent.revision, '21');
  assert.deepEqual(parent.data, { checklistCount: 4, checklistDoneCount: 2 });
  assert.equal((await resumed.retry(operationId)).source, 'local_receipt');
  assert.equal(attempts, 2);
});
