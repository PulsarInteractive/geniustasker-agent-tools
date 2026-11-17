import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { commandHelp, CommandJournal, validateCommand } from '../src/commands.mjs';
import { main } from '../src/cli.mjs';
import { readResources } from '../src/resources.mjs';
import { readChanges, watchChanges } from '../src/changes.mjs';
import { fixture } from './helpers.mjs';

const kinds = ['task.create', 'task.update', 'task.lock', 'task.unlock', 'run.lock', 'run.unlock'];
const query = { scope: 'project:work', collection: 'tasks' };
const availability = (patch = {}) => ({
  progress: 'New',
  status: 'Locked',
  manualReason: null,
  dependencyCount: 1,
  blockingIds: ['prerequisite'],
  blockersTruncated: false,
  incomplete: false,
  source: { epoch: 'epoch', authorizationEpoch: 'grant-epoch', head: '11' },
  ...patch,
});
const resourcePage = (snapshot = availability()) => ({
  ...query,
  epoch: 'epoch',
  checkpoint: '20',
  etag: 'etag-20',
  notModified: false,
  nextAfter: null,
  changeCursor: 'cursor',
  omittedIds: [],
  items: [{ id: 'dependent', revision: '7', data: { status: 'New' }, taskAvailability: snapshot }],
});
const changePage = (items) => ({
  ...query,
  epoch: 'epoch',
  checkpoint: '9',
  items,
  omittedIds: [],
  nextCursor: 'next',
  hasMore: false,
  pollAfterSeconds: 5,
});

test('generated task help describes creation, partial edits and exact lock data without broadening permissions', () => {
  const check = Object.fromEntries(
    kinds.map((kind) => {
      const help = commandHelp({ kind });
      assert.equal(help.permission, 'tasks:write');
      assert.equal(help.dataSchema.additionalProperties, false);
      assert.deepEqual(Object.keys(help.properties), help.fields);
      return [kind, new Ajv({ strict: true }).compile(help.dataSchema)];
    }),
  );
  assert.equal(
    check['task.create']({ title: 'Plan a task', estimateDays: 0.1, status: 'New' }),
    true,
  );
  assert.equal(check['task.create']({}), false);
  assert.equal(check['task.update']({}), true);
  for (const status of ['New', 'InProgress', 'Done', null]) {
    assert.equal(check['task.update']({ status }), true);
  }
  for (const estimateDays of [0.1, 1, 60, null]) {
    assert.equal(check['task.update']({ estimateDays }), true);
  }
  for (const estimateDays of [0, 0.09, 60.1, '0.1', Infinity]) {
    assert.equal(check['task.update']({ estimateDays }), false);
  }
  for (const patch of [
    { status: 'Locked' },
    { manualLockReason: 'blocked' },
    { effectiveStatus: 'Locked' },
    { title: null },
    { title: 'a' },
    { quantity: -1 },
    { quantityUnit: 'x'.repeat(21) },
    { autoArchiveDays: 32 },
    { autoArchiveHours: 25 },
    { autoArchiveHours: 0.5 },
    { importanceReason: 'x'.repeat(401) },
    { dependencies: Array(1001).fill('id') },
    { tags: Array(51).fill('id') },
    { creator: 'someone' },
  ]) {
    assert.equal(check['task.update'](patch), false, JSON.stringify(patch).slice(0, 80));
  }
  assert.equal(check['task.lock']({ reason: 'Waiting for the test device.' }), true);
  assert.equal(check['task.unlock']({}), true);
  assert.equal(
    check['run.lock']({ taskRevision: '7', reason: 'Waiting for the test device.' }),
    true,
  );
  assert.equal(check['run.unlock']({ taskRevision: '7' }), true);
  for (const reason of ['', 'x'.repeat(501), null]) {
    assert.equal(check['task.lock']({ reason }), false);
  }
  assert.equal(check['task.unlock']({ reason: 'remove everything' }), false);
  assert.equal(check['run.lock']({ reason: 'No task revision' }), false);
  assert.equal(check['run.unlock']({ taskRevision: '' }), false);
  for (const kind of kinds) {
    assert.equal(check[kind]({ action: 'internal' }), false);
  }
});

test('CLI exposes the exact generated create/update/lock schemas offline', async () => {
  for (const kind of kinds) {
    let stdout = '';
    const status = await main(['commands', 'describe', '--kind', kind, '--json'], {
      stdout: {
        write: (value) => {
          stdout += value;
        },
      },
      stderr: { write: () => assert.fail('Unexpected help error') },
      fetchImpl: () => assert.fail('Help must not contact any network'),
    });
    assert.equal(status, 0);
    assert.deepEqual(JSON.parse(stdout).data, commandHelp({ kind }));
  }
});

