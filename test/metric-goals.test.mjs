import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv from 'ajv';
import {
  CommandJournal,
  commandHelp,
  metricCommandSchema,
  validateCommand,
} from '../src/commands.mjs';
import { readMetrics, readResources, metricHistoryCollections } from '../src/resources.mjs';
import { readChanges } from '../src/changes.mjs';
import { main } from '../src/cli.mjs';
import catalog from '../src/command-catalog.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fixture, origin } from './helpers.mjs';

const metricId = '00000000-0000-4000-8000-000000000001';
const configuration = {
  metricId,
  title: 'Budget',
  description: 'Verified November expenses in EUR',
  target: '500.00',
  comparison: 'AtMost',
  window: { start: '2026-11-01T00:00:00+01:00', end: '2026-12-01T00:00:00+01:00' },
  completion: 'AtEnd',
  notifyCompleted: false,
  coachSignal: false,
  paused: false,
  archived: false,
};
const command = (scope = 'personal:owner') => ({
  operationId: randomUUID(),
  issuedAt: Date.now(),
  scope,
  epoch: 'e',
  id: randomUUID(),
  kind: 'metric.goal.create',
  expectedRevision: null,
  data: { configuration },
});
const collectionFor = (scope) =>
  scope.startsWith('personal:') ? 'personalMetricGoals' : 'metricGoals';
const receipt = (input) => ({
  operationId: input.operationId,
  scope: input.scope,
  kind: input.kind,
  epoch: input.epoch,
  cursor: '3',
  items: [{ id: input.id, collection: collectionFor(input.scope), revision: '3', deleted: false }],
  affectedCollections: [collectionFor(input.scope)],
});

test('metric goal guide validates against strict generated schemas and preserves decimal-string thresholds', async () => {
  const guide = await readFile(
    new URL('../skills/geniustasker/references/metric-goals.md', import.meta.url),
    'utf8',
  );
  const examples = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  assert.equal(examples.length, 1);
  for (const kind of ['metric.goal.create', 'metric.goal.update']) {
    const help = commandHelp({ kind }),
      validate = new Ajv({ strict: true }).compile(help.dataSchema);
    assert.deepEqual(help.requiredFields, ['configuration']);
    assert.equal(validate(examples[0]), true, JSON.stringify(validate.errors));
    assert.equal(
      validate({
        configuration: { ...configuration, window: null, completion: 'OnReach', target: '-12.25' },
      }),
      true,
    );
    for (const patch of [
      { target: 500 },
      { target: '5e2' },
      { target: '500,00' },
      { target: '12.1234567' },
      { comparison: 'Equal' },
      { window: { start: configuration.window.start } },
      { notifyCompleted: null },
      { coachSignal: 'true' },
      { phase: 'Ready' },
      { reached: true },
      { completedAt: '2026-11-01T00:00:00Z' },
      { title: 'x'.repeat(161) },
    ]) {
      assert.equal(
        validate({ configuration: { ...configuration, ...patch } }),
        false,
        JSON.stringify(patch),
      );
    }
    assert.equal(validate({ configuration, action: 'configureMetricGoal' }), false);
    assert.equal(validate({ configuration: { target: '600' } }), false);
  }
});

test('goal command discovery keeps independent metrics permission and current revision rules in both scopes', () => {
  for (const scope of ['personal:owner', 'project:work']) {
    const input = command(scope);
    for (const kind of ['metric.goal.create', 'metric.goal.update', 'metric.goal.delete']) {
      const next = {
        ...input,
        kind,
        expectedRevision: kind.endsWith('create') ? null : '3',
        data: kind.endsWith('delete') ? {} : input.data,
      };
      assert.equal(metricCommandSchema.safeParse(next).success, true);
      assert.deepEqual(validateCommand(next), next);
      assert.equal(catalog.commands[kind].permission, 'metrics:write');
      assert.equal(catalog.commands[kind].module, 'Project/ProjectMetricGoal');
      assert.equal(catalog.commands[kind].personalModule, 'LocalUser/LocalUserMetricGoal');
      assert.throws(
        () =>
          validateCommand({
            ...next,
            expectedRevision: next.expectedRevision === null ? '3' : null,
          }),
        { code: 'invalid_arguments' },
      );
      assert.throws(() => validateCommand({ ...next, scope: 'memory:work' }), {
        code: 'invalid_arguments',
      });
    }
    assert.throws(() => validateCommand({ ...input, data: { configuration, phase: 'Ready' } }), {
      code: 'invalid_arguments',
    });
  }
  const edit = tools.find((tool) => tool.name === 'tasker_edit_metrics');
  assert.deepEqual(edit.scopes, ['metrics:write']);
  for (const kind of ['metric.goal.create', 'metric.goal.update', 'metric.goal.delete']) {
    assert.ok(edit.inputSchema.properties.kind.enum.includes(kind));
    for (const tool of tools.filter(
      (tool) => tool.scopes.includes('goals:write') || tool.scopes.includes('tasks:write'),
    )) {
      assert.ok(!tool.inputSchema.properties.kind?.enum?.includes(kind));
    }
  }
});

