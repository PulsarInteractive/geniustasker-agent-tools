import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture, tokens } from './helpers.mjs';
import { credentials } from '../src/client.mjs';

const run = promisify(execFile);
const executable = fileURLToPath(new URL('fixtures/client-process.mjs', import.meta.url));
async function http(t, handle) {
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}
test('independent OS processes renew a shared context exactly once', async (t) => {
  let count = 0;
  const origin = await http(t, async (request, response) => {
    assert.equal(request.url, '/api/agents/oauth/token');
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }
    assert.equal(new URLSearchParams(body).get('refresh_token'), tokens().refresh_token);
    count++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(tokens('b')));
  });
  const f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), origin, Date.now() - 1000000)));
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      run(process.execPath, [executable, 'refresh', f.directory, origin]),
    ),
  );
  assert.equal(count, 1);
  assert.equal(new Set(results.map((r) => r.stdout)).size, 1);
  assert.ok(results.every((r) => !r.stderr && /^[0-9a-f]{64}$/.test(r.stdout)));
});

test('official MCP client discovers strict tools and reads pages over real stdio without auth leakage', async (t) => {
  const requests = [];
  const origin = await http(t, (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${tokens().access_token}`);
    requests.push(request.url);
    response.setHeader('Content-Type', 'application/json');
    const url = new URL(request.url, 'http://local');
    if (url.pathname.endsWith('/knowledge')) {
      const mode = url.searchParams.get('mode');
      response.end(
        JSON.stringify({
          scope: url.searchParams.get('scope'),
          mode,
          items: [],
          nodes: mode === 'graph' ? [{ id: url.searchParams.get('center') }] : [],
          edges: [],
          truncated: false,
          nextAfter: null,
        }),
      );
    } else if (url.pathname.endsWith('/reference')) {
      response.end(
        JSON.stringify({
          scope: url.searchParams.get('scope'),
          pageId: url.searchParams.get('pageId'),
          blockId: null,
          status: 'unavailable',
          epoch: null,
          accessRevision: null,
          page: null,
        }),
      );
    } else if (url.pathname.endsWith('/capabilities')) {
      response.end(JSON.stringify({ writesAvailable: false, collections: [{ id: 'tasks' }] }));
    } else if (url.pathname.endsWith('/projects')) {
      response.end(JSON.stringify({ items: [], nextAfter: 'next-visible-scan' }));
    } else if (url.pathname.endsWith('/answers')) {
      response.end(
        JSON.stringify({
          scope: 'project:work',
          question: 'question-one',
          epoch: 'e',
          checkpoint: 'answers-cursor',
          anonymous: false,
          counts: [],
          state: 'Open',
          items: [{ user: 'member', choices: [], text: 'Keyboard review' }],
          nextAfter: null,
        }),
      );
    } else if (url.pathname.endsWith('/resources')) {
      response.end(
        JSON.stringify({
          items: [{ id: 'task-1', data: { title: 'Example' } }],
          epoch: 'e',
          checkpoint: 'c',
          nextAfter: null,
        }),
      );
    } else if (url.pathname.endsWith('/changes')) {
      response.end(
        JSON.stringify({
          scope: 'project:one',
          collection: 'tasks',
          epoch: 'e',
          checkpoint: '8',
          items: [{ id: 'task-1', revision: '8', kind: 'remove', data: null }],
          omittedIds: [],
          nextCursor: 'continuation',
          hasMore: false,
          pollAfterSeconds: 5,
        }),
      );
    } else {
      response.statusCode = 403;
      response.end(
        JSON.stringify({
          error: {
            code: 'agent_permission_denied',
            message: 'Access denied.',
            remediation: 'review_grant',
            retryable: false,
            requestId: 'test-request',
          },
        }),
      );
    }
  });
  const f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), origin)));
  const client = new Client({ name: 'tasker-integration-review', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [executable, 'mcp', f.directory, origin],
    stderr: 'pipe',
  });
  let errors = '';
  transport.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  await client.connect(transport).catch((error) => {
    throw new Error(error.message + ': ' + errors);
  });
  t.after(() => client.close());
  const listing = await client.listTools();
  assert.equal(listing.tools.length, 19);
  const search = await client.callTool({
    name: 'tasker_search',
    arguments: { scope: 'memory:one', query: 'owl' },
  });
  assert.equal(search.structuredContent.data.mode, 'search');
  const graph = await client.callTool({
    name: 'tasker_graph',
    arguments: { scope: 'memory:one', center: 'owl' },
  });
  assert.equal(graph.structuredContent.data.nodes[0].id, 'owl');
  const reference = await client.callTool({
    name: 'tasker_reference',
    arguments: { scope: 'memory:friend', pageId: 'owl' },
  });
  assert.equal(reference.structuredContent.data.status, 'unavailable');
  assert.ok(listing.tools.every((tool) => tool.inputSchema.additionalProperties === false));
  assert.equal(
    listing.tools.find((tool) => tool.name === 'tasker_execute_command').annotations.readOnlyHint,
    false,
  );
  assert.equal(
    listing.tools.find((tool) => tool.name === 'tasker_execute_command').annotations
      .destructiveHint,
    true,
  );
  const cap = await client.callTool({ name: 'tasker_capabilities', arguments: {} });
  assert.equal(cap.structuredContent.data.writesAvailable, false);
  const projects = await client.callTool({ name: 'tasker_projects', arguments: {} });
  assert.equal(projects.structuredContent.data.nextAfter, 'next-visible-scan');
  const page = await client.callTool({
    name: 'tasker_resources',
    arguments: {
      scope: 'project:one',
      collection: 'tasks',
      after: 'cursor',
      epoch: 'e',
      checkpoint: 'c',
    },
  });
  assert.equal(page.structuredContent.data.items[0].id, 'task-1');
  assert.ok(requests.at(-1).includes('checkpoint=c'));
  for (const name of ['tasker_changes', 'tasker_watch']) {
    const delta = await client.callTool({
      name,
      arguments: { scope: 'project:one', collection: 'tasks', cursor: 'initial' },
    });
    const result = delta.structuredContent.data;
    assert.equal((result.page ?? result).items[0].kind, 'remove');
    assert.ok(requests.at(-1).includes('cursor=initial'));
  }
  const answers = await client.callTool({
    name: 'tasker_question_answers',
    arguments: {
      scope: 'project:work',
      question: 'question-one',
      epoch: 'e',
      checkpoint: 'answers-cursor',
    },
  });
  assert.equal(answers.structuredContent.data.items[0].text, 'Keyboard review');
  assert.ok(requests.at(-1).includes('question=question-one'));
  const denied = await client.callTool({ name: 'tasker_identity', arguments: {} });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent.error.code, 'agent_permission_denied');
  const before = requests.length;
  const invalid = await client
    .callTool({ name: 'tasker_projects', arguments: { token: 'not-permitted' } })
    .catch((error) => error);
  assert.ok(invalid.isError || invalid instanceof Error);
  assert.equal(requests.length, before);
  assert.equal(errors, '');
  assert.ok(!JSON.stringify([listing, cap, page, denied]).includes('gta1.'));
});

test('separate CLI processes serialize a saved command and send one write', async (t) => {
  const { CommandJournal } = await import('../src/commands.mjs');
  let writes = 0;
  const origin = await http(t, async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(request.url, '/api/agents/v1/commands');
    writes++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        operationId: input.operationId,
        scope: input.scope,
        epoch: input.epoch,
        kind: input.kind,
        cursor: '1',
        items: [{ id: input.id, revision: '1', collection: 'tasks', deleted: false }],
        affectedCollections: ['tasks'],
      }),
    );
  });
  const f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), origin)));
  f.client.transport.origin = origin;
  const prepared = await new CommandJournal(f.client).prepare({
    scope: 'project:work',
    epoch: 'epoch',
    id: 'task-one',
    kind: 'task.create',
    expectedRevision: null,
    data: { title: 'One task' },
  });
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      run(process.execPath, [executable, 'command', f.directory, origin, prepared.operationId]),
    ),
  );
  assert.equal(writes, 1);
  assert.deepEqual(results.map((result) => JSON.parse(result.stdout).source).sort(), [
    'local_receipt',
    'local_receipt',
    'server',
  ]);
  assert.ok(results.every((result) => !result.stderr));
});

test('official MCP stdio manages and selects a profile without emitting credentials', async (t) => {
  const grant = { allResources: false, resourceIds: ['project:one'], permissions: ['tasks:read'] };
  let active = 'profile',
    tokenLetter = 'a';
  const profiles = new Map([
    [
      'profile',
      {
        id: 'profile',
        connectionId: 'connection',
        name: 'Default',
        revision: 1,
        grant,
        disabledAt: null,
      },
    ],
  ]);
  const origin = await http(t, async (request, response) => {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
    }
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/agents/oauth/token') {
      const form = new URLSearchParams(raw);
      assert.equal(form.get('refresh_token'), tokens(tokenLetter).refresh_token);
      active = form.get('profile_id');
      tokenLetter = 'b';
      response.end(JSON.stringify({ ...tokens(tokenLetter), profile_id: active }));
      return;
    }
    assert.equal(request.headers.authorization, `Bearer ${tokens(tokenLetter).access_token}`);
    if (request.url === '/api/agents/v1/profiles' && request.method === 'GET') {
      response.end(
        JSON.stringify({
          connectionId: 'connection',
          currentProfileId: active,
          items: [...profiles.values()].map((p) => ({
            id: p.id,
            name: p.name,
            revision: p.revision,
            current: p.id === active,
            permissions: p.grant.permissions,
            allResources: p.grant.allResources,
            resourceCount: p.grant.resourceIds.length,
          })),
        }),
      );
    } else if (request.url === '/api/agents/v1/profiles') {
      const input = JSON.parse(raw),
        profile = { ...input, connectionId: 'connection', revision: 1, disabledAt: null };
      profiles.set(profile.id, profile);
      response.end(JSON.stringify(profile));
    } else if (request.url === '/api/agents/v1/profile') {
      const input = JSON.parse(raw);
      assert.equal(input.profileId, active);
      const updated = {
        ...profiles.get(active),
        name: input.name,
        grant: input.grant,
        revision: input.expectedRevision + 1,
      };
      profiles.set(active, updated);
      response.end(JSON.stringify(updated));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  });
  const f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), origin)));
  const client = new Client({ name: 'tasker-profile-review', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [executable, 'mcp', f.directory, origin],
    stderr: 'pipe',
  });
  let errors = '';
  transport.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  await client.connect(transport);
  t.after(() => client.close());
  const id = crypto.randomUUID(),
    results = [];
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    results.push(result);
    return result.structuredContent.data;
  };
  assert.equal((await call('tasker_create_profile', { id, name: 'Documentation', grant })).id, id);
  assert.equal((await call('tasker_profiles', {})).items.length, 2);
  assert.equal((await call('tasker_select_profile', { profileId: id })).profileId, id);
  const restricted = await call('tasker_restrict_profile', {
    profileId: id,
    name: 'Paused reader',
    expectedRevision: 1,
    grant: { allResources: false, resourceIds: [], permissions: [] },
  });
  assert.equal(restricted.revision, 2);
  assert.equal((await f.store.read()).profile_id, id);
  assert.ok(!JSON.stringify(results).includes('gta1.'));
  assert.equal(errors, '');
});
