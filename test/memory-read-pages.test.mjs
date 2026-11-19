import test from 'node:test';
import assert from 'node:assert/strict';
import { readMemoryPages } from '../src/memory-read-pages.mjs';
import { memoryHistoryRequest } from '../src/memory-history.mjs';
import { workflow } from '../src/workflows.mjs';
import { AgentError } from '../src/errors.mjs';
import { setTimeout } from 'node:timers/promises';
import Ajv from 'ajv';
import tools from '../remote/tool-catalog.json' with { type: 'json' };

const scope = 'memory:space';
const selection = (n) => ({
  scope,
  pages: Array.from({ length: n }, (_, i) => ({ pageId: 'p' + i, mode: 'blocks' })),
});
function page(query, extra = {}) {
  return {
    scope,
    id: query.pageId,
    title: query.pageId,
    mode: query.mode,
    revision: '21',
    epoch: 'epoch',
    checkpoint: '33',
    accessRevision: 'acl',
    notModified: false,
    items: [{ id: 'one', kind: 'markdown', order: 0, text: 'Café 🍎', complete: true }],
    nextCursor: null,
    ...extra,
  };
}
const read = (get, input) => readMemoryPages({ get }, input);

test('five selected pages cost five delegated reads, at most two in flight, retaining order and bounds in UTF-8', async () => {
  let active = 0,
    peak = 0;
  const calls = [];
  const input = selection(5);
  input.pages[3].blockIds = ['one'];
  const batch = await read(async (route, query) => {
    assert.equal(route, 'memory/sections');
    calls.push(query);
    peak = Math.max(peak, ++active);
    await setTimeout(query.pageId === 'p1' ? 5 : 1);
    active--;
    return page(query);
  }, input);
  assert.equal(peak, 2);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].epoch, undefined);
  assert.ok(calls.slice(1).every((q) => q.epoch === 'epoch' && q.checkpoint === '33'));
  assert.equal(calls[3].blockIds, 'one');
  assert.deepEqual(
    batch.pages.map((p) => p.pageId),
    input.pages.map((p) => p.pageId),
  );
  assert.equal(batch.complete, 5);
  assert.equal(batch.partial, false);
  assert.ok(Buffer.byteLength(JSON.stringify(batch)) <= 65536);
});

