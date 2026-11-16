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
import { CommandJournal, validateCommand, commandHelp } from '../src/commands.mjs';
import { readResources, readMetrics } from '../src/resources.mjs';
import { readChanges } from '../src/changes.mjs';
import { credentials } from '../src/client.mjs';
import { main } from '../src/cli.mjs';
import catalog from '../src/command-catalog.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fixture, tokens, origin as fixtureOrigin } from './helpers.mjs';

const configuration = {
  key: 'weekly_revenue',
  title: 'Weekly revenue',
  description: 'Total for a complete week in EUR',
  kind: 'Gauge',
  aggregation: 'Latest',
  unit: 'EUR',
  precision: 2,
  ratioScale: 1,
  freshnessSeconds: 604800,
  writers: [],
  paused: false,
  archived: false,
};
const request = (scope = 'personal:owner') => ({
  operationId: randomUUID(),
  issuedAt: Date.now(),
  scope,
  epoch: 'epoch',
  id: randomUUID(),
  expectedRevision: null,
  kind: 'metric.create',
  data: { configuration },
});
const receipt = (input) => ({
  operationId: input.operationId,
  scope: input.scope,
  kind: input.kind,
  epoch: input.epoch,
  cursor: '2',
  items: [
    {
      id: input.id,
      revision: '2',
      collection: input.scope.startsWith('personal:') ? 'personalMetrics' : 'metrics',
      deleted: false,
    },
  ],
  affectedCollections: [input.scope.startsWith('personal:') ? 'personalMetrics' : 'metrics'],
});
const page = (scope, collection) => ({
  scope,
  collection,
  epoch: 'epoch',
  checkpoint: '1',
  items: [],
  nextAfter: null,
});

test('metric commands admit only their declared project/personal scopes without widening other commands', () => {
  for (const scope of ['personal:owner', 'project:work']) {
    const input = request(scope);
    assert.deepEqual(validateCommand(input), input);
    assert.equal(
      validateCommand({ ...input, kind: 'metric.update', expectedRevision: '3' }).scope,
      scope,
    );
    assert.equal(
      validateCommand({ ...input, kind: 'metric.delete', expectedRevision: '3', data: {} }).scope,
      scope,
    );
  }
  const base = request();
  for (const patch of [
    { scope: 'memory:owner' },
    { kind: 'task.create', data: { title: 'Private task' } },
    { kind: 'memory.create', data: { title: 'Private account copy' } },
    { data: { configuration, creator: 'someone' } },
    { kind: 'metric.update' },
    { expectedRevision: '1' },
    { kind: 'metric.delete', expectedRevision: '1', data: { configuration } },
  ]) {
    assert.throws(() => validateCommand({ ...base, ...patch }), { code: 'invalid_arguments' });
  }
  for (const kind of ['metric.create', 'metric.update', 'metric.delete']) {
    assert.equal(catalog.commands[kind].permission, 'metrics:write');
    assert.equal(catalog.commands[kind].personalModule, 'LocalUser/LocalUserMetricDefinition');
  }
});

test('published metric examples validate against strict generated schemas and exclude mutable server fields', async () => {
  const guide = await readFile(
    new URL('../skills/geniustasker/references/metrics.md', import.meta.url),
    'utf8',
  );
  const examples = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  assert.equal(examples.length, 1);
  for (const kind of ['metric.create', 'metric.update']) {
    const help = commandHelp({ kind }),
      validate = new Ajv({ strict: true }).compile(help.dataSchema);
    assert.deepEqual(help.requiredFields, ['configuration']);
    assert.equal(validate(examples[0]), true, JSON.stringify(validate.errors));
    for (const patch of [
      { precision: 7 },
      { writers: ['duplicate', 'duplicate'] },
      { freshnessSeconds: 59 },
      { key: 'Spaces are not keys' },
      { created: 'forged' },
    ]) {
      assert.equal(validate({ configuration: { ...configuration, ...patch } }), false);
    }
    assert.equal(validate({ configuration: { title: 'Partial nested patch' } }), false);
    assert.equal(validate({ configuration, action: 'configureMetric' }), false);
  }
});

test('personal read and change helpers reject unrelated collections before touching identity or network', async () => {
  const client = { get: () => assert.fail('Invalid personal reads must not contact the API') };
  for (const input of [
    { scope: 'personal:owner', collection: 'tasks' },
    { scope: 'project:work', collection: 'personalMetrics' },
    { scope: 'memory:work', collection: 'metrics' },
  ]) {
    await assert.rejects(readResources(client, input), { code: 'invalid_arguments' });
    await assert.rejects(readChanges(client, { ...input, cursor: 'saved-cursor' }), {
      code: 'invalid_arguments',
    });
  }
  await assert.rejects(
    readMetrics(client, { scope: 'personal:owner', collection: 'personalMetrics', after: 'page2' }),
    { code: 'invalid_arguments' },
  );
  await assert.rejects(
    readMetrics(client, {
      scope: 'personal:owner',
      collection: 'personalMetrics',
      url: 'https://external.invalid',
    }),
    { code: 'invalid_arguments' },
  );
});

