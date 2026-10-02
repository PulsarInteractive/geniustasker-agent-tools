import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  realpath,
  readFile,
  writeFile,
  rm,
  mkdir,
  symlink,
  readdir,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentError } from '../src/errors.mjs';
import { digest, DocumentationStore, safeRelative } from '../src/documentation-store.mjs';
import { syncDocumentation, documentationStatus } from '../src/documentation-sync.mjs';
import { readMemoryTree, readMemoryMarkdown } from '../src/documentation.mjs';
import { compareMedia } from '../src/media.mjs';

async function temporary(t) {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'tasker-documentation-')));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
function clientFixture(directory) {
  const state = {
    epoch: 'epoch',
    revision: 1,
    access: '1',
    deny: false,
    owner: 'owner',
    failMarkdown: false,
    pages: new Map(),
    calls: [],
    assets: new Map(),
    downloads: 0,
    nodes: [],
    edges: [],
    graphChanges: [],
  };
  const page = (id, parentId = null, extra = {}) =>
    state.pages.set(id, {
      id,
      parentId,
      revision: String(++state.revision),
      title: id,
      path: id,
      kind: 'document',
      section: '',
      directory: false,
      order: 0,
      updated: '2026-10-02T10:00:00Z',
      ...extra,
    });
  const branch = (id) =>
    [...state.pages.values()].filter((candidate) => {
      let current = candidate;
      const seen = new Set();
      while (current) {
        if (current.id === id) {
          return true;
        }
        if (seen.has(current.id)) {
          throw Error('cycle');
        }
        seen.add(current.id);
        current = state.pages.get(current.parentId);
      }
      return false;
    });
  const project = (p) => ({
    ...p,
    childCount: [...state.pages.values()].filter((c) => c.parentId === p.id).length,
    subtreeVersion: digest(JSON.stringify(branch(p.id).map((p) => [p.id, p.revision]))),
  });
  const client = {
    store: directory ? { directory: join(directory, '.private-test-client') } : undefined,
    transport: {
      origin: 'https://api.example.test',
      request: async (_path, options) => {
        state.downloads++;
        return state.assets.get(options.query.id).bytes;
      },
    },
    accessToken: async () => 'fixture-session',
    get: async (resource, query = {}) => {
      state.calls.push({ resource, query });
      if (resource === 'me') {
        return { actor: { ownerId: state.owner } };
      }
      if (resource === 'capabilities') {
        return { documentationSync: true };
      }
      if (state.deny) {
        throw new AgentError('agent_permission_denied', 'Unavailable', { status: 403 });
      }
      if (query.checkpoint && query.checkpoint !== String(state.revision)) {
        throw new AgentError('agent_context_changed', 'Changed', { status: 409 });
      }
      const common = {
        scope: query.scope,
        epoch: state.epoch,
        checkpoint: String(state.revision),
        accessRevision: state.access,
      };
      if (resource === 'memory/tree') {
        const all = [...state.pages.values()]
          .filter((p) => p.parentId === (query.parentId ?? null))
          .sort((a, b) => a.id.localeCompare(b.id));
        const version = digest(
          JSON.stringify(query.parentId ? branch(query.parentId) : [...state.pages.values()]),
        );
        const etag = digest(
          version + state.access + state.epoch + (query.parentId ?? '') + (query.after ?? ''),
        );
        const remaining = all.filter((p) => !query.after || p.id > query.after),
          items = remaining.slice(0, 50).map(project);
        const notModified = query.ifNoneMatch === etag;
        return {
          ...common,
          parentId: query.parentId ?? null,
          title: 'Product docs',
          parent: !notModified && query.parentId ? project(state.pages.get(query.parentId)) : null,
          version,
          etag,
          notModified,
          items: notModified ? [] : items,
          nextAfter: !notModified && remaining.length > 50 ? items.at(-1).id : null,
          totalChildren: all.length,
        };
      }
      if (resource === 'memory/markdown') {
        if (state.failMarkdown) {
          throw new AgentError('network_unavailable', 'Offline', { retryable: true });
        }
        const p = state.pages.get(query.pageId);
        return {
          ...common,
          id: p.id,
          revision: p.revision,
          updated: p.updated,
          creator: 'author',
          lastEditor: 'editor',
          markdown: `> Automatically generated. Edit through GeniusTasker MCP.\n\n# ${p.title}\n\n${p.text ?? 'Text for ' + p.id}\n\n${(p.assetIds ?? []).map((id) => `![Resource](geniustasker-asset:${id})`).join('\n')}\n\nSource ID: ${p.id}\n`,
          assetIds: p.assetIds ?? [],
        };
      }
      if (resource === 'resources' && query.collection === 'assets') {
        const a = state.assets.get(query.id);
        return {
          ...common,
          collection: 'assets',
          omittedIds: [],
          items: [
            {
              id: query.id,
              revision: '1',
              data: {
                fileName: 'original.txt',
                contentType: 'text/plain',
                sizeBytes: a.bytes.length,
                sha256: a.sha256 ?? digest(a.bytes),
                url: `/api/v2/media/owner/${query.id}`,
              },
            },
          ],
        };
      }
      if (resource === 'resources' && ['nodes', 'edges'].includes(query.collection)) {
        return {
          ...common,
          collection: query.collection,
          items: state[query.collection]
            .filter((item) => !query.after || item.id > query.after)
            .slice(0, 50),
          omittedIds: [],
          nextAfter:
            state[query.collection].filter((item) => !query.after || item.id > query.after).length >
            50
              ? state[query.collection].filter((item) => !query.after || item.id > query.after)[49]
                  .id
              : null,
          changeCursor: query.collection + '-cursor',
        };
      }
      if (resource === 'changes') {
        return {
          scope: common.scope,
          epoch: common.epoch,
          checkpoint: common.checkpoint,
          collection: query.collection,
          items: state.graphChanges
            .filter((c) => c.collection === query.collection)
            .map(({ collection: _, ...change }) => change),
          omittedIds: [],
          nextCursor: query.collection + '-cursor',
          hasMore: false,
          pollAfterSeconds: 30,
        };
      }
      throw Error('Unexpected resource ' + resource);
    },
  };
  const configuration = {
    formatVersion: 1,
    sources: [{ scope: 'memory:one' }],
    media: 'references',
  };
  return { state, page, client, configuration };
}
async function manifest(directory) {
  return JSON.parse(
    await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8'),
  );
}