test('selected block fragments and unchanged validators use an ordinary freshly authorized read for every continuation', async () => {
  let count = 0;
  const get = async (_, q) => {
    count++;
    if (q.knownRevision === '21') {
      return page(q, { notModified: true, items: [] });
    }
    if (q.cursor) {
      assert.equal(q.cursor, 'position');
      assert.equal(q.revision, '21');
      assert.equal(q.blockIds, 'one');
      return page(q, {
        items: [{ id: 'one', kind: 'markdown', order: 0, text: 'ç', offset: 2, complete: true }],
      });
    }
    return page(q, {
      items: [{ id: 'one', kind: 'markdown', order: 0, text: 'éa', offset: 0, complete: false }],
      nextCursor: 'position',
    });
  };
  const input = { scope, pages: [{ pageId: 'p', mode: 'blocks', blockIds: ['one'] }] };
  const first = await read(get, input);
  assert.equal(first.pages[0].status, 'partial');
  assert.equal(first.complete, 0);
  const next = await read(get, {
    ...input,
    epoch: first.epoch,
    checkpoint: first.checkpoint,
    pages: [
      { ...input.pages[0], revision: first.pages[0].revision, cursor: first.pages[0].nextCursor },
    ],
  });
  assert.equal(next.pages[0].items[0].offset, 2);
  assert.equal(next.complete, 1);
  const cached = await read(get, { ...input, pages: [{ ...input.pages[0], knownRevision: '21' }] });
  assert.equal(cached.pages[0].status, 'unchanged');
  assert.equal(count, 3);
});
test('lost grant, changed snapshot, malformed response and ACL disagreement discard all page content', async () => {
  for (const broken of [
    () => {
      throw new AgentError('access_denied', 'No access', { status: 403 });
    },
    (q) => page(q, { checkpoint: '35' }),
    (q) => page(q, { accessRevision: 'new' }),
    (q) => page(q, { id: 'other' }),
    (q) =>
      page(q, { items: [{ id: 'one', order: 0, kind: 'markdown', text: '🍎'.repeat(20000) }] }),
  ]) {
    const calls = [];
    await assert.rejects(
      read(async (_, q) => {
        calls.push(q.pageId);
        return q.pageId === 'p2' ? broken(q) : page(q);
      }, selection(5)),
    );
    assert.ok(calls.length <= 3);
  }
});
test('quota during a batch returns covered pages and explicit deferred IDs without retry or quota bypass', async () => {
  const calls = [];
  const qerror = new AgentError('rate_limited', 'wait', { status: 429, retryAfterSeconds: 25 });
  const batch = await read(async (_, q) => {
    calls.push(q.pageId);
    if (q.pageId === 'p1') {
      throw qerror;
    }
    return page(q);
  }, selection(5));
  assert.deepEqual(calls, ['p0', 'p1', 'p2']);
  assert.deepEqual(batch.interruption, { code: 'rate_limited', retryAfterSeconds: 25 });
  assert.equal(batch.complete, 2);
  assert.equal(batch.attempted, 3);
  assert.deepEqual(
    batch.pages.map((p) => p.status),
    ['complete', 'deferred', 'complete', 'deferred', 'deferred'],
  );
  await assert.rejects(
    read(async () => {
      throw qerror;
    }, selection(5)),
    (error) => error === qerror,
  );
});
test('unavailable and changed pages are reported individually without inventing data', async () => {
  const batch = await read(async (_, q) => {
    if (q.pageId === 'p0') {
      throw new AgentError('memory_page_not_found', 'unavailable', { status: 404 });
    }
    if (q.pageId === 'p2') {
      throw new AgentError('memory_revision_changed', 'changed', { status: 409 });
    }
    return page(q);
  }, selection(3));
  assert.deepEqual(
    batch.pages.map((p) => p.status),
    ['unavailable', 'complete', 'changed'],
  );
  assert.equal(batch.complete, 1);
});
test('invalid and duplicate selectors fail before spending reads', async () => {
  for (const input of [
    selection(0),
    selection(6),
    { ...selection(1), epoch: 'alone' },
    { scope, pages: [{ mode: 'blocks', pageId: 'x', cursor: 'unchecked' }] },
    { scope, pages: [{ mode: 'outline', pageId: 'x', blockIds: ['one'] }] },
    { scope, pages: [{ mode: 'blocks', pageId: 'x', blockIds: ['one', 'one'] }] },
    {
      scope,
      pages: [
        { mode: 'blocks', pageId: 'x' },
        { mode: 'outline', pageId: 'x' },
      ],
    },
  ]) {
    await assert.rejects(
      read(() => assert.fail('invalid input must not reach server'), input),
      (e) => e.code === 'invalid_arguments',
    );
  }
});
test('ten-page comparison uses two metered batches; 500-page review has explicitly resumable selected groups', async () => {
  const make = (start, count) => ({
    scope,
    epoch: 'epoch',
    checkpoint: '33',
    pages: Array.from({ length: count }, (_, i) => ({
      pageId: 'p' + (i + start),
      mode: 'outline',
    })),
  });
  let calls = 0;
  const get = async (_, q) => {
    calls++;
    return page(q);
  };
  const manifest = new Set();
  for (let start = 0; start < 500; start += 5) {
    const batch = await read(get, make(start, 5));
    batch.pages.forEach((p) => manifest.add(p.pageId));
    if (start === 5) {
      assert.equal(calls, 10);
    }
  }
  assert.equal(manifest.size, 500);
  assert.equal(calls, 500);
});
test('restore reuses the supplied immutable request, never generates a write from history or diff', async () => {
  const writes = [];
  const input = {
    scope,
    pageId: 'p',
    revision: '3',
    expectedRevision: '9',
    epoch: 'e',
    operationId: '5e06cb2c-58da-4de2-8475-ab4dfbd02b40',
    issuedAt: 1234567890,
  };
  const client = {
    accessToken: async () => 'test-token',
    invalidateReads: () => {},
    transport: {
      request: async (path, req) => {
        assert.equal(path, '/api/agents/v1/memory/restore');
        writes.push(req);
        return { pageId: 'p', revision: '10' };
      },
    },
    get: async () => ({ scope, pageId: 'p', items: [] }),
  };
  await memoryHistoryRequest(client, 'history', { scope, pageId: 'p' });
  assert.equal(writes.length, 0);
  await memoryHistoryRequest(client, 'restore', input);
  await memoryHistoryRequest(client, 'restore', input);
  assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(writes[0].json, input);
  await assert.rejects(
    memoryHistoryRequest(client, 'restore', { ...input, operationId: '' }),
    (e) => e.code === 'invalid_arguments',
  );
});
test('local and hosted templates expose the same opt-in localized pages; every published selector schema compiles', () => {
  const guide = workflow({ topic: 'memory-templates' });
  assert.deepEqual(
    guide.templates.map((f) => f.family),
    ['product', 'game', 'music', 'freeform'],
  );
  for (const family of guide.templates) {
    for (const page of family.pages) {
      assert.ok(page.title.en && page.title.fr);
      assert.equal(page.sections.en.length, page.sections.fr.length);
    }
  }
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(
    tools.find((t) => t.name === 'tasker_memory_read_pages').inputSchema,
  );
  assert.equal(validate(selection(5)), true);
  assert.equal(validate(selection(6)), false);
});

