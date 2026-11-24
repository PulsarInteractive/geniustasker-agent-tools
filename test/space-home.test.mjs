import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { main } from '../src/cli.mjs';
import { readMemoryTree, readMemoryMarkdown } from '../src/documentation.mjs';
import { readMemoryCatalog } from '../src/memory-image.mjs';
import { fixture, origin } from './helpers.mjs';

const scope = 'memory:studio';
const snapshot = { scope, epoch: 'e', checkpoint: '7', accessRevision: '3' };
const digest = 'a'.repeat(64);
const rootPage = {
  id: 'prints',
  revision: '4',
  title: 'Prints',
  path: 'prints',
  parentId: null,
  kind: 'design-screen',
  section: '',
  directory: false,
  order: 0,
  updated: null,
  childCount: 1,
  subtreeVersion: digest,
};
const root = {
  ...snapshot,
  parentId: null,
  title: 'Studio',
  parent: null,
  version: digest,
  etag: digest,
  notModified: false,
  items: [rootPage],
  nextAfter: null,
  totalChildren: 1,
};
async function runCli(f, args) {
  let output = '',
    error = '';
  const code = await main([...args, '--origin', origin, '--allow-local', '--json'], {
    directory: f.directory,
    fetchImpl: f.transport.fetch,
    stdout: {
      write: (text) => {
        output += text;
      },
    },
    stderr: {
      write: (text) => {
        error += text;
      },
    },
  });
  return { code, payload: JSON.parse(output || error) };
}

test('the CLI opens a space once without loading images or content; legacy and child reads remain available', async (t) => {
  const calls = [];
  const home = {
    kind: 'design',
    description: 'Screen references',
    destinations: ['pages', 'gallery', 'review', 'settings'],
  };
  const f = await fixture(t, async (url) => {
    calls.push(url);
    assert.equal(url.pathname, '/api/agents/v1/memory/tree');
    const query = Object.fromEntries(url.searchParams);
    assert.equal(query.scope, scope);
    if (query.outline === 'home') {
      return Response.json({ ...root, home });
    }
    if (query.outline === 'design') {
      return Response.json({
        ...root,
        parentId: 'prints',
        parent: rootPage,
        items: [{ ...rootPage, id: 'labels', parentId: 'prints' }],
      });
    }
    return Response.json(root);
  });
  const page = await runCli(f, ['memory', 'tree', '--scope', scope, '--outline', 'home']);
  assert.equal(page.code, 0);
  assert.deepEqual(page.payload.data.home, home);
  assert.deepEqual(page.payload.data.items, [rootPage]);
  assert.equal(calls.length, 1);
  assert.equal(
    (await readMemoryTree(f.client, { scope, parentId: 'prints', outline: 'design' })).items[0].id,
    'labels',
  );
  assert.equal((await readMemoryTree(f.client, { scope })).home, undefined);
  await assert.rejects(readMemoryTree(f.client, { scope, outline: 'home', parentId: 'prints' }), {
    code: 'invalid_arguments',
  });
  await assert.rejects(readMemoryTree(f.client, { scope, outline: 'home', after: 'prints' }), {
    code: 'invalid_arguments',
  });
  assert.equal(calls.length, 3);
});