test('repository sync fetches changed pages only, preserves nested folders and supports moves and deletion', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('visuals', null, { directory: true });
  f.page('interface', 'visuals');
  f.page('architecture');
  await writeFile(join(directory, 'handwritten.md'), 'Preserve my notes');
  const first = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(first.pagesFetched, 3);
  assert.equal(first.pagesReused, 0);
  let m = await manifest(directory);
  assert.match(
    m.sources[0].documents.interface.file,
    /visuals--[a-f0-9]{20}\/interface--[a-f0-9]{20}\/index.md$/,
  );
  const second = await syncDocumentation(f.client, { directory });
  assert.equal(second.pagesFetched, 0);
  assert.equal(second.pagesReused, 3);
  f.page('interface', 'visuals', { text: 'Changed via MCP' });
  const changed = await syncDocumentation(f.client, { directory });
  assert.equal(changed.pagesFetched, 1);
  assert.equal(changed.pagesReused, 2);
  f.state.pages.delete('architecture');
  f.state.revision++;
  f.page('interface', null, { text: 'Moved via MCP' });
  await syncDocumentation(f.client, { directory });
  m = await manifest(directory);
  assert.equal(m.sources[0].pages.architecture, undefined);
  assert.match(m.sources[0].documents.interface.file, /pages\/interface--[a-f0-9]{20}\/index.md$/);
  assert.equal(await readFile(join(directory, 'handwritten.md'), 'utf8'), 'Preserve my notes');
  const status = await documentationStatus({ directory });
  assert.equal(status.checkRecommended, false);
  assert.match(status.authorization, /has not been checked/);
});