test('metric CLI reads one correctly scoped page and keeps JSON stdout clean', async (t) => {
  const f = await fixture(t),
    calls = [];
  for (const [scope, collection] of [
    ['personal:owner', 'personalMetrics'],
    ['project:work', 'metrics'],
  ]) {
    let output = '',
      diagnostics = '';
    const code = await main(
      ['metrics', 'list', '--scope', scope, '--origin', fixtureOrigin, '--allow-local', '--json'],
      {
        directory: f.directory,
        runtimeDirectory: join(f.directory, 'runtime'),
        fetchImpl: async (url) => {
          assert.equal(url.pathname, '/api/agents/v1/resources');
          calls.push({ resource: 'resources', query: Object.fromEntries(url.searchParams) });
          return Response.json(page(scope, collection));
        },
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
      },
    );
    assert.equal(code, 0);
    assert.equal(diagnostics, '');
    assert.deepEqual(JSON.parse(output), {
      formatVersion: 1,
      ok: true,
      data: page(scope, collection),
    });
    assert.deepEqual(calls.at(-1), { resource: 'resources', query: { scope, collection } });
  }
  assert.equal(calls.length, 2);
});

test('personal metric journal preserves the immutable operation after uncertainty and local replay never charges another call', async (t) => {
  const calls = [];
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      throw Error('Lost response after commit');
    }
    return Response.json(receipt(calls.at(-1)));
  });
  const journal = new CommandJournal(f.client),
    input = request();
  await assert.rejects(journal.execute(input), { code: 'network_unavailable' });
  assert.equal((await journal.inspect(input.operationId)).state, 'uncertain');
  assert.equal((await journal.retry(input.operationId)).source, 'server');
  assert.deepEqual(calls, [input, input]);
  assert.equal((await journal.retry(input.operationId)).source, 'local_receipt');
  await assert.rejects(journal.execute({ ...input, scope: 'project:work' }), {
    code: 'idempotency_mismatch',
  });
  assert.equal(calls.length, 2);
});

test('remote metric tools require their own grants and do not admit unrelated command kinds', () => {
  const read = tools.find((tool) => tool.name === 'tasker_read_metrics'),
    edit = tools.find((tool) => tool.name === 'tasker_edit_metrics');
  assert.ok(read);
  assert.ok(edit);
  assert.deepEqual(read.scopes, ['metrics:read']);
  assert.deepEqual(edit.scopes, ['metrics:write']);
  assert.deepEqual([...read.inputSchema.properties.collection.enum].sort(), [
    'metrics',
    'personalMetrics',
  ]);
  assert.equal(read.route, 'resources');
  assert.notEqual(read.write, true);
  assert.equal(edit.route, 'commands');
  assert.equal(edit.write, true);
  const validate = new Ajv({ strict: false }).compile(edit.inputSchema);
  assert.equal(validate(request()), true);
  assert.equal(validate({ ...request(), kind: 'task.create' }), false);
  for (const tool of tools.filter((value) => value.scopes.includes('tasks:write'))) {
    assert.ok(!tool.inputSchema.properties.kind?.enum?.includes('metric.create'));
  }
});

test('real MCP stdio reads personal definitions and edits using the same persisted command journal', async (t) => {
  const calls = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${tokens().access_token}`);
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/resources')) {
      const query = Object.fromEntries(url.searchParams);
      calls.push(query);
      res.end(JSON.stringify(page(query.scope, query.collection)));
      return;
    }
    assert.equal(url.pathname, '/api/agents/v1/commands');
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
    }
    const command = JSON.parse(raw);
    calls.push(command);
    res.end(JSON.stringify(receipt(command)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`,
    f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), origin)));
  const client = new Client({ name: 'metric-definition-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('fixtures/client-process.mjs', import.meta.url)),
      'mcp',
      f.directory,
      origin,
    ],
    stderr: 'pipe',
  });
  let diagnostics = '';
  transport.stderr.on('data', (chunk) => {
    diagnostics += chunk;
  });
  await client.connect(transport);
  t.after(() => client.close());
  const discovered = (await client.listTools()).tools;
  assert.equal(
    discovered.find((tool) => tool.name === 'tasker_read_metrics').annotations.readOnlyHint,
    true,
  );
  assert.equal(
    discovered.find((tool) => tool.name === 'tasker_edit_metrics').annotations.readOnlyHint,
    false,
  );
  const reading = await client.callTool({
    name: 'tasker_read_metrics',
    arguments: { scope: 'personal:owner', collection: 'personalMetrics' },
  });
  assert.notEqual(reading.isError, true);
  assert.equal(reading.structuredContent.data.epoch, 'epoch');
  const input = request(),
    edited = await client.callTool({ name: 'tasker_edit_metrics', arguments: input });
  assert.notEqual(edited.isError, true);
  assert.equal(edited.structuredContent.data.source, 'server');
  const replay = await client.callTool({
    name: 'tasker_retry_command',
    arguments: { operationId: input.operationId },
  });
  assert.equal(replay.structuredContent.data.source, 'local_receipt');
  const denied = await client.callTool({
    name: 'tasker_resources',
    arguments: { scope: 'personal:owner', collection: 'tasks' },
  });
  assert.equal(denied.isError, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], input);
  assert.equal(diagnostics, '');
});
