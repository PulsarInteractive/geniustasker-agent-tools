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
import { fixture } from './helpers.mjs';
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

test('all public space GET tools reach their exact transport path through the installed delegated client', async (t) => {
  const routes = [...spaceCommands.values()]
    .map((v) => v.tool)
    .filter((tool) => (tool.method ?? 'GET') === 'GET');
  assert.ok(routes.some((tool) => tool.route === 'memory/design/mockups'));
  const visited = [];
  const f = await fixture(t, async (url) => {
    visited.push(url.pathname);
    return Response.json({ items: [] });
  });
  for (const tool of routes) {
    await f.client.get(tool.route, { scope });
  }
  assert.deepEqual(
    visited,
    routes.map((tool) => '/api/agents/v1/' + tool.route),
  );
  await assert.rejects(f.client.get('memory/design/reviews', { scope }), {
    code: 'invalid_arguments',
  });
});
test('design changes validate the whole window before advancing across inaccessible media', async () => {
  const page = {
    scope,
    collection: 'pageIndex',
    epoch: 'epoch',
    checkpoint: '19',
    items: [],
    omittedIds: [],
    nextCursor: 'next',
    hasMore: true,
    pollAfterSeconds: 30,
  };
  assert.deepEqual(
    await spaceRequest({ get: async () => page }, 'design changes', { scope }),
    page,
  );
  await assert.rejects(
    spaceRequest(
      {
        get: async () => ({
          ...page,
          items: [
            {
              kind: 'remove',
              id: 'private',
              revision: '2',
              data: { kind: 'page', title: 'hidden' },
            },
          ],
        }),
      },
      'design changes',
      { scope, cursor: 'before' },
    ),
    { code: 'invalid_response' },
  );
});
test('conformity receipts keep exact source, implementation, verdict and operation', async () => {
  const review = {
    target: { variantId: 'shared', revision: '3' },
    evidence: { variantId: 'phone', revision: '9' },
    verdict: 'approved',
  };
  const input = { scope, epoch: 'e', operationId: decision.operationId, issuedAt: 4000, review };
  const result = {
    scope,
    operationId: input.operationId,
    decisionId: input.operationId,
    revision: '12',
    review,
  };
  assert.deepEqual(
    await spaceRequest(
      client(async () => result),
      'design compare-review',
      input,
    ),
    result,
  );
  const other = {
    ...result,
    review: { ...review, evidence: { ...review.evidence, revision: '10' } },
  };
  await assert.rejects(
    spaceRequest(
      client(async () => other),
      'design compare-review',
      input,
    ),
    { code: 'invalid_response' },
  );
  const comparisons = {
    scope,
    epoch: 'e',
    checkpoint: '12',
    nextCursor: null,
    items: [
      {
        id: 'decision',
        revision: '12',
        kind: 'design-review',
        title: 'Print approval',
        summary: 'Verified',
        origin: review.target,
        evidence: review.evidence,
        verdict: review.verdict,
      },
    ],
  };
  assert.deepEqual(
    await spaceRequest({ get: async () => comparisons }, 'design comparisons', {
      scope,
      variantId: 'shared',
    }),
    comparisons,
  );
  await assert.rejects(
    spaceRequest({ get: async () => comparisons }, 'design comparisons', {
      scope,
      variantId: 'other',
    }),
    { code: 'invalid_response' },
  );
});
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
test('live task and review tables validate their projected rows and single-occurrence continuation', async () => {
  const task = {
    ...available,
    presentation: 'table',
    rows: [{ id: 'issue', title: 'Record stems', revision: '1', taskStatus: 'New' }],
    hasMoreRows: true,
  };
  const design = {
    ...task,
    blockId: 'linked',
    kind: 'design',
    scope: 'memory:art',
    targetId: 'print',
    rows: [
      {
        id: 'proof',
        blockId: 'front',
        track: 'mockup',
        title: 'Print proof',
        revision: '4',
        criteria: 3,
        approved: 1,
        rejected: 1,
      },
    ],
    hasMoreRows: false,
  };
  const send = (q, items) =>
    spaceRequest(
      client(async () => ({ ...response, items })),
      'guides components',
      q,
    );
  assert.equal((await send(query, [task, design])).items.length, 2);
  const one = { ...query, blockIds: ['work'] };
  await send(one, [{ ...task, nextRowCursor: 'window' }]);
  await send({ ...one, rowCursor: 'window' }, [{ ...task, hasMoreRows: false, rows: [] }]);
  for (const value of [
    { ...task, nextRowCursor: 'window', rows: design.rows },
    { ...design, blockId: 'work', rows: [{ ...design.rows[0], approved: 3 }] },
    { ...task, hasMoreRows: false, rows: Array(5).fill(task.rows[0]) },
    { ...task, nextRowCursor: 'window', images: [] },
    { ...task },
  ]) {
    await assert.rejects(send(one, [value]), { code: 'invalid_response' });
  }
  await assert.rejects(send({ ...query, rowCursor: 'window' }, []), { code: 'invalid_arguments' });
});