test('pagination handles 500 pages, while an interrupted export leaves the complete previous snapshot', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  for (let i = 0; i < 500; i++) {
    f.page('p' + String(i).padStart(3, '0'));
  }
  const first = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(first.pagesFetched, 500);
  assert.equal(
    f.state.calls.filter((c) => c.resource === 'memory/tree' && c.query.after).length,
    9,
  );
  const old = await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8');
  f.page('p001', null, { text: 'A pending new version' });
  f.state.failMarkdown = true;
  await assert.rejects(syncDocumentation(f.client, { directory }), { code: 'network_unavailable' });
  assert.equal(
    await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8'),
    old,
  );
  f.state.failMarkdown = false;
  assert.equal((await syncDocumentation(f.client, { directory })).pagesFetched, 1);
  assert.deepEqual(
    (await readdir(directory)).filter((name) => name.startsWith('.stage-')),
    [],
  );
});

test('a throttled initial export resumes downloaded bodies after checking current revisions and permissions', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  for (let i = 0; i < 75; i++) {
    f.page('p' + String(i).padStart(3, '0'));
  }
  const get = f.client.get;
  let allowance = 25;
  f.client.get = async (resource, query) => {
    if (resource === 'memory/markdown' && allowance-- <= 0) {
      throw new AgentError('agent_rate_limited', 'Retry after reset', { retryable: true });
    }
    return get(resource, query);
  };
  await assert.rejects(syncDocumentation(f.client, { directory, configuration: f.configuration }), {
    code: 'agent_rate_limited',
  });
  await assert.rejects(manifest(directory), { code: 'ENOENT' });
  f.page('p000', null, { text: 'New revision after interruption' });
  f.state.pages.delete('p001'); // This page became inaccessible before the next attempt.
  f.state.revision++;
  allowance = Infinity;
  const resumed = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(resumed.pagesResumed, 23);
  assert.equal(resumed.pagesFetched, 51);
  const m = await manifest(directory);
  assert.equal(m.sources[0].documents.p001, undefined);
  assert.match(
    await readFile(join(directory, 'content', m.sources[0].documents.p000.file), 'utf8'),
    /New revision/,
  );
  assert.deepEqual(await readdir(join(f.client.store.directory, 'documentation-cache')), []);
  assert.ok(!Object.keys(m.files).some((name) => name.includes('cache')));
});

test('initial Graph and media downloads resume without repeating successful transfers', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.configuration.sources[0].graph = true;
  f.configuration.media = 'local';
  f.state.assets.set('image', { bytes: Buffer.from('Reusable image') });
  f.page('overview', null, { assetIds: ['image'] });
  f.state.nodes = Array.from({ length: 125 }, (_, i) => ({
    id: 'n' + String(i).padStart(3, '0'),
    revision: '1',
    data: { title: 'Node ' + i },
  }));
  const get = f.client.get;
  let interrupted = true;
  f.client.get = async (resource, query) => {
    if (interrupted && resource === 'resources' && query.collection === 'nodes' && query.after) {
      throw new AgentError('network_unavailable', 'Interrupted', { retryable: true });
    }
    return get(resource, query);
  };
  await assert.rejects(syncDocumentation(f.client, { directory, configuration: f.configuration }), {
    code: 'network_unavailable',
  });
  assert.equal(f.state.downloads, 1);
  interrupted = false;
  const done = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(done.pagesResumed, 1);
  assert.equal(done.pagesFetched, 0);
  assert.equal(f.state.downloads, 1);
  assert.equal(
    f.state.calls.filter(
      (c) => c.resource === 'resources' && c.query.collection === 'nodes' && !c.query.after,
    ).length,
    1,
  );
  const index = JSON.parse(
    await readFile(join(directory, 'content', 'memory-one', 'graph.json'), 'utf8'),
  );
  assert.equal(index.chunks.nodes.length, 2);
});

