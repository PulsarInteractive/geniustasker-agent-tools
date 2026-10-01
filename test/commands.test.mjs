import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CommandJournal, validateCommand, readCommandFile } from '../src/commands.mjs';
import { credentials } from '../src/client.mjs';
import { main } from '../src/cli.mjs';
import { fixture, tokens, origin } from './helpers.mjs';

const draft = () => ({
  scope: 'project:work',
  epoch: 'test-epoch',
  id: randomUUID(),
  expectedRevision: null,
  kind: 'task.create',
  data: { title: 'Prepare release', owner: 'owner' },
});
const receipt = (input) => ({
  operationId: input.operationId,
  scope: input.scope,
  epoch: input.epoch,
  kind: input.kind,
  cursor: '3',
  items: [{ id: input.id, revision: '3', collection: 'tasks', deleted: false }],
  affectedCollections: ['tasks'],
});

test('Memory creation explains UUID identity locally without rejecting stable page source IDs', () => {
  const id = randomUUID();
  const command = {
    ...draft(),
    kind: 'memory.create',
    scope: `memory:${id}`,
    epoch: id,
    id,
    operationId: randomUUID(),
    issuedAt: Date.now(),
    data: { title: 'Reference library' },
  };
  assert.equal(validateCommand(command).id, id);
  assert.throws(
    () =>
      validateCommand({
        ...command,
        id: 'source-id',
        scope: 'memory:source-id',
        epoch: 'source-id',
      }),
    (error) => error.code === 'invalid_arguments' && error.message.includes('UUID v4'),
  );
  assert.throws(() => validateCommand({ ...command, epoch: 'different' }), {
    code: 'invalid_arguments',
  });
  assert.equal(
    validateCommand({
      ...command,
      kind: 'memory.page.create',
      id: 'stable-page',
      data: { title: 'Reference', path: 'brand/reference', sourceId: 'source/document' },
    }).id,
    'stable-page',
  );
});

test('prepare is local and private; lost replies retain immutable requests for an explicit safe retry', async (t) => {
  const requests = [];
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.pathname, '/api/agents/v1/commands');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      throw new Error('Simulated lost reply after commit');
    }
    return Response.json(receipt(requests.at(-1)));
  });
  const journal = new CommandJournal(f.client),
    prepared = await journal.prepare(draft());
  assert.equal(requests.length, 0);
  const path = journal.store(prepared.operationId).path;
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.ok(!(await readFile(path, 'utf8')).includes('gta1.'));
  await assert.rejects(
    journal.retry(prepared.operationId),
    (error) =>
      error.code === 'network_unavailable' &&
      error.details.execution === 'unknown' &&
      error.details.operationId === prepared.operationId,
  );
  assert.equal((await journal.inspect(prepared.operationId)).state, 'uncertain');
  const result = await journal.retry(prepared.operationId);
  assert.equal(result.source, 'server');
  assert.deepEqual(requests[0], requests[1]);
  assert.equal((await journal.inspect(prepared.operationId)).state, 'confirmed');
  assert.equal((await journal.retry(prepared.operationId)).source, 'local_receipt');
  assert.equal(requests.length, 2);
  await assert.rejects(
    journal.execute({ ...prepared.request, data: { title: 'Different content' } }),
    { code: 'idempotency_mismatch' },
  );
  assert.equal(requests.length, 2);
});

test('a saved operation cannot cross profile, connection, session or environment after a replacement login', async (t) => {
  const f = await fixture(t, () => assert.fail('no network'));
  const journal = new CommandJournal(f.client),
    prepared = await journal.prepare(draft());
  for (const field of ['profile_id', 'connection_id', 'session_id']) {
    await f.store.locked(() =>
      f.store.write(credentials({ ...tokens(), [field]: 'replacement' }, origin)),
    );
    await assert.rejects(journal.retry(prepared.operationId), {
      code: 'operation_identity_mismatch',
    });
  }
  assert.equal((await journal.inspect(prepared.operationId)).state, 'prepared');
});

