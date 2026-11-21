import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { fixture, origin } from './helpers.mjs';
import { main } from '../src/cli.mjs';
import { createMcpServer } from '../src/mcp.mjs';
import { scopedStorageRequest } from '../src/storage-resources.mjs';

const operationId = '00000000-0000-4000-8000-000000000002',
  assetId = 'stored-original';
const scope = 'project:fixture';
function receipt(state = 'preview') {
  const done = state === 'complete';
  return {
    scope,
    operationId,
    state,
    mode: 'light',
    estimatedBytes: 430,
    recoveredBytes: done ? 430 : 0,
    items: [
      {
        assetId,
        name: 'clip.mp4',
        state: done ? 'removed' : 'ready',
        reason: null,
        estimatedBytes: 430,
        recoveredBytes: done ? 430 : 0,
      },
      {
        assetId: 'shared',
        name: 'cover.png',
        state: 'excluded',
        reason: 'shared',
        estimatedBytes: 0,
        recoveredBytes: 0,
      },
    ],
  };
}

test('CLI and MCP review a scoped selection, require confirmation, reread the operation and distinguish actual recovery', async (t) => {
  const calls = [];
  let canClean = false,
    state = 'preview';
  const fetchImpl = async (url, options) => {
    const u = new URL(url),
      path = u.pathname.replace('/api/agents/v1/', '');
    const body = options.body ? JSON.parse(options.body) : Object.fromEntries(u.searchParams);
    calls.push([path, body]);
    if (path === 'storage/resources') {
      assert.equal(body.limit, '1');
      assert.equal(body.type, 'video');
      return Response.json({
        scope,
        items: [
          {
            scope,
            assetId,
            name: 'clip.mp4',
            mime: 'video/mp4',
            category: 'ticketAttachment',
            state: 'archived',
            revision: '2',
            chargedBytes: 430,
            reclaimableBytes: 430,
            sharedBytes: 0,
            protectedBytes: 0,
            issuedAt: 1,
            reason: null,
          },
        ],
        coverage: 'complete',
        nextCursor: 'a+/=b',
      });
    }
    if (path === 'memory/design-discussion') {
      assert.equal(body.scope, 'memory:design');
      assert.equal(body.threadId, 'conversation');
      assert.equal(body.cursor, 'a+/=b');
      return Response.json({
        scope: body.scope,
        epoch: 'e',
        checkpoint: '1',
        items: [{ id: 'reply', kind: 'reply', verdict: 'approved' }],
        nextCursor: null,
      });
    }
    if (path === 'storage/cleanup/preview') {
      return Response.json(receipt());
    }
    if (path === 'storage/cleanup/status') {
      return Response.json(receipt(state));
    }
    if (path === 'storage/cleanup/apply') {
      if (!canClean) {
        return Response.json({ error: { code: 'agent_permission_denied' } }, { status: 403 });
      }
      state = 'complete';
      return Response.json(receipt(state));
    }
    assert.fail(path);
  };
  const f = await fixture(t, fetchImpl);
  const cli = async (words, input) => {
    const file = join(f.directory, 'query.json');
    await writeFile(file, JSON.stringify(input));
    let output = '';
    const status = await main(
      [...words, '--file', file, '--origin', origin, '--allow-local', '--json'],
      {
        directory: f.directory,
        fetchImpl,
        stdout: { write: (v) => (output += v) },
        stderr: { write: (v) => (output += v) },
      },
    );
    assert.equal(status, 0, output);
    return JSON.parse(output).data;
  };
  const list = await cli(['storage', 'resources'], { scope, type: 'video', limit: 1 });
  assert.equal(list.items[0].reclaimableBytes, 430);
  const discussion = await cli(['memory', 'design-discussion'], {
    scope: 'memory:design',
    variantId: 'screen',
    threadId: 'conversation',
    cursor: list.nextCursor,
  });
  assert.equal(discussion.items[0].id, 'reply');
  const client = new Client({ name: 'inspection', version: '1' }),
    server = createMcpServer(f.client);
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(a);
  await client.connect(b);
  const tools = (await client.listTools()).tools;
  assert.equal(
    tools.find((t) => t.name === 'tasker_project_cleanup_apply').annotations.destructiveHint,
    true,
  );
  assert.equal(
    tools.find((t) => t.name === 'tasker_memory_cleanup_preview').annotations.destructiveHint,
    false,
  );
  assert.ok(!tools.some((t) => t.name === 'tasker_account_storage_resources'));
  const call = async (name, data) => client.callTool({ name, arguments: data });
  const draft = await call('tasker_project_cleanup_preview', {
    scope,
    assetIds: [assetId, 'shared'],
    mode: 'light',
  });
  assert.equal(draft.structuredContent.data.items[1].reason, 'shared');
  const selected = { scope, operationId };
  const initial = calls.length;
  for (const data of [
    selected,
    { ...selected, confirmed: false },
    { ...selected, confirmed: true, assetIds: [assetId] },
    { ...selected, confirmed: true, scope: 'personal:me' },
  ]) {
    await assert.rejects(
      call('tasker_project_cleanup_apply', data).then((result) => {
        if (result.isError) {
          throw Error('rejected');
        }
      }),
    );
  }
  assert.equal(calls.length, initial);
  const denied = await call('tasker_project_cleanup_apply', { ...selected, confirmed: true });
  assert.equal(denied.isError, true);
  assert.deepEqual(
    calls.slice(-2).map((c) => c[0]),
    ['storage/cleanup/status', 'storage/cleanup/apply'],
  );
  assert.equal(state, 'preview');
  canClean = true;
  const accepted = await cli(['storage', 'cleanup-apply'], { ...selected, confirmed: true });
  assert.equal(accepted.recoveredBytes, 430);
  assert.equal(accepted.items[1].state, 'excluded');
  assert.deepEqual(await cli(['storage', 'cleanup-status'], selected), accepted);
  const thread = await call('tasker_memory_design_discussion', {
    scope: 'memory:design',
    variantId: 'screen',
    threadId: 'conversation',
    cursor: 'a+/=b',
  });
  assert.equal(thread.structuredContent.data.items[0].id, 'reply');
});

test('a denied or mismatched preflight cannot send a destructive request, and selected rows cannot be silently replaced', async () => {
  const selected = { scope, operationId, confirmed: true };
  for (const wrong of ['scope', 'id', 'malformed', 'denied']) {
    let calls = 0;
    await assert.rejects(
      scopedStorageRequest('tasker_project_cleanup_apply', selected, async (method) => {
        calls++;
        assert.equal(method, 'GET');
        if (wrong === 'denied') {
          throw Error('expired');
        }
        return {
          ...receipt(),
          ...(wrong === 'scope'
            ? { scope: 'project:foreign' }
            : wrong === 'id'
              ? { operationId: 'other' }
              : { recoveredBytes: -1 }),
        };
      }),
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    scopedStorageRequest(
      'tasker_project_cleanup_preview',
      { scope, mode: 'deep', assetIds: [assetId, 'other'] },
      async () => receipt(),
    ),
    (e) => e.code === 'invalid_response',
  );
  for (const ids of [[assetId, assetId], [], Array.from({ length: 17 }, (_, i) => 'id' + i)]) {
    await assert.rejects(
      scopedStorageRequest(
        'tasker_project_cleanup_preview',
        { scope, mode: 'light', assetIds: ids },
        () => assert.fail('invalid selections never leave the client'),
      ),
      (e) => e.code === 'invalid_arguments',
    );
  }
});