test('revocation clears interrupted private downloads and a permission revision forces new authorized bodies', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('one');
  f.page('two');
  const get = f.client.get;
  f.client.get = async (resource, query) => {
    if (resource === 'memory/markdown' && query.pageId === 'two') {
      throw new AgentError('network_unavailable', 'Interrupted');
    }
    return get(resource, query);
  };
  await assert.rejects(syncDocumentation(f.client, { directory, configuration: f.configuration }), {
    code: 'network_unavailable',
  });
  f.state.access = 'new-membership';
  f.client.get = get;
  const done = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(done.pagesResumed, 0);
  assert.equal(done.pagesFetched, 2);
  f.page('one', null, { text: 'Uncommitted new private data' });
  f.client.get = async (resource, query) => {
    if (resource === 'memory/tree' && query.checkpoint) {
      throw new AgentError('network_unavailable', 'Interrupted');
    }
    return get(resource, query);
  };
  await assert.rejects(syncDocumentation(f.client, { directory }), { code: 'network_unavailable' });
  f.client.get = get;
  f.state.deny = true;
  assert.deepEqual((await syncDocumentation(f.client, { directory })).unavailable, ['memory:one']);
  assert.deepEqual((await manifest(directory)).files, {});
  assert.deepEqual(await readdir(join(f.client.store.directory, 'documentation-cache')), []);
});

test('media are addressed once by ID, digest-verified and reused without downloading unchanged bytes', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.state.assets.set('asset', { bytes: Buffer.from('One shared resource') });
  f.page('one', null, { assetIds: ['asset'] });
  f.page('two', null, { assetIds: ['asset'] });
  f.configuration.media = 'local';
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(f.state.downloads, 1);
  let m = await manifest(directory);
  const text = await readFile(join(directory, 'content', m.sources[0].documents.one.file), 'utf8');
  assert.match(text, /\.\.\/\.\.\/resources\/asset.txt/);
  assert.ok(!text.includes('geniustasker-asset:'));
  await syncDocumentation(f.client, { directory });
  assert.equal(f.state.downloads, 1);
  f.state.pages.delete('one');
  f.state.revision++;
  await syncDocumentation(f.client, { directory });
  m = await manifest(directory);
  assert.ok(m.files['memory-one/resources/asset.txt']);
  f.state.assets.set('bad', { bytes: Buffer.from('Broken transfer'), sha256: '0'.repeat(64) });
  f.page('two', null, { assetIds: ['bad'] });
  await assert.rejects(syncDocumentation(f.client, { directory }), {
    code: 'media_digest_mismatch',
  });
  assert.ok((await manifest(directory)).files['memory-one/resources/asset.txt']);
});

test('confirmed revocation removes managed source data, regrant restores it; network errors never masquerade as revocation', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('private', null, { text: 'Private product plan' });
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  f.state.deny = true;
  const revoked = await syncDocumentation(f.client, { directory });
  assert.deepEqual(revoked.unavailable, ['memory:one']);
  const m = await manifest(directory);
  assert.deepEqual(m.files, {});
  assert.ok(!JSON.stringify(m).includes('Private product plan'));
  f.state.deny = false;
  f.state.access = '2';
  const restored = await syncDocumentation(f.client, { directory });
  assert.equal(restored.pagesFetched, 1);
  f.state.owner = 'other';
  await assert.rejects(syncDocumentation(f.client, { directory }), {
    code: 'documentation_account_mismatch',
  });
});