test('editorial review uses the real project policy, handles refusals, missing knowledge and ambiguous evidence without writing', async () => {
  const { reviewProjectMemory, previewMemoryTemplate } =
    await import('../src/memory-editorial.mjs');
  const project = 'project:test';
  const input = {
    scope: project,
    domain: 'usage',
    change: 'feature',
    sources: [{ kind: 'tested-release', reference: 'QA-21' }],
    candidates: [{ pageId: 'start', revision: '7' }],
  };
  const rule = {
    memoryId: 'space',
    folderId: 'products',
    language: 'fr',
    stylePageId: null,
    guidance: '',
    autoDomains: ['usage'],
    suggestionState: 'ask',
  };
  let permitted = true;
  let docs = { ...rule },
    revision = '7',
    parentId = 'products';
  const calls = [];
  const client = {
    get: async (route, query) => {
      calls.push({ route, query });
      if (route === 'project/documentation') {
        return { scope: project, revision: '5', epoch: 'epoch', documentation: docs };
      }
      if (route === 'me') {
        const grant = {
          permissions: permitted ? ['memory:write'] : [],
          allResources: false,
          resourceIds: ['memory:space'],
        };
        return { connection: { grant }, profile: { grant } };
      }
      assert.equal(route, 'resources');
      if (query.id === 'other') {
        return {
          scope: 'memory:space',
          collection: 'pageIndex',
          epoch: 'epoch',
          checkpoint: '3',
          items: [],
        };
      }
      assert.equal(query.scope, 'memory:space');
      assert.equal(query.id, 'start');
      return {
        scope: query.scope,
        epoch: 'epoch',
        checkpoint: '3',
        collection: 'pageIndex',
        items: [{ id: query.id, revision, data: { parentId } }],
      };
    },
  };
  const decide = (extra = {}) => reviewProjectMemory(client, { ...input, ...extra });
  assert.equal((await decide()).action, 'prepare_update');
  permitted = false;
  assert.equal((await decide()).reason, 'no_delegated_write');
  permitted = true;
  assert.equal((await decide({ existingFactMatches: true })).action, 'skip');
  assert.equal((await decide({ change: 'routine' })).reason, 'keep_in_task');
  assert.equal(
    (await decide({ sources: [{ kind: 'task-status', reference: 'Done' }] })).action,
    'clarify',
  );
  assert.equal(
    (await decide({ candidates: [...input.candidates, { pageId: 'second', revision: '1' }] }))
      .reason,
    'ambiguous_destination',
  );
  revision = '8';
  assert.equal((await decide()).reason, 'reread_changed_page');
  revision = '7';
  parentId = 'other';
  assert.equal((await decide()).reason, 'verify_destination_folder');
  parentId = 'products';
  assert.equal((await decide({ domain: 'other' })).action, 'propose');
  docs = { ...rule, suggestionState: 'later' };
  assert.equal((await decide({ domain: 'other' })).reason, 'suggestion_later');
  docs = { ...rule, memoryId: null };
  assert.equal((await decide({ candidates: [] })).reason, 'first_page_and_destination');
  docs.suggestionState = 'dismissed';
  assert.equal((await decide({ candidates: [] })).reason, 'suggestion_dismissed');
  docs = null;
  assert.equal((await decide()).reason, 'destination_unavailable');
  assert.deepEqual(
    new Set(calls.map((c) => c.route)),
    new Set(['project/documentation', 'resources', 'me']),
  );
  assert.throws(() => previewMemoryTemplate({ family: 'music', page: 'mechanic', language: 'fr' }));
  assert.deepEqual(
    previewMemoryTemplate({ family: 'game', page: 'mechanic', language: 'fr' }).suggestedHeadings,
    ['Action du joueur', 'Règle', 'Cas particuliers'],
  );
  assert.equal(
    previewMemoryTemplate({ family: 'freeform', page: 'note', language: 'en' }).applied,
    false,
  );
});