test('goal reads preserve pending and exact ready results without loading extra pages or accepting history-only filters', async () => {
  const calls = [];
  const noNetwork = { get: () => assert.fail('Invalid goal filter/scope must fail before I/O') };
  assert.deepEqual(
    [...metricHistoryCollections].sort(),
    [
      'metricObservations',
      'metricCorrections',
      'personalMetricObservations',
      'personalMetricCorrections',
    ].sort(),
  );
  for (const scope of ['personal:owner', 'project:work']) {
    const collection = collectionFor(scope),
      id = randomUUID();
    for (const [phase, summary, reached] of [
      ['Pending', { activeCount: 25, value: '400.00' }, false],
      ['Ready', { activeCount: 0, value: null, latest: null }, false],
      ['Ready', { activeCount: 3, value: '500.00', sumUnits: '150001' }, false],
    ]) {
      const page = {
        scope,
        collection,
        epoch: 'e',
        checkpoint: '3',
        nextAfter: 'more',
        items: [{ id, revision: '3', data: { phase, summary, reached, completedAt: null } }],
      };
      const client = {
        get: async (path, query) => {
          calls.push({ path, query });
          return page;
        },
      };
      assert.deepEqual(await readMetrics(client, { scope, collection, id }), page);
      assert.deepEqual(calls.at(-1), { path: 'resources', query: { scope, collection, id } });
    }
    for (const read of [readMetrics, readResources]) {
      await assert.rejects(read(noNetwork, { scope, collection, metricId }), {
        code: 'invalid_arguments',
      });
      await assert.rejects(
        read(noNetwork, {
          scope: scope.startsWith('personal:') ? 'project:work' : 'personal:owner',
          collection,
        }),
        { code: 'invalid_arguments' },
      );
    }
    await assert.rejects(readMetrics(noNetwork, { scope, collection, after: 'more' }), {
      code: 'invalid_arguments',
    });
    const change = { scope, collection, cursor: 'opaque-change-cursor' };
    const delta = {
      scope,
      collection,
      epoch: 'e',
      checkpoint: '4',
      items: [],
      omittedIds: [],
      nextCursor: 'next-cursor',
      hasMore: false,
      pollAfterSeconds: 10,
    };
    assert.deepEqual(
      await readChanges(
        {
          get: async (path, query) => {
            assert.equal(path, 'changes');
            assert.deepEqual(query, change);
            return delta;
          },
        },
        change,
      ),
      delta,
    );
  }
  assert.equal(calls.length, 6);
});

test('CLI selects metric goal collections without introducing an automatic polling or pagination loop', async (t) => {
  const f = await fixture(t),
    calls = [];
  for (const scope of ['personal:owner', 'project:work']) {
    const collection = collectionFor(scope),
      id = randomUUID();
    let output = '',
      diagnostics = '';
    const code = await main(
      [
        'metrics',
        'list',
        '--scope',
        scope,
        '--collection',
        collection,
        '--id',
        id,
        '--origin',
        origin,
        '--allow-local',
        '--json',
      ],
      {
        directory: f.directory,
        runtimeDirectory: join(f.directory, 'runtime'),
        stdout: {
          write: (value) => {
            output += value;
          },
        },
        stderr: {
          write: (value) => {
            diagnostics += value;
          },
        },
        fetchImpl: async (url) => {
          const query = Object.fromEntries(url.searchParams);
          calls.push(query);
          return Response.json({
            scope,
            collection,
            epoch: 'e',
            checkpoint: '3',
            nextAfter: 'more',
            items: [{ id, data: { phase: 'Pending', reached: false } }],
          });
        },
      },
    );
    assert.equal(code, 0, diagnostics);
    assert.equal(diagnostics, '');
    assert.equal(JSON.parse(output).data.items[0].data.phase, 'Pending');
    assert.deepEqual(calls.at(-1), { scope, collection, id });
  }
  assert.equal(calls.length, 2);
});

test('lost metric goal acknowledgments replay the same intention and conflicts retain opt-ins unchanged', async (t) => {
  const calls = [];
  const f = await fixture(t, async (_url, options) => {
    const input = JSON.parse(options.body);
    calls.push(input);
    if (calls.length === 1) {
      throw Error('Lost response');
    }
    if (input.kind === 'metric.goal.update') {
      return Response.json(
        { error: { code: 'revision_conflict', retryable: false } },
        { status: 409 },
      );
    }
    return Response.json(receipt(input));
  });
  const input = command(),
    journal = new CommandJournal(f.client);
  await assert.rejects(journal.execute(input), { code: 'network_unavailable' });
  await assert.rejects(
    journal.execute({
      ...input,
      data: { configuration: { ...configuration, notifyCompleted: true } },
    }),
    { code: 'idempotency_mismatch' },
  );
  assert.equal((await journal.retry(input.operationId)).source, 'server');
  assert.equal((await journal.retry(input.operationId)).source, 'local_receipt');
  assert.deepEqual(calls, [input, input]);
  const update = {
    ...input,
    operationId: randomUUID(),
    kind: 'metric.goal.update',
    expectedRevision: '3',
    data: { configuration: { ...configuration, paused: true } },
  };
  await assert.rejects(journal.execute(update), { code: 'revision_conflict' });
  assert.deepEqual((await journal.inspect(update.operationId)).request, update);
  assert.equal(calls.length, 3);
});