test('Graph exports retain own notes and qualified relations without fetching borrowed Memory data', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.configuration.sources[0].graph = true;
  f.state.nodes = [
    {
      id: 'owl',
      revision: '1',
      data: {
        title: 'Owl',
        text: 'Own graph notes',
        references: [{ scope: 'memory:friend', pageId: 'design' }],
      },
    },
    { id: 'story', revision: '2', data: { title: 'Story' } },
  ];
  f.state.edges = [
    {
      id: 'appearance',
      revision: '3',
      data: { source: 'owl', target: 'story', relation: 'appears-in', certainty: 'confirmed' },
    },
  ];
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  let content = await readFile(
    join(directory, 'content', 'memory-one', 'graph', 'nodes-0000.md'),
    'utf8',
  );
  assert.match(content, /Own graph notes/);
  assert.match(
    await readFile(join(directory, 'content', 'memory-one', 'graph', 'edges-0000.md'), 'utf8'),
    /appears-in/,
  );
  assert.match(content, /resolve current access/);
  assert.ok(!f.state.calls.some((call) => call.query.scope === 'memory:friend'));
  f.state.graphChanges = [
    {
      collection: 'nodes',
      kind: 'upsert',
      id: 'owl',
      revision: '4',
      data: {
        title: 'Owl revised',
        text: 'Updated notes',
        references: [{ scope: 'memory:friend', pageId: 'design' }],
      },
    },
  ];
  f.state.revision++;
  await syncDocumentation(f.client, { directory });
  content = await readFile(
    join(directory, 'content', 'memory-one', 'graph', 'nodes-0000.md'),
    'utf8',
  );
  assert.match(content, /Updated notes/);
  assert.equal(
    f.state.calls.filter((c) => c.resource === 'resources' && c.query.collection === 'nodes')
      .length,
    1,
  );
});

test('local edits, additions, path traversal, symlinks and concurrent writers are refused without overwriting data', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('one');
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  const m = await manifest(directory),
    file = join(directory, 'content', m.sources[0].documents.one.file);
  const original = await readFile(file);
  await writeFile(file, 'My local edit');
  await assert.rejects(syncDocumentation(f.client, { directory }), {
    code: 'documentation_conflict',
  });
  assert.equal(await readFile(file, 'utf8'), 'My local edit');
  await writeFile(file, original);
  await writeFile(join(directory, 'content', 'unrelated.md'), 'Keep');
  await assert.rejects(syncDocumentation(f.client, { directory }), {
    code: 'documentation_conflict',
  });
  await rm(join(directory, 'content', 'unrelated.md'));
  for (const path of ['../file', 'a/../file', '/file', 'a\\b', 'a//b', 'C:/file']) {
    assert.throws(() => safeRelative(path), { code: 'unsafe_documentation_path' });
  }
  const link = join(directory, 'linked');
  await symlink(directory, link);
  await assert.rejects(
    syncDocumentation(f.client, { directory: link, configuration: f.configuration }),
    { code: 'unsafe_documentation_path' },
  );
  const store = new DocumentationStore(directory);
  await store.run(async () => {
    await assert.rejects(syncDocumentation(f.client, { directory }), {
      code: 'documentation_locked',
    });
    await assert.rejects(store.unlock(), { code: 'documentation_locked' });
  });
});

test('directory swap recovery restores the previous snapshot instead of publishing an unchecked staged download', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('one');
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  const old = await manifest(directory),
    stage = '.stage-' + randomUUID(),
    previous = '.previous-' + randomUUID();
  await mkdir(join(directory, stage));
  await writeFile(
    join(directory, stage, '.geniustasker-manifest.json'),
    JSON.stringify({ ...old, files: {} }),
  );
  await writeFile(join(directory, '.geniustasker-swap.json'), JSON.stringify({ stage, previous }));
  await rename(join(directory, 'content'), join(directory, previous));
  assert.equal((await documentationStatus({ directory })).interrupted, true);
  const fresh = await syncDocumentation(f.client, { directory });
  assert.equal(fresh.pagesReused, 1);
  assert.ok((await manifest(directory)).sources[0].pages.one);
});