test('CLI and real MCP SDK expose the same editorial previews and review the selected pages using individual GETs', async (t) => {
  const { Client } = await import('@modelcontextprotocol/client');
  const { InMemoryTransport } = await import('@modelcontextprotocol/server');
  const { createMcpServer } = await import('../src/mcp.mjs');
  const { main } = await import('../src/cli.mjs');
  const calls = [];
  const server = createMcpServer({
    get: async (route, query) => {
      calls.push(route);
      return page(query);
    },
  });
  const client = new Client({ name: 'memory-notes-test', version: '1.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(a);
  await client.connect(b);
  for (const key of ['read_pages', 'history', 'diff', 'restore', 'template', 'review']) {
    assert.ok((await client.listTools()).tools.some((t) => t.name === 'tasker_memory_' + key));
  }
  const send = (name, args) => client.callTool({ name: 'tasker_memory_' + name, arguments: args });
  const choice = await send('template', { family: 'music', language: 'fr', page: 'recording' });
  assert.equal(choice.structuredContent.data.title, 'Configuration d’enregistrement');
  assert.equal(calls.length, 0);
  const m = await send('read_pages', selection(3));
  assert.equal(m.isError, undefined);
  assert.equal(m.structuredContent.data.complete, 3);
  assert.deepEqual(calls, ['memory/sections', 'memory/sections', 'memory/sections']);
  let text = '';
  const code = await main(
    [
      'memory',
      'template',
      '--family',
      'music',
      '--language',
      'fr',
      '--page',
      'recording',
      '--json',
    ],
    {
      stdout: { write: (chunk) => (text += chunk) },
      stderr: { write: () => {} },
      fetchImpl: () => assert.fail('preview must not read data'),
    },
  );
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(text).data, choice.structuredContent.data);
});

test('archive CLI read adapter preserves the filter and cursor for a bounded metered POST and needs no broad resource scan', async () => {
  const { readArchive } = await import('../src/archive.mjs');
  const calls = [];
  const scope = 'project:qa';
  const client = {
    accessToken: async () => 'synthetic',
    transport: {
      request: async (path, { json, method, token }) => {
        assert.equal(token, 'synthetic');
        assert.equal(method, 'POST');
        calls.push({ path, json });
        return {
          scope,
          module: 'Project/ProjectTask',
          items: [],
          next: json.continuation ? null : 'opaque',
        };
      },
    },
    get: async (route, q) =>
      route.endsWith('comments')
        ? { scope, id: q.id, items: [], nextAfter: null }
        : { scope, id: q.id, revision: '7', data: { title: 'QA' } },
  };
  const input = {
    scope,
    query: 'release',
    statuses: ['Paused'],
    assignees: ['owner'],
    importance: ['Critical'],
    archivedFrom: '2026-10-01T00:00:00Z',
  };
  const first = await readArchive(client, 'query', input);
  const second = await readArchive(client, 'query', { ...input, continuation: first.next });
  assert.equal(first.next, 'opaque');
  assert.equal(second.next, null);
  assert.equal(calls[0].path, '/api/agents/v1/tasks/archive/query');
  assert.equal(calls[0].json.archive, true);
  assert.equal(calls[0].json.criteria.query, 'release');
  assert.deepEqual(calls[0].json.criteria.statuses, ['Paused']);
  assert.deepEqual(calls[1].json, { ...calls[0].json, continuation: 'opaque' });
  assert.equal((await readArchive(client, 'detail', { scope, id: 'task' })).data.title, 'QA');
  assert.deepEqual((await readArchive(client, 'comments', { scope, id: 'task' })).items, []);
  await assert.rejects(
    readArchive(client, 'query', {
      scope,
      archivedFrom: '2026-10-01T00:00:00Z',
      archivedUntil: '2026-09-01T00:00:00Z',
    }),
    (e) => e.code === 'invalid_arguments',
  );
  for (const key of ['query', 'detail', 'comments']) {
    assert.deepEqual(tools.find((t) => t.name === 'tasker_archive_' + key).scopes, [
      'tasks:read',
      'history:read',
    ]);
  }
});
test('historical reads always target the requested retained revision and reject substitution with the current page', async () => {
  const input = { scope, pages: [{ pageId: 'p', mode: 'blocks', atRevision: '9' }] };
  await assert.rejects(
    read(async (_, q) => page(q), input),
    (e) => e.code === 'invalid_response',
  );
  const result = await read(async (_, q) => {
    assert.equal(q.atRevision, '9');
    return page(q, { revision: '9' });
  }, input);
  assert.equal(result.pages[0].revision, '9');
});
