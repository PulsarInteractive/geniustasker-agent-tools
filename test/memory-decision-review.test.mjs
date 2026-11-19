import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { main } from '../src/cli.mjs';
import { createMcpServer } from '../src/mcp.mjs';
import { reviewProjectMemory } from '../src/memory-editorial.mjs';
import { fixture, origin } from './helpers.mjs';

const project = 'project:launch';
const scope = 'memory:guides';
const command = 'memory.page.proposeRevision';
const evidence = { kind: 'tested-release', reference: 'release-42' };
const input = {
  scope: project,
  change: 'decision',
  domain: 'usage',
  sources: [evidence],
  candidates: [{ pageId: 'offline', revision: '8' }],
};
function api() {
  const grant = { permissions: ['memory:write'], resourceIds: [scope], allResources: false };
  const state = {
    rules: {
      memoryId: 'guides',
      folderId: null,
      language: 'fr',
      guidance: '',
      stylePageId: null,
      autoDomains: ['usage'],
      suggestionState: 'ask',
    },
    review: { ownerId: 'reviewer', handled: [] },
    identity: { connection: { grant }, profile: { grant } },
    discovery: { commands: [{ kind: command }] },
    revision: '8',
    calls: [],
  };
  const get = async (route, query) => {
    state.calls.push(route);
    if (route === 'project/documentation') {
      assert.equal(query.scope, project);
      return { scope: project, revision: '3', epoch: 'project-epoch', documentation: state.rules };
    }
    if (route === 'resources') {
      assert.deepEqual(query, { scope, collection: 'pageIndex', id: 'offline' });
      return {
        scope,
        collection: 'pageIndex',
        epoch: 'memory-epoch',
        checkpoint: '9',
        items: [
          { id: 'offline', revision: state.revision, data: { decisionReview: state.review } },
        ],
      };
    }
    if (route === 'me') {
      return state.identity;
    }
    if (route === 'capabilities') {
      return state.discovery;
    }
    assert.fail('Unexpected read or mutation: ' + route);
  };
  return { state, get };
}

test('CLI and connected MCP return the same restricted proposal and never write the note', async (t) => {
  const { state, get } = api();
  const f = await fixture(t);
  const file = join(f.directory, 'review.json');
  await writeFile(file, JSON.stringify(input));
  let stdout = '',
    stderr = '';
  const code = await main(
    ['memory', 'review', '--file', file, '--origin', origin, '--allow-local', '--json'],
    {
      directory: f.directory,
      stdout: { write: (s) => (stdout += s) },
      stderr: { write: (s) => (stderr += s) },
      fetchImpl: async (url, options) => {
        assert.equal(options.method, 'GET');
        return Response.json(
          await get(
            url.pathname.replace('/api/agents/v1/', ''),
            Object.fromEntries(url.searchParams),
          ),
        );
      },
    },
  );
  assert.equal(code, 0, stderr);
  const preview = JSON.parse(stdout).data;
  assert.deepEqual(
    {
      action: preview.action,
      command: preview.command,
      scope: preview.scope,
      revision: preview.revision,
      epoch: preview.epoch,
      owner: preview.ownerId,
      ref: preview.evidenceRef,
      kind: preview.evidenceKind,
      approval: preview.needsUserApprovalToSubmit,
      applied: preview.applied,
    },
    {
      action: 'prepare_proposal',
      command,
      scope,
      revision: '8',
      epoch: 'memory-epoch',
      owner: 'reviewer',
      ref: evidence.reference,
      kind: evidence.kind,
      approval: false,
      applied: false,
    },
  );
  assert.deepEqual(state.calls, ['project/documentation', 'resources', 'me', 'capabilities']);
  const client = new Client({ name: 'tracked-memory-test', version: '1' });
  const server = createMcpServer({ get });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(a);
  await client.connect(b);
  state.calls.length = 0;
  const result = await client.callTool({ name: 'tasker_memory_review', arguments: input });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent.data, preview);
  const help = await client.callTool({
    name: 'tasker_command_help',
    arguments: { kind: preview.command },
  });
  assert.equal(help.isError, undefined);
  assert.equal(help.structuredContent.data.permission, 'memory:write');
  assert.deepEqual(help.structuredContent.data.fields, [
    'blockId',
    'original',
    'replacement',
    'evidenceKind',
    'evidenceRef',
  ]);
  assert.deepEqual(state.calls, ['project/documentation', 'resources', 'me', 'capabilities']);
  state.rules.autoDomains = [];
  assert.equal((await reviewProjectMemory({ get }, input)).needsUserApprovalToSubmit, true);
});

test('pending, deferred, dismissed and resolved decisions never reprompt, even inside an automatic domain', async () => {
  const { get, state } = api(),
    decide = (extra = {}) => reviewProjectMemory({ get }, { ...input, ...extra });
  for (const preference of ['later', 'dismissed']) {
    state.rules.suggestionState = preference;
    assert.equal((await decide()).reason, 'suggestion_' + preference);
  }
  state.rules.suggestionState = 'ask';
  state.review.pending = { blockId: 'offline-mode' };
  assert.equal((await decide()).reason, 'memory_decision_review_pending');
  state.review.pending = null;
  state.review.handled = [JSON.stringify(['offline-mode', evidence.kind, evidence.reference])];
  assert.equal((await decide()).reason, 'memory_decision_already_reviewed');
  assert.equal(
    (await decide({ sources: [{ ...evidence, kind: 'verified-behavior' }] })).reason,
    'memory_decision_already_reviewed',
  );
  assert.ok(!state.calls.includes('me'));
  const next = await decide({
    sources: [evidence, { kind: 'verified-behavior', reference: 'new test receipt' }],
  });
  assert.equal(next.evidenceRef, 'new test receipt');
  assert.equal(next.command, command);
  state.review.handled = ['{'];
  await assert.rejects(decide(), { code: 'invalid_response' });
});

test('old server, stale page, weak evidence and missing grants never suggest a direct edit', async () => {
  const { get, state } = api(),
    decide = (extra = {}) => reviewProjectMemory({ get }, { ...input, ...extra });
  const valid = state.identity;
  for (const side of ['connection', 'profile']) {
    state.identity = {
      ...valid,
      [side]: {
        grant: {
          permissions: ['memory:write'],
          resourceIds: ['memory:other'],
          allResources: false,
        },
      },
    };
    const readOnly = await decide();
    assert.equal(readOnly.reason, 'no_delegated_write');
    assert.equal(readOnly.command, undefined);
  }
  state.identity = valid;
  state.discovery = { commands: [{ kind: 'memory.page.update' }] };
  const older = await decide();
  assert.equal(older.reason, 'decision_review_command_unavailable');
  assert.equal(older.command, undefined);
  state.revision = '9';
  assert.equal((await decide()).reason, 'reread_changed_page');
  for (const source of [
    { kind: 'task-status', reference: 'Done' },
    { ...evidence, reference: '   ' },
    { ...evidence, reference: 'x\ny' },
  ]) {
    assert.equal((await decide({ sources: [source] })).reason, 'verify_durable_source');
  }
  state.revision = '8';
  state.review = null;
  assert.equal((await decide()).action, 'prepare_update');
});