test('manual task and claimed-run locks keep targets, revisions and exact envelopes after uncertain replies', async (t) => {
  const requests = new Map();
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    const input = JSON.parse(options.body),
      calls = requests.get(input.operationId) ?? [];
    calls.push(input);
    requests.set(input.operationId, calls);
    if (calls.length === 1) {
      throw Error('Synthetic acknowledgement lost');
    }
    return Response.json({
      operationId: input.operationId,
      scope: input.scope,
      epoch: input.epoch,
      kind: input.kind,
      cursor: '12',
      items: [],
      affectedCollections: ['tasks'],
    });
  });
  const journal = new CommandJournal(f.client);
  for (const kind of ['task.lock', 'task.unlock', 'run.lock', 'run.unlock']) {
    const data = {
      ...(kind.startsWith('run.') ? { taskRevision: '7' } : {}),
      ...(kind.endsWith('.lock') ? { reason: 'Waiting for the test device.' } : {}),
    };
    const draft = {
      kind,
      scope: query.scope,
      epoch: 'epoch',
      id: kind.startsWith('run.') ? 'run-id' : 'task-id',
      expectedRevision: kind.startsWith('run.') ? '4' : '7',
      data,
    };
    const prepared = await journal.prepare(draft);
    assert.equal(
      requests.size,
      ['task.lock', 'task.unlock', 'run.lock', 'run.unlock'].indexOf(kind),
    );
    await assert.rejects(journal.retry(prepared.operationId), { code: 'network_unavailable' });
    await journal.retry(prepared.operationId);
    assert.equal((await journal.retry(prepared.operationId)).source, 'local_receipt');
    const calls = requests.get(prepared.operationId);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].kind, kind);
    assert.equal(calls[0].id, draft.id);
    assert.deepEqual(calls[0].data, data);
    assert.equal(calls[0].expectedRevision, draft.expectedRevision);
    assert.throws(
      () => validateCommand({ ...prepared.request, data: { ...data, action: 'lockTask' } }),
      { code: 'invalid_arguments' },
    );
  }
});

test('task resource caching revalidates snapshots and accepts a new source head with the same row revision', async (t) => {
  let stage = 0;
  const original = resourcePage(),
    updated = resourcePage(
      availability({
        status: 'New',
        blockingIds: [],
        source: { epoch: 'epoch', authorizationEpoch: 'grant-epoch', head: '12' },
      }),
    );
  updated.checkpoint = '21';
  updated.etag = 'etag-21';
  const f = await fixture(t, async (url) => {
    assert.equal(url.searchParams.get('taskState'), 'v1');
    if (stage++ === 0) {
      assert.equal(url.searchParams.has('ifNoneMatch'), false);
      return Response.json(original);
    }
    assert.equal(url.searchParams.get('ifNoneMatch'), 'etag-20');
    return Response.json(stage === 2 ? { ...original, items: [], notModified: true } : updated);
  });
  const input = { ...query, id: 'dependent', taskState: 'v1' };
  assert.deepEqual(await readResources(f.client, input), original);
  assert.deepEqual(await readResources(f.client, input), original);
  const result = await readResources(f.client, input);
  assert.deepEqual(result, updated);
  assert.equal(result.items[0].revision, original.items[0].revision);
  assert.equal(original.items[0].taskAvailability.status, 'Locked');
});

test('changes preserve a newer availability head, bounded unknown states and legacy absence without inventing availability', async (t) => {
  let response = changePage([
    {
      id: 'dependent',
      revision: '7',
      kind: 'upsert',
      data: { status: 'New' },
      taskAvailability: availability(),
    },
  ]);
  const f = await fixture(t, async () => Response.json(response));
  const input = { ...query, cursor: 'previous', taskState: 'v1' };
  assert.deepEqual(await readChanges(f.client, input), response);
  response.items[0].taskAvailability = availability({
    status: 'Unknown',
    incomplete: true,
    blockingIds: [],
  });
  assert.deepEqual(
    (await readChanges(f.client, input)).items[0].taskAvailability,
    response.items[0].taskAvailability,
  );
  for (const changed of [
    { dependencyCount: 1001 },
    { blockingIds: Array(21).fill('id') },
    { status: 'Available' },
    { source: { epoch: 'other', authorizationEpoch: 'grant-epoch', head: '11' } },
  ]) {
    response.items[0].taskAvailability = availability(changed);
    await assert.rejects(readChanges(f.client, input), { code: 'invalid_response' });
  }
  response = changePage([
    {
      id: 'dependent',
      revision: '8',
      kind: 'remove',
      data: null,
      taskAvailability: availability(),
    },
  ]);
  await assert.rejects(readChanges(f.client, input), { code: 'invalid_response' });
  delete response.items[0].taskAvailability;
  assert.deepEqual(await readChanges(f.client, input), response);
  response = changePage([
    { id: 'dependent', revision: '7', kind: 'upsert', data: { status: 'New' } },
  ]);
  assert.equal(
    Object.hasOwn((await readChanges(f.client, input)).items[0], 'taskAvailability'),
    false,
  );
  response = {
    ...changePage([
      { id: 'comment', revision: '7', kind: 'upsert', data: {}, taskAvailability: availability() },
    ]),
    collection: 'comments',
  };
  await assert.rejects(
    readChanges(f.client, { ...query, cursor: 'previous', collection: 'comments' }),
    {
      code: 'invalid_response',
    },
  );
});