test('API wrappers reject crossed contexts, invalid paths and inconsistent conditional replies', async () => {
  const f = clientFixture();
  f.page('one');
  const good = await readMemoryTree(f.client, { scope: 'memory:one' });
  assert.equal(good.items.length, 1);
  await assert.rejects(readMemoryTree(f.client, { scope: 'memory:one', parentId: '../escape' }), {
    code: 'invalid_arguments',
  });
  const bad = { get: async () => ({ ...good, notModified: true }) };
  await assert.rejects(readMemoryTree(bad, { scope: 'memory:one' }), { code: 'invalid_response' });
  const doc = await readMemoryMarkdown(f.client, { scope: 'memory:one', pageId: 'one' });
  await assert.rejects(
    readMemoryMarkdown(
      { get: async () => ({ ...doc, id: 'other' }) },
      { scope: 'memory:one', pageId: 'one' },
    ),
    { code: 'invalid_response' },
  );
});

test('enabling pages after a Graph-only export and prototype-like IDs never loses content', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  for (const name of ['__proto__', 'constructor', 'toString']) {
    f.page(name);
  }
  f.configuration.sources[0] = { scope: 'memory:one', pages: false, graph: true };
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  f.configuration.sources[0].pages = true;
  const result = await syncDocumentation(f.client, { directory, configuration: f.configuration });
  assert.equal(result.pagesFetched, 3);
  assert.equal(Object.keys((await manifest(directory)).sources[0].pages).length, 3);
});

test('revocation at the final fence purges both the old and staged source', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('one');
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  f.page('two');
  const original = f.client.get;
  f.client.get = async (resource, query) => {
    if (resource === 'memory/tree' && query.checkpoint) {
      throw new AgentError('agent_permission_denied', 'Revoked', { status: 403 });
    }
    return original(resource, query);
  };
  const result = await syncDocumentation(f.client, { directory });
  assert.deepEqual(result.unavailable, ['memory:one']);
  assert.deepEqual((await manifest(directory)).files, {});
});

test('account switching during a read and byte budgets leave the existing snapshot intact', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory);
  f.page('one');
  await syncDocumentation(f.client, { directory, configuration: f.configuration });
  const old = await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8');
  f.page('two', null, { text: 'z'.repeat(5000) });
  await assert.rejects(syncDocumentation(f.client, { directory, maxBytes: 1024 }), {
    code: 'documentation_capacity',
  });
  assert.equal(
    await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8'),
    old,
  );
  const get = f.client.get;
  f.client.get = async (resource, query) => {
    const result = await get(resource, query);
    if (resource === 'memory/markdown') {
      f.state.owner = 'another';
    }
    return result;
  };
  await assert.rejects(syncDocumentation(f.client, { directory }), {
    code: 'read_context_changed',
  });
  assert.equal(
    await readFile(join(directory, 'content', '.geniustasker-manifest.json'), 'utf8'),
    old,
  );
});

test('media comparison avoids uploads and downloads for current verified assets, with a legacy fallback', async (t) => {
  const directory = await temporary(t),
    f = clientFixture(directory),
    assetId = randomUUID();
  const file = join(directory, 'image.txt');
  await writeFile(file, 'Identical bytes');
  f.state.assets.set(assetId, { bytes: Buffer.from('Identical bytes') });
  const identical = await compareMedia(f.client, { scope: 'memory:one', id: assetId, file });
  assert.equal(identical.identical, true);
  assert.equal(identical.downloaded, false);
  assert.equal(f.state.downloads, 0);
  await writeFile(file, 'A different illustration');
  assert.equal(
    (await compareMedia(f.client, { scope: 'memory:one', id: assetId, file })).identical,
    false,
  );
  const get = f.client.get;
  f.client.get = async (resource, query) => {
    const response = await get(resource, query);
    if (resource === 'resources') {
      delete response.items[0].data.sha256;
    }
    return response;
  };
  assert.equal(
    (await compareMedia(f.client, { scope: 'memory:one', id: assetId, file })).downloaded,
    true,
  );
  assert.equal(f.state.downloads, 1);
});
