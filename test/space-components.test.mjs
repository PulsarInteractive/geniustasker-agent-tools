import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spaceCommands, spaceRequest } from '../src/space-components.mjs';
import { readMemoryPages } from '../src/memory-read-pages.mjs';
import { compareMedia, MediaJournal } from '../src/media.mjs';
import { readFile } from 'node:fs/promises';
import { Transport } from '../src/transport.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };

const scope = 'memory:studio',
  query = { scope, pageId: 'guide', blockIds: ['work', 'linked'] };
const available = {
  blockId: 'work',
  kind: 'task',
  status: 'available',
  scope: 'project:work',
  targetId: 'one',
  presentation: 'checklist',
  title: 'Proofs',
  revision: '7',
  checklistCount: 3,
  checklistDoneCount: 1,
};
const response = {
  scope,
  pageId: 'guide',
  revision: '2',
  items: [available, { blockId: 'linked', status: 'unavailable' }],
};
const client = (send) => ({ accessToken: async () => 'test-token', transport: { request: send } });
const decision = {
  scope,
  issuedAt: 4000,
  operationId: 'a9857bea-12a7-4a44-94e2-a4b6ebb807b1',
  criterionId: 'global:legibility',
  verdict: 'approved',
  targets: [
    { variantId: 'mobile', blockId: 'screen', revision: '7', expectedDecisionId: null },
    { variantId: 'tablet', blockId: 'screen', revision: '8', expectedDecisionId: 'old-id' },
  ],
};