test('linked Guide cards carry their derived inline preview and keep inaccessible cards opaque', async () => {
  const plain = {
    blockId: 'work',
    status: 'available',
    kind: 'guide',
    scope,
    targetId: 'paper',
    targetStamp: 'target-checkpoint',
    presentation: 'card',
    title: 'Paper',
    revision: '1',
  };
  const hidden = { blockId: 'linked', status: 'unavailable' };
  for (const fields of [
    { headerAssetId: 'first', headerAlt: 'Paper' },
    { headerAssetId: 'second', headerAlt: 'Ink' },
    {},
  ]) {
    const visible = { ...plain, ...fields };
    const expected = { ...response, sourceStamp: 'source-checkpoint', items: [visible, hidden] };
    assert.deepEqual(
      await spaceRequest(
        client(async () => expected),
        'guides components',
        query,
      ),
      expected,
    );
  }
  const leaked = { ...response, items: [plain, { ...hidden, headerAssetId: 'secret' }] };
  await assert.rejects(
    spaceRequest(
      client(async () => leaked),
      'guides components',
      query,
    ),
    { code: 'invalid_response' },
  );
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
  const input = {
    scope,
    track: 'mockup',
    width: 390,
    verdict: 'unchecked',
    reviewProgress: 'partial',
  };
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
  const cover = {
    ...items[0],
    frameOrder: 0,
    seriesCount: 3,
    landmarks: [{ key: 'summary', label: 'Summary' }],
  };
  const browse = { scope, presentation: 'series', includeTotals: false };
  assert.equal(
    (await spaceRequest({ get: async () => ({ ...grid, items: [cover] }) }, 'design grid', browse))
      .items[0].seriesCount,
    3,
  );
  for (const invalid of [
    [items[0]],
    [cover, { ...cover, blockId: 'next' }],
    [{ ...cover, landmarks: [{ label: 'Summary' }] }],
    [{ ...cover, landmarks: [{ key: 'summary', label: 'Summary', width: 50 }] }],
  ]) {
    await assert.rejects(
      spaceRequest({ get: async () => ({ ...grid, items: invalid }) }, 'design grid', browse),
    );
  }
  const window = { ...grid };
  delete window.counts;
  const listClient = { get: async () => window };
  assert.equal(
    await spaceRequest(listClient, 'design grid', { ...input, includeTotals: false }),
    window,
  );
  await assert.rejects(spaceRequest(listClient, 'design grid', input));
  assert.equal(
    await spaceRequest({ get: async () => grid }, 'design grid', {
      ...input,
      includeTotals: false,
    }),
    grid,
  );
  await assert.rejects(spaceRequest({}, 'design grid', { scope, reviewProgress: 'approved' }), {
    code: 'invalid_arguments',
  });
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

test('delivery tools preserve the visible track and distinguish unknown from missing', async () => {
  const input = { scope, pageId: 'phone' };
  const evidence = { expected: 'required', presence: 'unknown', example: null };
  const target = {
    ...input,
    revision: '8',
    expectation: { mockup: 'required', implemented: 'required' },
    mockup: evidence,
    implemented: evidence,
  };
  const get = async (path, selector) => {
    assert.equal(path, 'memory/design/target');
    assert.deepEqual(selector, input);
    return target;
  };
  assert.deepEqual(await spaceRequest({ get }, 'design target', input), target);
  await assert.rejects(
    spaceRequest(
      {
        get: async () => ({
          ...target,
          implemented: { ...evidence, example: { variantId: 'private', revision: '4' } },
        }),
      },
      'design target',
      input,
    ),
  );
  const page = {
    scope,
    nextCursor: null,
    items: [{ variantId: 'v', revision: '3', blockId: 'image', track: 'mockup', cells: [] }],
  };
  assert.deepEqual(await spaceRequest({ get: async () => page }, 'design mockups', input), page);
  await assert.rejects(spaceRequest({ get: async () => page }, 'design implementations', input));
});

test('delivery backlog supports empty continuations and validates the requested evidence', async () => {
  const input = { scope, track: 'implemented', presence: 'unknown' };
  const nextCursor = 'c'.repeat(64) + '.page';
  const page = {
    scope,
    track: 'implemented',
    epoch: 'epoch',
    checkpoint: '12',
    items: [],
    nextCursor,
  };
  const get = async (path, selector) => {
    assert.equal(path, 'memory/design/targets');
    assert.deepEqual(selector, input);
    return page;
  };
  assert.deepEqual(await spaceRequest({ get }, 'design targets', input), page);
  const row = {
    pageId: 'track',
    title: 'Music',
    revision: '2',
    evidence: { presence: 'unknown', expected: 'required', example: null },
  };
  const issue = (result, query = input) =>
    spaceRequest({ get: async () => result }, 'design targets', query);
  assert.equal((await issue({ ...page, items: [row] })).items[0].pageId, 'track');
  await assert.rejects(
    issue({
      ...page,
      items: [
        { ...row, evidence: { ...row.evidence, example: { variantId: 'hidden', revision: '1' } } },
      ],
    }),
  );
  await assert.rejects(issue({ ...page, items: [row, row] }));
  await assert.rejects(issue(page, { ...input, cursor: nextCursor }));
});

test('a live gallery returns only bounded image identities from the selected design', async () => {
  const image = {
    variantId: 'phone',
    blockId: 'art',
    title: 'Read',
    track: 'mockup',
    revision: '10',
  };
  const gallery = {
    blockId: query.blockIds[0],
    status: 'available',
    scope: 'memory:art',
    kind: 'design',
    targetId: 'manual',
    presentation: 'gallery',
    title: 'Artwork',
    revision: '8',
    designView: { range: 'descendants', width: 390, height: 844 },
    images: [image],
    hasMoreImages: false,
  };
  const read = (extra) =>
    spaceRequest(
      client(async () => ({ ...response, items: [{ ...gallery, ...extra }, response.items[1]] })),
      'guides components',
      query,
    );
  assert.deepEqual((await read({})).items[0].images, [image]);
  for (const invalid of [
    { images: Array(5).fill(image) },
    { kind: 'task' },
    { presentation: 'card' },
    { images: [{ ...image, url: 'secret' }] },
  ]) {
    await assert.rejects(read(invalid), { code: 'invalid_response' });
  }
});

test('capture writers bind their receipt to the exact track, block and operation', async () => {
  const input = {
    scope,
    epoch: 'qa-epoch',
    operationId: decision.operationId,
    issuedAt: 4000,
    variantId: 'phone',
    expectedRevision: null,
    capture: { pageId: 'screen', blockId: 'hero', assetId: 'asset', title: 'Mobile' },
  };
  const receipt = {
    scope,
    variantId: 'phone',
    blockId: 'hero',
    track: 'implemented',
    revision: '4',
    operationId: input.operationId,
  };
  const send = client(async (path, opts) => {
    assert.equal(path, '/api/agents/v1/memory/design/implementations');
    assert.equal(opts.method, 'POST');
    assert.deepEqual(opts.json, input);
    return receipt;
  });
  assert.deepEqual(await spaceRequest(send, 'design save-implementation', input), receipt);
  await assert.rejects(
    spaceRequest(
      client(async () => receipt),
      'design save-mockup',
      input,
    ),
    { code: 'invalid_response' },
  );
  await assert.rejects(
    spaceRequest(
      client(async () => ({ ...receipt, blockId: 'other' })),
      'design save-implementation',
      input,
    ),
    { code: 'invalid_response' },
  );
});

test('published galleries bind media and continuation to a single retained revision', async () => {
  const input = {
    scope,
    pageId: 'guide',
    blockIds: ['release'],
    publishedRevision: '12',
    afterImage: 'start',
  };
  const image = {
    variantId: 'run',
    blockId: 'impact',
    revision: '12',
    title: 'Impact',
    landmarks: [{ key: 'contact', label: 'Contact', x: 100, y: 200, width: 5000, height: 1000 }],
    track: 'mockup',
  };
  const gallery = {
    blockId: 'release',
    status: 'available',
    kind: 'design',
    scope,
    targetId: 'run',
    presentation: 'gallery',
    revision: '12',
    title: 'Run',
    designView: { range: 'selection', publishedRevision: '12' },
    publicationLabel: 'Beta',
    images: [image],
    hasMoreImages: false,
  };
  const read = (item) =>
    spaceRequest(
      client(async () => ({ scope, pageId: 'guide', revision: '5', items: [item] })),
      'guides components',
      input,
    );
  assert.equal((await read(gallery)).items[0].images[0].blockId, 'impact');
  const edition = {
    ...gallery,
    selectionPublication: true,
    images: [
      { ...image, occurrenceId: 'entry-1', variantId: 'phone', revision: '7' },
      { ...image, occurrenceId: 'entry-2', variantId: 'tablet', revision: '11' },
    ],
  };
  assert.equal((await read(edition)).items[0].images[1].revision, '11');
  await assert.rejects(read({ ...edition, images: [edition.images[0], edition.images[0]] }), {
    code: 'invalid_response',
  });
  await assert.rejects(read({ ...edition, images: [image] }), { code: 'invalid_response' });

  for (const corrupt of [
    { ...gallery, publicationLabel: null },
    { ...gallery, revision: '13' },
    { ...gallery, images: [{ ...image, revision: '13' }] },
    { ...gallery, images: [{ ...image, variantId: 'another' }] },
  ]) {
    await assert.rejects(read(corrupt), { code: 'invalid_response' });
  }
});
