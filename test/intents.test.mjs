import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readIntents, previewIntent } from '../src/intents.mjs';
import { validateCommand, commandHelp } from '../src/commands.mjs';
import { fixture, origin } from './helpers.mjs';
import { main } from '../src/cli.mjs';
const id = '11111111-1111-4111-8111-111111111111',
  intent = '22222222-2222-4222-8222-222222222222';
const input = {
  scope: 'project:p',
  selection: {
    kind: 'focus',
    objective: 'finish',
    taskIds: [id],
    startsAt: null,
    endsAt: '2026-11-18T09:00:00Z',
  },
};
const snapshot = {
  scope: input.scope,
  epoch: 'e',
  projectRevision: '1',
  intentRevision: null,
  serverTime: '2026-11-17T09:00:00.000Z',
  entries: [],
};
const preview = {
  ...snapshot,
  selection: input.selection,
  sourceVersion: 'a'.repeat(64),
  replaces: [],
};
test('one explicit metered POST per read/preview, no journal, cache, credentials change or automatic retry', async (t) => {
  const calls = [];
  const f = await fixture(t, async (url, options) => {
    calls.push({ path: url.pathname, input: JSON.parse(options.body) });
    assert.equal(options.method, 'POST');
    return Response.json(url.pathname.endsWith('/preview') ? preview : snapshot);
  });
  const before = await f.store.read(),
    files = await readdir(f.directory);
  assert.deepEqual(await readIntents(f.client, { scope: input.scope }), snapshot);
  assert.deepEqual(await previewIntent(f.client, input), preview);
  assert.deepEqual(calls, [
    { path: '/api/agents/v1/intents/read', input: { scope: input.scope } },
    { path: '/api/agents/v1/intents/preview', input },
  ]);
  assert.deepEqual(await f.store.read(), before);
  assert.deepEqual(await readdir(f.directory), files);
});
test('invalid input fails before authentication and malformed or unrelated results never become authoritative previews', async (t) => {
  const forbidden = { accessToken: () => assert.fail('Invalid input must not authenticate') };
  for (const change of [
    { scope: 'memory:p' },
    { selection: { ...input.selection, taskIds: [id, id] } },
    { selection: { ...input.selection, kind: 'defer' } },
    { selection: { ...input.selection, endsAt: 'tomorrow' } },
    { ownerId: 'other' },
  ]) {
    await assert.rejects(previewIntent(forbidden, { ...input, ...change }), {
      code: 'invalid_arguments',
    });
  }
  for (const patch of [
    { scope: 'project:elsewhere' },
    { selection: { ...input.selection, taskIds: [intent] } },
    { replaces: [intent] },
    { sourceVersion: 'invalid' },
    {
      entries: [
        {
          id: intent,
          kind: 'focus',
          objective: 'finish',
          taskIds: [id],
          openTaskIds: [intent],
          state: 'active',
          effective: true,
          startsAt: snapshot.serverTime,
          endsAt: input.selection.endsAt,
          supersededBy: null,
        },
      ],
    },
  ]) {
    const f = await fixture(t, async () => Response.json({ ...preview, ...patch }));
    await assert.rejects(previewIntent(f.client, input), { code: 'invalid_response' });
  }
});
test('only the declared intent aggregate supports initial null and current non-null revisions; generated help exposes every field', () => {
  const help = commandHelp({ kind: 'intent.change' });
  assert.equal(help.upsert, true);
  assert.deepEqual(
    help.requiredFields.sort(),
    ['decision', 'id', 'expectedIntentRevision', 'selection', 'sourceVersion', 'replaces'].sort(),
  );
  for (const revision of [null, '2']) {
    assert.equal(
      validateCommand({
        operationId: intent,
        issuedAt: 1,
        scope: 'project:p',
        epoch: 'e',
        id: 'owner',
        expectedRevision: revision,
        kind: 'intent.change',
        data: {},
      }).expectedRevision,
      revision,
    );
  }
  assert.throws(
    () =>
      validateCommand({
        operationId: intent,
        issuedAt: 1,
        scope: 'project:p',
        epoch: 'e',
        id,
        expectedRevision: null,
        kind: 'task.update',
        data: { title: 'Wrong revision' },
      }),
    { code: 'invalid_arguments' },
  );
});
test('CLI preview submits the exact file once and keeps stdout machine-readable', async (t) => {
  const f = await fixture(t),
    file = join(f.directory, 'preview.json');
  await writeFile(file, JSON.stringify(input));
  let stdout = '',
    stderr = '',
    calls = 0;
  const code = await main(
    ['intents', 'preview', '--file', file, '--origin', origin, '--allow-local', '--json'],
    {
      directory: f.directory,
      runtimeDirectory: join(f.directory, 'runtime'),
      isTTY: false,
      stdout: {
        write: (v) => {
          stdout += v;
        },
      },
      stderr: {
        write: (v) => {
          stderr += v;
        },
      },
      fetchImpl: async (url, options) => {
        if (url.pathname === '/api/agents/v1/intents/preview') {
          calls++;
          assert.deepEqual(JSON.parse(options.body), input);
          return Response.json(preview);
        }
        return new Response('', { status: 404 });
      },
    },
  );
  assert.equal(code, 0, stderr);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(stdout).data.sourceVersion, preview.sourceVersion);
});