test('one selected component batch respects grant placeholders and the byte and block boundaries', async () => {
  let calls = 0;
  const c = client(async (path, opts) => {
    calls++;
    assert.equal(path, '/api/agents/v1/memory/guide-components');
    assert.equal(opts.method, 'POST');
    assert.equal(opts.token, 'test-token');
    assert.deepEqual(opts.json, query);
    return response;
  });
  assert.deepEqual(await spaceRequest(c, 'guides components', query), response);
  assert.equal(calls, 1);
  for (const ids of [
    [],
    ['one', 'one'],
    Array.from({ length: 17 }, (_, i) => 'i' + i),
    ['invalid id'],
  ]) {
    await assert.rejects(spaceRequest(c, 'guides components', { ...query, blockIds: ids }), {
      code: 'invalid_arguments',
    });
  }
  assert.equal(calls, 1);
  for (const broken of [
    { ...response, scope: 'memory:other' },
    { ...response, items: [available, available] },
    {
      ...response,
      items: [available, { blockId: 'linked', status: 'unavailable', title: 'hidden' }],
    },
    { ...response, items: [{ ...available, title: 'x'.repeat(32768) }, response.items[1]] },
  ]) {
    await assert.rejects(
      spaceRequest(
        client(async () => broken),
        'guides components',
        query,
      ),
      { code: 'invalid_response' },
    );
  }
  assert.equal(spaceCommands.get('guides components').tool.write, false);
});
test('component outlines remain readable without disclosing an embedded target', async () => {
  const source = {
    scope,
    id: 'guide',
    title: 'Editorial',
    revision: '2',
    epoch: 'e',
    checkpoint: '10',
    accessRevision: '1',
    mode: 'outline',
    notModified: false,
    nextCursor: null,
    items: [
      {
        id: 'linked',
        kind: 'component',
        order: 0,
        component: { scope: 'project:secret', targetId: 'one' },
      },
    ],
  };
  const result = await readMemoryPages(
    { get: async () => source },
    { scope, pages: [{ pageId: 'guide', mode: 'outline' }] },
  );
  assert.deepEqual(result.pages[0].items, [{ id: 'linked', kind: 'component', order: 0 }]);
});
test('the design grid reads selected filters only; review receipts retain each conflict and stable operation', async () => {
  const input = { scope, track: 'mockup', width: 390, verdict: 'unchecked' };
  const items = [{ variantId: 'mobile', blockId: 'screen', revision: '7', cells: [] }];
  const grid = {
    scope,
    epoch: 'studio',
    checkpoint: '7',
    nextCursor: null,
    items,
    counts: { media: 1, unchecked: 0, approved: 0, rejected: 0 },
  };
  const result = await spaceRequest(
    {
      get: async (route, value) => {
        assert.equal(route, 'memory/design-grid');
        assert.deepEqual(value, input);
        return grid;
      },
    },
    'design grid',
    input,
  );
  assert.equal(result, grid);
  const receipt = {
    items: [
      { variantId: 'mobile', blockId: 'screen', decisionId: 'new', error: null },
      { variantId: 'tablet', blockId: 'screen', decisionId: null, error: 'revision_conflict' },
    ],
  };
  let n = 0;
  const c = client(async (path, v) => {
    n++;
    assert.equal(path, '/api/agents/v1/memory/design-grid/decisions');
    assert.deepEqual(v.json, decision);
    return receipt;
  });
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await spaceRequest(c, 'design review', decision), receipt);
  }
  await assert.rejects(
    spaceRequest(c, 'design review', { ...decision, targets: Array(17).fill(decision.targets[0]) }),
    { code: 'invalid_arguments' },
  );
  await assert.rejects(
    spaceRequest(c, 'design review', { ...decision, targets: Array(2).fill(decision.targets[0]) }),
    { code: 'invalid_arguments' },
  );
  assert.equal(n, 2);
  await assert.rejects(
    spaceRequest(
      client(async () => ({ items: [receipt.items[0], receipt.items[0]] })),
      'design review',
      decision,
    ),
    { code: 'invalid_response' },
  );
  assert.deepEqual(spaceCommands.get('design review').tool.scopes, ['memory:write']);
});
test('a single image with many observations uses the special grid byte budget only', async () => {
  const text = JSON.stringify({ observation: 'a'.repeat(265000) });
  const transport = new Transport('https://api.example.test', {
    fetchImpl: async () => new Response(text),
  });
  assert.equal(
    (await transport.request('/api/agents/v1/memory/design-grid')).observation.length,
    265000,
  );
  await assert.rejects(transport.request('/api/agents/v1/memory/catalog'), {
    code: 'invalid_response',
  });
  const tooLarge = new Transport('https://api.example.test', {
    fetchImpl: async () => new Response('a'.repeat(512 * 1024 + 1)),
  });
  await assert.rejects(tooLarge.request('/api/agents/v1/memory/design-grid'), {
    code: 'invalid_response',
  });
});
test('authorized cover and gallery uploads retain source identity, return normalized metadata, and reuse verified input', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'tasker-media-usage-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'cover.png');
  await writeFile(file, 'source file');
  const bytes = await readFile(file),
    hash = createHash('sha256').update(bytes).digest('hex');
  const session = {
    origin: 'https://api.example.test',
    connection_id: 'one',
    profile_id: 'p',
    session_id: 's',
    access_token: 'synthetic',
  };
  for (const purpose of ['pageCover', 'designVisual']) {
    let open,
      stored = false,
      uploads = 0;
    const view = () => ({
      id: open.id,
      ownerId: 'o',
      size: stored ? 4 : bytes.length,
      fileName: stored ? 'cover.webp' : 'cover.png',
      published: stored,
    });
    const c = {
      store: { directory: dir, context: 'test' },
      authorizedSession: async () => session,
      transport: {
        request: async (route, v) => {
          if (route.endsWith('sessions')) {
            open ??= v.json;
            assert.deepEqual(v.json, open);
            assert.equal(open.purpose, purpose);
            return view();
          }
          if (route.endsWith('content')) {
            uploads++;
            assert.deepEqual(v.bytes, bytes);
            return null;
          }
          stored = true;
          return view();
        },
      },
    };
    const journal = new MediaJournal(c);
    const prepared = await journal.prepare({
      scope,
      epoch: 'e',
      file,
      contentType: 'image/png',
      purpose,
    });
    for (let i = 0; i < 2; i++) {
      const receipt = await journal.upload(prepared.operationId);
      assert.equal(receipt.size, 4);
      assert.equal(receipt.fileName, 'cover.webp');
      assert.equal(receipt.sourceSha256, hash);
      assert.equal(receipt.sha256, undefined);
    }
    assert.equal(uploads, 1);
    await assert.rejects(
      journal.prepare({ scope, epoch: 'e', file, contentType: 'application/pdf', purpose }),
      { code: 'invalid_arguments' },
    );
  }
  const original = await compareMedia(
    {
      get: async () => ({
        scope,
        collection: 'assets',
        items: [
          {
            id: '1599ce55-b231-40ae-aeab-66eb02f45d3c',
            revision: '7',
            data: { sha256: 'a'.repeat(64), sizeBytes: 4, sourceSha256: hash },
          },
        ],
      }),
    },
    { scope, id: '1599ce55-b231-40ae-aeab-66eb02f45d3c', file },
  );
  assert.equal(original.identical, true);
  assert.equal(original.downloaded, false);
  assert.equal(original.remoteSha256, 'a'.repeat(64));
});
test('each scoped resource listing advertises the bounded filename prefix', () => {
  const scoped = tools.filter((t) => t.route === 'storage/resources');
  assert.equal(scoped.length, 3);
  for (const t of scoped) {
    assert.equal(t.inputSchema.properties.query.maxLength, 128);
    assert.equal(t.inputSchema.properties.query.minLength, 1);
  }
});
