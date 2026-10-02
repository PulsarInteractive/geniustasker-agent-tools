import * as z from 'zod/v4';
import { posix } from 'node:path';
import { DocumentationStore, DocumentationDownloads, digest } from './documentation-store.mjs';
import { readMemoryTree, readMemoryMarkdown } from './documentation.mjs';
import { exportGraph } from './documentation-graph.mjs';
import { fail } from './errors.mjs';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const sourceSchema = z
  .object({
    scope: z.string().regex(/^memory:[a-zA-Z0-9_-]{1,128}$/),
    parentId: id.optional(),
    pages: z.boolean().default(true),
    graph: z.boolean().default(false),
  })
  .strict()
  .refine((source) => source.pages || source.graph, { message: 'Select pages or Graph.' });
export const documentationConfigurationSchema = z
  .object({
    formatVersion: z.literal(1),
    sources: z.array(sourceSchema).min(1).max(50),
    media: z.enum(['references', 'local']).default('references'),
  })
  .strict()
  .refine(
    (value) => new Set(value.sources.map((source) => source.scope)).size === value.sources.length,
    {
      message: 'Choose one subtree per Memory scope.',
    },
  );
export const documentationSyncSchema = z
  .object({
    directory: z.string().min(1).max(4096),
    configuration: documentationConfigurationSchema.optional(),
    maxFiles: z.number().int().min(1).max(100000).optional(),
    maxBytes: z.number().int().min(1024).max(4294967296).optional(),
  })
  .strict();
export const documentationDirectorySchema = z
  .object({ directory: z.string().min(1).max(4096) })
  .strict();
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail('invalid_arguments', 'Use the documented repository documentation configuration.');
  }
  return result.data;
};
const denied = (error) =>
  error.status === 403 ||
  ['forbidden', 'agent_permission_denied', 'scope_not_found', 'memory_page_not_found'].includes(
    error.code,
  );
