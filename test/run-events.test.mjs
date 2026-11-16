import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture, origin, tokens } from './helpers.mjs';
import { credentials } from '../src/client.mjs';
import { commandHelp, CommandJournal } from '../src/commands.mjs';
import { reportRunEvent, runEventCommand } from '../src/run-events.mjs';
import { main } from '../src/cli.mjs';

const event = (type = 'checkpoint') => ({
  eventId: crypto.randomUUID(),
  occurredAt: Date.now(),
  type,
  scope: 'project:work',
  epoch: 'current-epoch',
  runId: crypto.randomUUID(),
  expectedRevision: type === 'started' ? null : '7',
  summary: 'Recorded a real host event.',
  ...(type === 'started'
    ? { task: 'task-a', taskRevision: '6' }
    : { nextSteps: 'Review the actual result.' }),
});
const receipt = (input) => ({
  operationId: input.operationId,
  scope: input.scope,
  kind: input.kind,
  epoch: input.epoch,
  cursor: '8',
  items: [{ id: input.id, revision: '8', collection: 'agentRuns', deleted: false }],
  affectedCollections: ['agentRuns'],
});

test('host events map to generated run schemas and process exit can only request review', async () => {
  const expected = {
    started: ['run.claim', undefined],
    checkpoint: ['run.checkpoint', 'Working'],
    waiting: ['run.checkpoint', 'Waiting'],
    review: ['run.checkpoint', 'NeedsReview'],
    process_exited: ['run.checkpoint', 'NeedsReview'],
    finished: ['run.finish', 'Completed'],
    failed: ['run.finish', 'Failed'],
    cancelled: ['run.finish', 'Cancelled'],
  };
  for (const [type, [kind, state]] of Object.entries(expected)) {
    const input = event(type),
      command = runEventCommand(input);
    assert.equal(command.kind, kind);
    assert.equal(command.data.state, state);
    assert.equal(command.operationId, input.eventId);
    assert.equal(command.issuedAt, input.occurredAt);
    assert.equal(command.id, input.runId);
    assert.equal(command.expectedRevision, input.expectedRevision);
    const validate = new Ajv({ strict: true }).compile(commandHelp({ kind }).dataSchema);
    assert.equal(validate(command.data), true, JSON.stringify(validate.errors));
    assert.ok(!Object.hasOwn(command.data, 'status'));
    assert.ok(!Object.hasOwn(command.data, 'patch'));
  }
  const guide = await readFile(
    new URL('../skills/geniustasker/references/host-events.md', import.meta.url),
    'utf8',
  );
  const examples = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  assert.equal(examples.length, 2);
  for (const value of examples) {
    assert.doesNotThrow(() => runEventCommand(value));
  }
});

test('unknown/private host payloads, arbitrary state and unbounded reports fail before authentication', async () => {
  const source = event(),
    noAccess = { session: () => assert.fail('Malformed events must not access credentials') };
  const invalid = [
    { ...source, type: 'heartbeat' },
    { ...source, eventId: 'unstable-id' },
    { ...source, occurredAt: undefined },
    { ...source, scope: 'memory:work' },
    { ...source, summary: ' ' },
    { ...source, summary: 'x'.repeat(2001) },
    { ...source, type: 'waiting', nextSteps: '' },
    { ...source, type: 'review', nextSteps: undefined },
    { ...source, type: 'process_exited', nextSteps: '' },
    { ...event('finished'), leaseSeconds: 60 },
    { ...source, evidence: [{ label: 'Private', url: 'https://user:password@example.test' }] },
    { ...source, evidence: [{ label: 'Wrong', url: 'file:///private/file' }] },
    { ...source, leaseSeconds: 901 },
    { ...event('started'), expectedRevision: '7' },
    ...[
      'stdout',
      'stderr',
      'env',
      'argv',
      'cwd',
      'token',
      'prompt',
      'logs',
      'data',
      'state',
      'patch',
      'actor',
      'profile',
    ].map((key) => ({ ...source, [key]: 'private-or-unrelated' })),
  ];
  for (const input of invalid) {
    await assert.rejects(reportRunEvent(noAccess, input), { code: 'invalid_arguments' });
  }
});

test('prepare is offline, duplicate invocation is serialized and conflicting event IDs never replace the journal', async (t) => {
  let calls = 0;
  const source = event();
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    calls++;
    return Response.json(receipt(JSON.parse(options.body)));
  });
  const before = await f.store.read(),
    prepared = await reportRunEvent(f.client, source, { prepareOnly: true });
  assert.equal(prepared.state, 'prepared');
  assert.equal(calls, 0);
  assert.deepEqual(prepared.request, runEventCommand(source));
  assert.deepEqual(await reportRunEvent(f.client, source, { prepareOnly: true }), prepared);
  const [a, b] = await Promise.all([
    reportRunEvent(f.client, source),
    reportRunEvent(f.client, source),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(a.receipt, b.receipt);
  assert.deepEqual(new Set([a.source, b.source]), new Set(['server', 'local_receipt']));
  const journal = new CommandJournal(f.client),
    saved = await journal.inspect(source.eventId);
  for (const prepareOnly of [true, false]) {
    await assert.rejects(
      reportRunEvent(
        f.client,
        { ...source, summary: 'A different event under the old ID.' },
        { prepareOnly },
      ),
      { code: 'idempotency_mismatch' },
    );
  }
  assert.deepEqual(await journal.inspect(source.eventId), saved);
  assert.equal(calls, 1);
  assert.deepEqual(await f.store.read(), before, 'event adapters must not change credentials');
  await f.store.locked(() => f.store.write({ ...before, profile_id: 'another-profile' }));
  for (const prepareOnly of [true, false]) {
    await assert.rejects(reportRunEvent(f.client, source, { prepareOnly }), {
      code: 'operation_identity_mismatch',
    });
  }
  assert.equal(calls, 1);
});

