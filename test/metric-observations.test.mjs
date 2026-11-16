import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { credentials } from '../src/client.mjs';
import {
  CommandJournal,
  commandHelp,
  validateCommand,
  metricCommandSchema,
} from '../src/commands.mjs';
import { readMetrics, metricHistoryCollections } from '../src/resources.mjs';
import { main } from '../src/cli.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fixture, tokens, origin } from './helpers.mjs';

const metricId = '00000000-0000-4000-8000-000000000001';
const measurement = { value: 3, numerator: null, denominator: null };
const data = {
  metricId,
  measurementVersion: 1,
  sourceKey: 'provider:event-42',
  sourceLabel: 'Verified provider event',
  observedAt: '2026-11-15T23:00:00Z',
  measurement,
};
const command = (scope = 'personal:owner') => ({
  operationId: randomUUID(),
  issuedAt: Date.now(),
  scope,
  epoch: 'e',
  id: randomUUID(),
  kind: 'metric.record',
  expectedRevision: null,
  data,
});
function receipt(input) {
  const collection = input.scope.startsWith('personal:')
    ? 'personalMetricObservations'
    : 'metricObservations';
  return {
    operationId: input.operationId,
    scope: input.scope,
    kind: input.kind,
    epoch: input.epoch,
    cursor: '3',
    items: [{ id: input.id, collection, revision: '3', deleted: false }],
    affectedCollections: [collection],
  };
}

test('observation examples and command discovery preserve exact typed data and bounded fields', async () => {
  const guide = await readFile(
    new URL('../skills/geniustasker/references/metrics-observations.md', import.meta.url),
    'utf8',
  );
  const examples = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  assert.equal(examples.length, 4);
  const validators = Object.fromEntries(
    ['record', 'correct', 'void'].map((kind) => [
      kind,
      new Ajv({ strict: true }).compile(commandHelp({ kind: `metric.${kind}` }).dataSchema),
    ]),
  );
  assert.equal(validators.record(examples[0]), true);
  assert.equal(validators.record(examples[1]), true);
  assert.equal(validators.correct(examples[2]), true);
  assert.equal(validators.void(examples[3]), true);
  for (const patch of [
    { occurredAt: data.observedAt },
    { sourceKey: '' },
    { sourceKey: 'x'.repeat(161) },
    { measurementVersion: 0 },
    { creator: 'forged' },
    { measurement: { value: 3 } },
    { measurement: { ...measurement, value: 1000000001 } },
  ]) {
    assert.equal(validators.record({ ...data, ...patch }), false);
  }
  assert.equal(validators.correct({ ...examples[2], sourceKey: 'replacement-event' }), false);
  assert.equal(validators.correct({ ...examples[2], reason: '' }), false);
  assert.equal(validators.void({ reason: 'x'.repeat(501) }), false);
  assert.equal(validators.void({ reason: 'Wrong source', voided: true }), false);
  for (const scope of ['personal:owner', 'project:work']) {
    const input = command(scope);
    assert.equal(validateCommand(input).kind, 'metric.record');
    for (const kind of ['correct', 'void']) {
      const edit = {
        ...input,
        kind: `metric.${kind}`,
        expectedRevision: '2',
        data: kind === 'correct' ? examples[2] : examples[3],
      };
      assert.equal(metricCommandSchema.safeParse(edit).success, true);
      assert.equal(validateCommand(edit).expectedRevision, '2');
      assert.throws(() => validateCommand({ ...edit, expectedRevision: null }), {
        code: 'invalid_arguments',
      });
    }
    assert.throws(() => validateCommand({ ...input, expectedRevision: '2' }), {
      code: 'invalid_arguments',
    });
  }
});