test('an exact skill read preserves authored instructions and rejects mismatched published selections', async () => {
  const config = {
    spaceInstructions: 'Use the studio glossary.',
    agentInstructions: 'Ask who approved the proof.',
  };
  const markdown = {
    ...snapshot,
    id: 'press',
    revision: '7',
    updated: null,
    creator: null,
    lastEditor: null,
    assetIds: [],
    markdown: '# Proof review',
    ...config,
  };
  const selected = { scope, status: 'published' };
  const item = { id: 'press', revision: '7', guide: { slug: 'press', status: 'published' } };
  const result = { ...snapshot, nextCursor: null, items: [item] };
  assert.deepEqual(await readMemoryCatalog({ get: async () => result }, selected), result);
  const exact = await readMemoryMarkdown(
    {
      get: async (route, q) => {
        assert.equal(route, 'memory/markdown');
        assert.equal(q.pageId, item.id);
        assert.equal(q.revision, item.revision);
        return markdown;
      },
    },
    { scope, pageId: item.id, revision: item.revision },
  );
  assert.equal(exact.spaceInstructions, config.spaceInstructions);
  assert.equal(exact.agentInstructions, config.agentInstructions);
  for (const data of [
    { ...result, scope: 'memory:other' },
    { ...result, items: [{ ...item, guide: { status: 'draft' } }] },
    { ...result, items: [item, item] },
    { ...result, items: [{ ...item, revision: null }] },
  ]) {
    await assert.rejects(readMemoryCatalog({ get: async () => data }, selected), {
      code: 'invalid_response',
    });
  }
});

test('the CLI saves only the named historical image and preserves an existing file and denied revisions', async (t) => {
  const bytes = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvA8ACAAdQjmb3pv+BiOh/AAA=', 'base64');
  const proof = {
    scope,
    pageId: 'mobile',
    blockId: 'screen',
    revision: '4',
    assetId: 'old',
    assetRevision: '2',
    originalBytes: 999,
    originalContentType: 'image/png',
  };
  const f = await fixture(t, async (url) => {
    assert.equal(url.pathname, '/api/agents/v1/memory/image-version');
    const q = Object.fromEntries(url.searchParams);
    if (q.atRevision === '3') {
      return Response.json({ error: { code: 'agent_permission_denied' } }, { status: 403 });
    }
    assert.deepEqual(q, { scope, pageId: 'mobile', blockId: 'screen', atRevision: '4' });
    return new Response(bytes, {
      headers: { 'Content-Type': 'image/webp', 'X-Genius-Image-Version': JSON.stringify(proof) },
    });
  });
  const select = [
    'memory',
    'view-image',
    '--scope',
    scope,
    '--page',
    'mobile',
    '--block',
    'screen',
    '--at-revision',
  ];
  const file = join(f.directory, 'old.webp');
  const first = await runCli(f, [...select, '4', '--file', file]);
  assert.equal(first.code, 0, JSON.stringify(first));
  assert.equal(first.payload.data.assetId, 'old');
  assert.equal(first.payload.data.revision, '4');
  assert.deepEqual(await readFile(file), bytes);
  assert.notEqual((await runCli(f, [...select, '4', '--file', file])).code, 0);
  assert.deepEqual(await readFile(file), bytes);
  const denied = join(f.directory, 'denied.webp');
  assert.notEqual((await runCli(f, [...select, '3', '--file', denied])).code, 0);
  await assert.rejects(stat(denied), { code: 'ENOENT' });
});

test('the client reads a selected current page image in one request with its revision proof', async (t) => {
  const bytes = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvA8ACAAdQjmb3pv+BiOh/AAA=', 'base64');
  const selected = { scope, pageId: 'mobile', blockId: 'screen' };
  const proof = {
    ...selected,
    revision: '9',
    assetId: 'picture',
    assetRevision: '2',
    originalBytes: 520,
    originalContentType: 'image/png',
  };
  const calls = [];
  const f = await fixture(t, async (url) => {
    calls.push(url.pathname);
    assert.deepEqual(Object.fromEntries(url.searchParams), selected);
    return new Response(bytes, {
      headers: { 'Content-Type': 'image/webp', 'X-Genius-Image-Version': JSON.stringify(proof) },
    });
  });
  const { readMemoryImagePixels } = await import('../src/memory-image-pixels.mjs');
  const output = await readMemoryImagePixels(f.client, selected);
  assert.equal(output.metadata.revision, '9');
  assert.deepEqual(output.bytes, bytes);
  assert.deepEqual(calls, ['/api/agents/v1/memory/image']);
});