test('lost acknowledgement retains the exact command and explicit retry obtains one committed result', async (t) => {
  const source = event('process_exited'),
    requests = [],
    committed = new Map();
  const f = await fixture(t, async (_url, options) => {
    const command = JSON.parse(options.body);
    requests.push(command);
    if (!committed.has(command.operationId)) {
      committed.set(command.operationId, receipt(command));
    }
    if (requests.length === 1) {
      throw Error('Simulated lost response with private diagnostic text');
    }
    return Response.json(committed.get(command.operationId));
  });
  await assert.rejects(reportRunEvent(f.client, source), { code: 'network_unavailable' });
  assert.equal(requests.length, 1, 'no implicit retry');
  assert.equal(committed.size, 1);
  const journal = new CommandJournal(f.client),
    saved = await journal.inspect(source.eventId);
  assert.equal(saved.state, 'uncertain');
  assert.deepEqual(saved.request, runEventCommand(source));
  assert.equal((await reportRunEvent(f.client, source, { prepareOnly: true })).state, 'uncertain');
  assert.deepEqual(
    await journal.inspect(source.eventId),
    saved,
    'prepare must preserve uncertainty/error/retry state',
  );
  const result = await reportRunEvent(f.client, source);
  assert.equal(result.receipt.operationId, source.eventId);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(committed.size, 1);
  assert.equal(requests[0].data.state, 'NeedsReview');
});

test('server conflicts and cooldowns are surfaced without rebase, auto-claim or repeated calls', async (t) => {
  let calls = 0,
    throttled = false;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json(
      {
        error: {
          code: throttled ? 'agent_rate_limited' : 'revision_conflict',
          retryable: throttled,
          ...(throttled ? { retryAfterSeconds: 60 } : {}),
        },
      },
      { status: throttled ? 429 : 409 },
    );
  });
  const source = event('waiting');
  await assert.rejects(
    reportRunEvent(f.client, source),
    (error) => error.code === 'revision_conflict' && error.status === 409,
  );
  assert.equal(calls, 1);
  await assert.rejects(reportRunEvent(f.client, { ...source, expectedRevision: '8' }), {
    code: 'idempotency_mismatch',
  });
  assert.equal(calls, 1);
  throttled = true;
  const next = event();
  await assert.rejects(reportRunEvent(f.client, next), (error) => error.status === 429);
  assert.equal(calls, 2);
  await assert.rejects(reportRunEvent(f.client, next), { code: 'retry_pending' });
  assert.equal(calls, 2);
});

test('CLI event JSON can be prepared then sent once without extra stdout, registry calls or host capture', async (t) => {
  const source = event('started'),
    f = await fixture(t),
    file = join(f.directory, 'host-event.json');
  await writeFile(file, JSON.stringify(source));
  let calls = 0;
  const invoke = async (prepareOnly) => {
    let stdout = '',
      stderr = '';
    const status = await main(
      [
        'runs',
        'event',
        '--file',
        file,
        ...(prepareOnly ? ['--prepare'] : []),
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
        updateFetchImpl: () => assert.fail('JSON hooks must not fetch the registry'),
        fetchImpl: async (_url, options) => {
          calls++;
          return Response.json(receipt(JSON.parse(options.body)));
        },
      },
    );
    assert.equal(status, 0, stderr);
    assert.equal(stderr, '');
    return JSON.parse(stdout);
  };
  const prepared = await invoke(true);
  assert.equal(prepared.data.state, 'prepared');
  assert.equal(calls, 0);
  const sent = await invoke(false);
  assert.equal(sent.ok, true);
  assert.equal(sent.data.eventId, source.eventId);
  assert.equal(calls, 1);
  assert.equal((await invoke(false)).data.source, 'local_receipt');
  assert.equal(calls, 1);
});

test('real stdio MCP run_event advertises a write and shares prepare/replay with ordinary command journal', async (t) => {
  let calls = 0;
  const server = createServer(async (request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/api/agents/v1/commands');
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
    }
    calls++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(receipt(JSON.parse(raw))));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const endpoint = `http://127.0.0.1:${server.address().port}`,
    f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), endpoint)));
  const client = new Client({ name: 'host-event-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('fixtures/client-process.mjs', import.meta.url)),
      'mcp',
      f.directory,
      endpoint,
    ],
    stderr: 'pipe',
  });
  let errors = '';
  transport.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  await client.connect(transport);
  t.after(() => client.close());
  const tool = (await client.listTools()).tools.find((value) => value.name === 'tasker_run_event');
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.equal(tool.annotations.idempotentHint, true);
  const source = event('process_exited');
  const prepared = await client.callTool({
    name: tool.name,
    arguments: { event: source, prepareOnly: true },
  });
  assert.notEqual(prepared.isError, true, JSON.stringify(prepared));
  assert.equal(calls, 0);
  assert.equal(prepared.structuredContent.data.request.data.state, 'NeedsReview');
  const result = await client.callTool({ name: tool.name, arguments: { event: source } });
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.equal(calls, 1);
  const replay = await client.callTool({
    name: 'tasker_retry_command',
    arguments: { operationId: source.eventId },
  });
  assert.equal(replay.structuredContent.data.source, 'local_receipt');
  assert.equal(calls, 1);
  assert.equal(errors, '');
});