test('metric history reads bind the exact filter across pages and make one request per call', async (t) => {
  const calls = [];
  const f = await fixture(t, async (url) => {
    const query = Object.fromEntries(url.searchParams);
    calls.push(query);
    return Response.json({
      scope: query.scope,
      collection: query.collection,
      epoch: 'e',
      checkpoint: '10',
      items: [],
      nextAfter: query.after ? null : 'next-page',
      changeCursor: null,
    });
  });
  for (const collection of metricHistoryCollections) {
    const scope = collection.startsWith('personal') ? 'personal:owner' : 'project:work';
    const input = { scope, collection, metricId };
    const before = calls.length,
      first = await readMetrics(f.client, input);
    assert.equal(first.changeCursor, null);
    assert.equal(calls.length, before + 1);
    await readMetrics(f.client, {
      ...input,
      after: first.nextAfter,
      epoch: first.epoch,
      checkpoint: first.checkpoint,
    });
    assert.equal(calls.length, before + 2);
    assert.deepEqual(calls.at(-1), { ...input, after: 'next-page', epoch: 'e', checkpoint: '10' });
  }
  const noNetwork = { get: () => assert.fail('Invalid filter must fail before a read') };
  for (const input of [
    { scope: 'personal:owner', collection: 'personalMetrics', metricId },
    { scope: 'project:work', collection: 'metricObservations', metricId: 'not-a-uuid' },
    { scope: 'project:work', collection: 'metricCorrections', metricId, from: '2026-11-01' },
    { scope: 'memory:work', collection: 'metricObservations', metricId },
    { scope: 'personal:owner', collection: 'metricCorrections', metricId },
  ]) {
    await assert.rejects(readMetrics(noNetwork, input), { code: 'invalid_arguments' });
  }
});

test('CLI metric and generic reads transmit --metric-id only as the exact supported query', async (t) => {
  const f = await fixture(t),
    calls = [];
  for (const group of ['metrics', 'resources']) {
    let stdout = '',
      stderr = '';
    const code = await main(
      [
        group,
        'list',
        '--scope',
        'personal:owner',
        '--collection',
        'personalMetricObservations',
        '--metric-id',
        metricId,
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
            stdout += value;
          },
        },
        stderr: {
          write: (value) => {
            stderr += value;
          },
        },
        fetchImpl: async (url) => {
          const query = Object.fromEntries(url.searchParams);
          calls.push(query);
          return Response.json({
            scope: query.scope,
            collection: query.collection,
            epoch: 'e',
            checkpoint: '10',
            items: [],
            nextAfter: null,
            changeCursor: null,
          });
        },
      },
    );
    assert.equal(code, 0, stderr);
    assert.equal(stderr, '');
    assert.equal(JSON.parse(stdout).data.changeCursor, null);
    assert.deepEqual(calls.at(-1), {
      scope: 'personal:owner',
      collection: 'personalMetricObservations',
      metricId,
    });
  }
  assert.equal(calls.length, 2);
});

test('uncertain observation records retain source identity and corrections never automatically retry conflicts', async (t) => {
  const calls = [];
  const f = await fixture(t, async (_url, options) => {
    const input = JSON.parse(options.body);
    calls.push(input);
    if (calls.length === 1) {
      throw Error('Lost acknowledgement');
    }
    if (input.kind === 'metric.correct') {
      return Response.json(
        { error: { code: 'revision_conflict', retryable: false } },
        { status: 409 },
      );
    }
    return Response.json(receipt(input));
  });
  const journal = new CommandJournal(f.client),
    input = command();
  await assert.rejects(journal.execute(input), { code: 'network_unavailable' });
  await assert.rejects(
    journal.execute({ ...input, data: { ...data, sourceKey: 'try-another-key' } }),
    { code: 'idempotency_mismatch' },
  );
  const restored = await journal.retry(input.operationId);
  assert.equal(restored.source, 'server');
  assert.deepEqual(calls, [input, input]);
  const correction = {
    ...input,
    operationId: randomUUID(),
    kind: 'metric.correct',
    expectedRevision: '3',
    data: {
      observedAt: data.observedAt,
      measurement: { ...measurement, value: 4 },
      reason: 'Verified source amendment',
    },
  };
  await assert.rejects(journal.execute(correction), { code: 'revision_conflict' });
  assert.equal(calls.length, 3);
  assert.deepEqual((await journal.inspect(correction.operationId)).request, correction);
});