const slug = (title) =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'document';
const escape = (value) =>
  String(value)
    .replace(/[\r\n]/g, ' ')
    .replace(/[\\`*_[\]<>|]/g, '\\$&');
const contextOf = (tree) => ({ epoch: tree.epoch, checkpoint: tree.checkpoint });
const equivalentAccess = (before, tree) =>
  before?.epoch === tree.epoch && before.accessRevision === tree.accessRevision;
const extension = (type) =>
  ({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  })[type] ?? 'bin';

async function collectPages(client, source, first, previous) {
  if (!source.pages) {
    return {};
  }
  const old = previous?.pages ?? {},
    pages = Object.create(null);
  if (first.notModified) {
    if (!previous || !equivalentAccess(previous, first)) {
      fail('invalid_response', 'An unchanged source has no matching local tree.');
    }
    return structuredClone(old);
  }
  const oldChildren = new Map();
  for (const page of Object.values(old)) {
    const children = oldChildren.get(page.parentId) ?? [];
    children.push(page);
    oldChildren.set(page.parentId, children);
  }
  const retain = (root) => {
    const queue = [root],
      seen = new Set();
    while (queue.length) {
      const page = queue.pop();
      if (seen.has(page.id)) {
        fail('invalid_documentation_manifest', 'A cached branch contains a cycle.');
      }
      seen.add(page.id);
      pages[page.id] = page;
      queue.push(...(oldChildren.get(page.id) ?? []));
    }
  };
  const pending = [first];
  if (first.parent) {
    pages[first.parent.id] = first.parent;
  }
  const visited = new Set();
  while (pending.length) {
    let tree = pending.pop();
    const key = tree.parentId ?? '';
    if (visited.has(key)) {
      fail('invalid_response', 'The remote tree repeats a branch.');
    }
    visited.add(key);
    while (true) {
      if (tree.accessRevision !== first.accessRevision) {
        fail('read_context_changed', 'Memory access changed during tree traversal.');
      }
      for (const page of tree.items) {
        if (Object.hasOwn(pages, page.id)) {
          fail('invalid_response', 'The remote tree repeats a page.');
        }
        const before = old[page.id];
        if (before?.subtreeVersion === page.subtreeVersion && equivalentAccess(previous, first)) {
          retain(page);
        } else {
          pages[page.id] = page;
          if (page.childCount) {
            pending.push(
              await readMemoryTree(client, {
                scope: source.scope,
                parentId: page.id,
                ...contextOf(first),
              }),
            );
          }
        }
        if (Object.keys(pages).length > 10000) {
          fail('documentation_capacity', 'A source exceeds its supported page capacity.');
        }
      }
      if (!tree.nextAfter) {
        break;
      }
      tree = await readMemoryTree(client, {
        scope: source.scope,
        parentId: tree.parentId ?? undefined,
        after: tree.nextAfter,
        ...contextOf(first),
      });
    }
  }
  return pages;
}

function documentPaths(source, pages) {
  const root = source.scope.replace(':', '-'),
    paths = Object.create(null);
  for (const page of Object.values(pages)) {
    const ancestors = [],
      seen = new Set();
    let current = page;
    while (current) {
      if (seen.has(current.id) || seen.size > 12) {
        fail('invalid_response', 'The exported tree contains an invalid hierarchy.');
      }
      seen.add(current.id);
      ancestors.unshift(`${slug(current.title).slice(0, 24)}--${digest(current.id).slice(0, 20)}`);
      if (current.id === source.parentId || current.parentId === null) {
        break;
      }
      current = pages[current.parentId];
      if (!current) {
        fail('invalid_response', 'The exported page has no readable parent.');
      }
    }
    paths[page.id] = `${root}/pages/${ancestors.join('/')}/index.md`;
  }
  return paths;
}

async function localAsset(client, store, source, tree, assetId, previous, downloads) {
  const page = await client.get('resources', {
    scope: source.scope,
    collection: 'assets',
    id: assetId,
    ...contextOf(tree),
  });
  if (
    page.scope !== source.scope ||
    page.collection !== 'assets' ||
    page.epoch !== tree.epoch ||
    page.checkpoint !== tree.checkpoint ||
    page.items?.length !== 1 ||
    page.omittedIds?.length ||
    page.items[0].id !== assetId
  ) {
    fail(
      'incomplete_documentation',
      'A referenced media resource is not available in this source context.',
    );
  }
  const asset = page.items[0],
    data = asset.data;
  const url = /^\/api\/v2\/media\/([a-zA-Z0-9_-]{1,128})\/([a-zA-Z0-9_-]{1,128})$/.exec(
    data.url ?? '',
  );
  if (
    !url ||
    url[2] !== assetId ||
    !Number.isSafeInteger(data.sizeBytes) ||
    data.sizeBytes < 1 ||
    data.sizeBytes > 15000000 ||
    (data.sha256 !== undefined && data.sha256 !== null && !/^[a-f0-9]{64}$/.test(data.sha256))
  ) {
    fail('invalid_response', 'The media identity or digest is invalid.');
  }
  const file = `${source.scope.replace(':', '-')}/resources/${assetId}.${extension(data.contentType)}`;
  const key = JSON.stringify([assetId, asset.revision, data.sha256 ?? null]);
  const bucket = downloads.mediaBucket(tree);
  let bytes =
    previous?.revision === asset.revision && previous.file === file
      ? await store.readPrevious(file)
      : null;
  if (!bytes) {
    bytes = await downloads.read(source.scope, bucket, key, 15000000);
  }
  if (!bytes) {
    bytes = await client.transport.request('/api/agents/v1/media/content', {
      query: { scope: source.scope, ownerId: url[1], id: assetId },
      binary: true,
      token: await client.accessToken(),
    });
  }
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== data.sizeBytes ||
    (data.sha256 && digest(bytes) !== data.sha256)
  ) {
    fail('media_digest_mismatch', 'The downloaded resource does not match its verified source.');
  }
  await downloads.put(source.scope, bucket, key, bytes);
  await store.put(file, bytes);
  return { file, revision: asset.revision, sha256: digest(bytes) };
}

/** A sync is explicit and finite. It never writes to GeniusTasker, polls in a
 * daemon, widens grants or publishes the resulting private files to Git. */
export async function syncDocumentation(client, input) {
  const options = parse(documentationSyncSchema, input);
  const store = new DocumentationStore(options.directory, options);
  return store.run(async () => {
    const identity = await client.get('me'),
      capabilities = await client.get('capabilities');
    if (!capabilities.documentationSync) {
      fail('documentation_unavailable', 'This server has not enabled documentation export.');
    }
    if (typeof identity.actor?.ownerId !== 'string') {
      fail('invalid_response', 'The current account identity is unavailable.');
    }
    const realm = digest(`${client.transport.origin}\n${identity.actor.ownerId}`),
      before = store.previousManifest;
    if (before && before.realm !== realm) {
      fail(
        'documentation_account_mismatch',
        'Use a separate destination for another account or environment.',
      );
    }
    const configuration = parse(
      documentationConfigurationSchema,
      options.configuration ?? before?.configuration,
    );
    const downloads = new DocumentationDownloads(
      client.store?.directory,
      store.root,
      realm,
      options,
    );
    await downloads.begin(configuration.sources);
    const states = [],
      fences = [],
      stats = { pagesFetched: 0, pagesReused: 0, pagesResumed: 0, unavailable: [] };
    for (const source of configuration.sources) {
      let previous = before?.sources.find((state) => state.scope === source.scope);
      if (previous?.parentId !== (source.parentId ?? null)) {
        previous = null;
      }
      let tree;
      try {
        tree = await readMemoryTree(client, {
          scope: source.scope,
          parentId: source.parentId,
          ifNoneMatch:
            source.pages &&
            before?.configuration.sources.find((old) => old.scope === source.scope)?.pages === false
              ? undefined
              : previous?.etag,
        });
      } catch (error) {
        if (!denied(error)) {
          throw error;
        }
        states.push({ ...source, parentId: source.parentId ?? null, status: 'unavailable' });
        stats.unavailable.push(source.scope);
        await downloads.clearSource(source.scope);
        continue;
      }
      const pages = await collectPages(client, source, tree, previous),
        paths = documentPaths(source, pages);
      await downloads.prepare(source.scope, pages, tree);
      const state = {
        scope: source.scope,
        parentId: source.parentId ?? null,
        status: 'available',
        epoch: tree.epoch,
        accessRevision: tree.accessRevision,
        etag: tree.etag,
        version: tree.version,
        title: tree.title,
        pages,
        documents: Object.create(null),
        assets: Object.create(null),
      };
      const assets = new Set();
      const ensureAsset = async (asset) => {
        if (configuration.media === 'local' && !state.assets[asset]) {
          state.assets[asset] = await localAsset(
            client,
            store,
            source,
            tree,
            asset,
            previous?.assets?.[asset],
            downloads,
          );
        }
      };
      for (const page of Object.values(pages)) {
        const old = previous?.documents?.[page.id],
          path = paths[page.id];
        let bytes = null;
        if (
          old?.revision === page.revision &&
          old.file === path &&
          before.configuration.media === configuration.media &&
          equivalentAccess(previous, tree)
        ) {
          bytes = await store.readPrevious(old.file);
        }
        if (bytes) {
          await store.put(path, bytes);
          state.documents[page.id] = old;
          stats.pagesReused++;
          for (const asset of old.assetIds) {
            assets.add(asset);
          }
        } else {
          const query = {
            scope: source.scope,
            pageId: page.id,
            revision: page.revision,
            epoch: tree.epoch,
          };
          const key = downloads.pageKey(source.scope, page, tree);
          const cached = await downloads.read(source.scope, 'pages', key);
          let document;
          if (cached) {
            document = await readMemoryMarkdown(
              { get: async () => JSON.parse(cached.toString('utf8')) },
              query,
            );
            stats.pagesResumed++;
          } else {
            document = await readMemoryMarkdown(client, { ...query, checkpoint: tree.checkpoint });
            await downloads.put(source.scope, 'pages', key, Buffer.from(JSON.stringify(document)));
            stats.pagesFetched++;
          }
          if (document.accessRevision !== tree.accessRevision) {
            fail('read_context_changed', 'Access changed while exporting the document.');
          }
          let markdown = document.markdown;
          for (const asset of document.assetIds) {
            await ensureAsset(asset);
            if (configuration.media === 'local') {
              const target = posix.relative(posix.dirname(path), state.assets[asset].file);
              markdown = markdown.split(`(geniustasker-asset:${asset})`).join(`(${target})`);
            }
          }
          await store.put(path, markdown);
          for (const asset of document.assetIds) {
            assets.add(asset);
          }
          state.documents[page.id] = {
            file: path,
            revision: page.revision,
            assetIds: document.assetIds,
          };
        }
      }
      await exportGraph(client, store, source, tree, previous, state, assets, downloads);
      for (const asset of assets) {
        await ensureAsset(asset);
      }
      const index = [
        '> Automatically generated. Edit source documents through GeniusTasker MCP, then sync again.',
        '',
        `# ${escape(tree.title)}`,
        '',
      ];
      for (const page of Object.values(pages).sort((a, b) =>
        paths[a.id].localeCompare(paths[b.id]),
      )) {
        index.push(
          `- [${escape(page.title)}](${paths[page.id].slice(source.scope.replace(':', '-').length + 1)}) · ${escape(page.kind)}`,
        );
      }
      if (source.graph) {
        index.push('- [Graph](graph.md) · [Structured Graph](graph.json)');
      }
      index.push(
        '',
        '---',
        '',
        `Source: \`${source.scope}\` · Epoch: \`${tree.epoch}\` · Tree version: \`${tree.version}\``,
        '',
      );
      await store.put(`${source.scope.replace(':', '-')}/index.md`, index.join('\n'));
      states.push(state);
      fences.push({ source, tree });
    }
    // Every participating scope must still match before publishing the new
    // snapshot. An HTTP/ACL/network failure is never interpreted as an empty tree.
    for (const { source, tree } of fences) {
      try {
        const finalTree = await readMemoryTree(client, {
          scope: source.scope,
          parentId: source.parentId,
          ...contextOf(tree),
          ifNoneMatch: tree.etag,
        });
        if (finalTree.accessRevision !== tree.accessRevision || finalTree.etag !== tree.etag) {
          fail(
            'read_context_changed',
            'Memory permissions changed before the snapshot was committed.',
          );
        }
      } catch (error) {
        if (!denied(error)) {
          throw error;
        }
        await store.discardPrefix(source.scope.replace(':', '-'));
        await downloads.clearSource(source.scope);
        states[states.findIndex((state) => state.scope === source.scope)] = {
          scope: source.scope,
          parentId: source.parentId ?? null,
          status: 'unavailable',
        };
        stats.unavailable.push(source.scope);
      }
    }
    const finalIdentity = await client.get('me');
    if (
      finalIdentity.actor?.ownerId !== identity.actor.ownerId ||
      finalIdentity.actor?.profileId !== identity.actor.profileId ||
      finalIdentity.actor?.connectionId !== identity.actor.connectionId
    ) {
      fail(
        'read_context_changed',
        'The account or agent profile changed during documentation sync.',
      );
    }
    const checkedAt = new Date().toISOString();
    await store.commit({ realm, configuration, sources: states, checkedAt });
    await downloads.finish();
    return {
      directory: store.root,
      contentDirectory: store.current,
      checkedAt,
      files: Object.keys(store.files).length,
      bytes: store.size,
      ...stats,
    };
  });
}

export async function documentationStatus(input) {
  const { directory } = parse(documentationDirectorySchema, input);
  const status = await new DocumentationStore(directory).status();
  if (!status.formatVersion) {
    return status;
  }
  return {
    directory,
    checkedAt: status.checkedAt,
    checkRecommended: new Date(status.checkedAt).toDateString() !== new Date().toDateString(),
    files: Object.keys(status.files).length,
    sources: status.sources.map((source) => ({
      scope: source.scope,
      status: source.status,
      title: source.title,
    })),
    authorization:
      'Saved snapshot; current access has not been checked by this local status command.',
  };
}

export async function unlockDocumentation(input) {
  return new DocumentationStore(parse(documentationDirectorySchema, input).directory).unlock();
}