test('invalid task resource snapshots clear the conditional cache before another read', async (t) => {
  let calls = 0;
  const f = await fixture(t, async (url) => {
    assert.equal(url.searchParams.has('ifNoneMatch'), false);
    return Response.json(
      calls++ ? resourcePage() : resourcePage(availability({ dependencyCount: 1001 })),
    );
  });
  const input = { ...query, taskState: 'v1' };
  await assert.rejects(readResources(f.client, input), { code: 'invalid_response' });
  assert.deepEqual(await readResources(f.client, input), resourcePage());
});

test('legacy and opted-in task resources have separate conditional cache entries with no hidden discovery', async (t) => {
  const calls = new Map();
  const f = await fixture(t, async (url) => {
    assert.equal(url.pathname, '/api/agents/v1/resources');
    const optedIn = url.searchParams.get('taskState') === 'v1';
    const page = resourcePage();
    page.etag = optedIn ? 'v1-etag' : 'legacy-etag';
    if (!optedIn) {
      delete page.items[0].taskAvailability;
    }
    const previous = calls.get(optedIn) ?? 0;
    assert.equal(url.searchParams.get('ifNoneMatch'), previous ? page.etag : null);
    calls.set(optedIn, previous + 1);
    return Response.json(previous ? { ...page, items: [], notModified: true } : page);
  });
  for (let round = 0; round < 2; round++) {
    const legacy = await readResources(f.client, query);
    assert.equal(Object.hasOwn(legacy.items[0], 'taskAvailability'), false);
    const optedIn = await readResources(f.client, { ...query, taskState: 'v1' });
    assert.equal(optedIn.items[0].taskAvailability.status, 'Locked');
  }
  assert.deepEqual([...calls.values()], [2, 2]);
});

test('CLI resources, changes and bounded watch preserve an explicit task-state choice without implicit discovery', async (t) => {
  let expected;
  const f = await fixture(t, async (url) => {
    assert.equal(url.searchParams.get('taskState'), expected ?? null);
    assert.ok(['/api/agents/v1/resources', '/api/agents/v1/changes'].includes(url.pathname));
    const page = url.pathname.endsWith('/resources')
      ? resourcePage()
      : changePage([
          {
            id: 'dependent',
            revision: '7',
            kind: 'upsert',
            data: { status: 'New' },
            taskAvailability: availability(),
          },
        ]);
    if (!expected) {
      delete page.items[0].taskAvailability;
    }
    return Response.json(page);
  });
  for (const command of [
    ['resources', 'list'],
    ['changes', 'list'],
    ['changes', 'watch'],
  ]) {
    for (const taskState of [undefined, 'v1']) {
      expected = taskState;
      let stdout = '',
        stderr = '';
      const status = await main(
        [
          ...command,
          '--scope',
          query.scope,
          '--collection',
          'tasks',
          ...(command[0] === 'changes' ? ['--cursor', 'previous'] : []),
          ...(taskState ? ['--task-state', taskState] : []),
          '--origin',
          f.transport.origin,
          '--allow-local',
          '--json',
        ],
        {
          directory: f.directory,
          fetchImpl: f.transport.fetch,
          stdout: {
            write: (value) => {
              stdout += value;
            },
          },
          stderr: {
            write: (value) => {
              stderr += value;
            },
          },
        },
      );
      assert.equal(status, 0, stderr);
      const result = JSON.parse(stdout).data;
      const page = command[1] === 'watch' ? result.page : result;
      assert.equal(Object.hasOwn(page.items[0], 'taskAvailability'), taskState === 'v1');
    }
  }
});

test('task-state versions and collection mismatches fail before authentication; unsolicited state never implies availability', async (t) => {
  const unauthenticated = await fixture(
    t,
    () => assert.fail('Invalid input must not send a request'),
    { authenticated: false },
  );
  for (const read of [readResources, readChanges, watchChanges]) {
    for (const invalid of [{ taskState: 'v2' }, { taskState: 'v1', collection: 'comments' }]) {
      await assert.rejects(
        read(unauthenticated.client, {
          ...query,
          ...(read === readResources ? {} : { cursor: 'previous' }),
          ...invalid,
        }),
        { code: 'invalid_arguments' },
      );
    }
  }
  const f = await fixture(t, async (url) =>
    Response.json(
      url.pathname.endsWith('/resources')
        ? resourcePage()
        : changePage([
            {
              id: 'dependent',
              revision: '7',
              kind: 'upsert',
              data: {},
              taskAvailability: availability(),
            },
          ]),
    ),
  );
  await assert.rejects(readResources(f.client, query), { code: 'invalid_response' });
  await assert.rejects(readChanges(f.client, { ...query, cursor: 'previous' }), {
    code: 'invalid_response',
  });
});