test('malformed success receipts remain uncertain; conflicts preserve the exact rejected request and never auto-retry', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json({ private: 'provider data' });
  });
  const journal = new CommandJournal(f.client),
    first = await journal.prepare(draft());
  await assert.rejects(journal.retry(first.operationId), { code: 'invalid_response' });
  assert.equal(calls, 1);
  assert.equal((await journal.inspect(first.operationId)).state, 'uncertain');
  f.transport.fetch = async () => {
    calls++;
    return Response.json(
      {
        error: {
          code: 'revision_conflict',
          message: 'Read the record again.',
          remediation: 'reread_record',
          retryable: false,
          execution: 'unknown',
        },
      },
      { status: 409 },
    );
  };
  const second = await journal.prepare({ ...draft(), kind: 'task.update', expectedRevision: '3' });
  await assert.rejects(
    journal.retry(second.operationId),
    (error) =>
      error.code === 'revision_conflict' &&
      error.status === 409 &&
      error.details.operationId === second.operationId,
  );
  assert.equal(calls, 2);
  assert.deepEqual((await journal.inspect(second.operationId)).request, second.request);
});

test('command inputs reject malformed revisions, hidden author fields, oversize content and unsafe file kinds', async (t) => {
  const f = await fixture(t, () => assert.fail('no network'));
  const base = { ...draft(), operationId: randomUUID(), issuedAt: Date.now() };
  for (const patch of [
    { operationId: '../../file' },
    { data: { creator: 'other' } },
    { kind: 'arbitrary.write' },
    { expectedRevision: '1' },
    { kind: 'task.update', expectedRevision: null },
    { data: { title: '界'.repeat(50000) } },
  ]) {
    assert.throws(() => validateCommand({ ...base, ...patch }), { code: 'invalid_arguments' });
  }
  const path = join(f.directory, 'request.json');
  await writeFile(path, JSON.stringify(base));
  assert.deepEqual(await readCommandFile(path), base);
  const linked = join(f.directory, 'linked.json');
  await symlink(path, linked);
  await assert.rejects(readCommandFile(linked), { code: 'invalid_arguments' });
  await assert.rejects(readCommandFile(f.directory), { code: 'invalid_arguments' });
});

test('CLI prepare/retry/inspect operates on files without putting text or tokens into arguments', async (t) => {
  const f = await fixture(t, async (_url, options) =>
    Response.json(receipt(JSON.parse(options.body))),
  );
  const path = join(f.directory, 'draft.json');
  await writeFile(path, JSON.stringify(draft()));
  let stdout = '',
    stderr = '';
  const output = {
    directory: f.directory,
    fetchImpl: f.transport.fetch,
    stdout: {
      write: (text) => {
        stdout += text;
      },
    },
    stderr: {
      write: (text) => {
        stderr += text;
      },
    },
  };
  const run = async (args) => {
    stdout = '';
    stderr = '';
    const code = await main([...args, '--origin', origin, '--allow-local', '--json'], output);
    assert.equal(code, 0, stderr);
    return JSON.parse(stdout).data;
  };
  const prepared = await run(['commands', 'prepare', '--file', path]);
  const result = await run(['commands', 'retry', '--operation', prepared.operationId]);
  assert.equal(result.source, 'server');
  assert.equal(
    (await run(['commands', 'inspect', '--operation', prepared.operationId])).state,
    'confirmed',
  );
  assert.ok(!stdout.includes('gta1.'));
});

test('knowledge fields permit page restrictions and images without membership escalation', () => {
  const base = {
    ...draft(),
    scope: 'memory:knowledge',
    epoch: 'knowledge',
    operationId: randomUUID(),
    issuedAt: Date.now(),
  };
  for (const [kind, data] of [
    [
      'memory.node.create',
      { title: 'Companion', detailLevel: 'identity', imageAssetId: randomUUID() },
    ],
    ['memory.page.create', { title: 'Plan', visibility: 'restricted', readRoles: ['finance'] }],
    ['memory.update', { contentRoles: [{ id: 'finance', name: 'Finance' }] }],
  ]) {
    assert.deepEqual(
      validateCommand({
        ...base,
        kind,
        data,
        ...(kind === 'memory.update' ? { id: 'knowledge', expectedRevision: '1' } : {}),
      }).data,
      data,
    );
  }
  assert.throws(() =>
    validateCommand({
      ...base,
      kind: 'memory.page.create',
      data: { title: 'Plan', roles: ['MEMORY.ADMIN'] },
    }),
  );
});