test('hosted observation discovery keeps dedicated grants and an exact optional metric filter', () => {
  const edit = tools.find((tool) => tool.name === 'tasker_edit_metrics');
  assert.deepEqual(edit.scopes, ['metrics:write']);
  for (const kind of ['metric.record', 'metric.correct', 'metric.void']) {
    assert.ok(edit.inputSchema.properties.kind.enum.includes(kind));
  }
  for (const tool of tools.filter((tool) => tool.scopes.includes('tasks:write'))) {
    assert.ok(!tool.inputSchema.properties.kind?.enum?.includes('metric.record'));
  }
  const read = tools.find((tool) => tool.name === 'tasker_read_metrics'),
    validate = new Ajv({ strict: false }).compile(read.inputSchema);
  assert.deepEqual(read.scopes, ['metrics:read']);
  assert.equal(
    validate({ scope: 'personal:owner', collection: 'personalMetricCorrections', metricId }),
    true,
  );
  assert.equal(
    validate({ scope: 'personal:owner', collection: 'personalMetricCorrections', metricId: 'all' }),
    false,
  );
  assert.equal(
    validate({
      scope: 'personal:owner',
      collection: 'personalMetricCorrections',
      metricId,
      order: 'desc',
    }),
    false,
  );
});

test('actual MCP stdio records, corrects and voids observations through normal commands and filtered reads', async (t) => {
  const calls = [];
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${tokens().access_token}`);
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') {
      assert.equal(url.pathname, '/api/agents/v1/resources');
      const query = Object.fromEntries(url.searchParams);
      calls.push(query);
      response.end(
        JSON.stringify({
          scope: query.scope,
          collection: query.collection,
          epoch: 'e',
          checkpoint: '3',
          items: [],
          nextAfter: null,
          changeCursor: null,
        }),
      );
      return;
    }
    assert.equal(url.pathname, '/api/agents/v1/commands');
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
    }
    const input = JSON.parse(raw);
    calls.push(input);
    response.end(JSON.stringify(receipt(input)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const endpoint = `http://127.0.0.1:${server.address().port}`,
    f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), endpoint)));
  const client = new Client({ name: 'metric-observation-test', version: '1' }),
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL('fixtures/client-process.mjs', import.meta.url)),
        'mcp',
        f.directory,
        endpoint,
      ],
      stderr: 'pipe',
    });
  let diagnostics = '';
  transport.stderr.on('data', (chunk) => {
    diagnostics += chunk;
  });
  await client.connect(transport);
  t.after(() => client.close());
  const input = command();
  for (const commandInput of [
    input,
    {
      ...input,
      operationId: randomUUID(),
      kind: 'metric.correct',
      expectedRevision: '3',
      data: { observedAt: data.observedAt, measurement, reason: 'Verified amendment' },
    },
    {
      ...input,
      operationId: randomUUID(),
      kind: 'metric.void',
      expectedRevision: '3',
      data: { reason: 'Invalid source period' },
    },
  ]) {
    const result = await client.callTool({ name: 'tasker_edit_metrics', arguments: commandInput });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.deepEqual(calls.at(-1), commandInput);
  }
  const result = await client.callTool({
    name: 'tasker_read_metrics',
    arguments: { scope: input.scope, collection: 'personalMetricCorrections', metricId },
  });
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.data.changeCursor, null);
  const replay = await client.callTool({
    name: 'tasker_retry_command',
    arguments: { operationId: input.operationId },
  });
  assert.equal(replay.structuredContent.data.source, 'local_receipt');
  assert.equal(calls.length, 4);
  assert.equal(diagnostics, '');
});
