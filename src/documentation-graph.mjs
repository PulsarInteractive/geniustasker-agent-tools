import * as z from 'zod/v4';
import { readChanges } from './changes.mjs';
import { fail } from './errors.mjs';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const recordSchema = z.object({
  id,
  revision: z.string().regex(/^[0-9]+$/),
  data: z.record(z.string(), z.unknown()),
});
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail('invalid_response', 'The Graph source format is invalid.');
  }
  return result.data;
};
const contextOf = (tree) => ({ epoch: tree.epoch, checkpoint: tree.checkpoint });
const equivalentAccess = (before, tree) =>
  before?.epoch === tree.epoch && before.accessRevision === tree.accessRevision;
const escape = (value) =>
  String(value)
    .replace(/[\r\n]/g, ' ')
    .replace(/[\\`*_[\]<>|]/g, '\\$&');

async function graphCollection(client, scope, collection, tree, previous, cursor, downloads) {
  const records = new Map((previous ?? []).map((record) => [record.id, record]));
  if (cursor) {
    try {
      for (let count = 0; count < 1000; count++) {
        const page = await readChanges(client, { scope, collection, cursor });
        if (page.epoch !== tree.epoch || page.omittedIds.length) {
          fail('incomplete_documentation', 'The Graph change response is incomplete.');
        }
        for (const item of page.items) {
          if (item.kind === 'remove') {
            records.delete(item.id);
          } else {
            records.set(
              item.id,
              parse(recordSchema, { id: item.id, revision: item.revision, data: item.data }),
            );
          }
        }
        cursor = page.nextCursor;
        if (!page.hasMore) {
          return { items: [...records.values()], cursor };
        }
      }
      fail('documentation_capacity', 'The Graph change window exceeds its request budget.');
    } catch (error) {
      if (!['reset_required', 'agent_change_history_expired'].includes(error.code)) {
        throw error;
      }
      records.clear(); // Explicit server reset: replace from a fresh bounded inventory.
    }
  }
  let after;
  for (let count = 0; count < 1000; count++) {
    const query = { scope, collection, after, ...contextOf(tree) };
    const key = JSON.stringify(query),
      bucket = downloads.graphBucket(tree);
    const cached = await downloads.read(scope, bucket, key, 8388608);
    const page = cached
      ? JSON.parse(cached.toString('utf8'))
      : await client.get('resources', query);
    if (
      page.scope !== scope ||
      page.collection !== collection ||
      page.epoch !== tree.epoch ||
      page.checkpoint !== tree.checkpoint ||
      !Array.isArray(page.items) ||
      page.items.length > 50 ||
      !Array.isArray(page.omittedIds) ||
      page.omittedIds.length
    ) {
      fail('incomplete_documentation', 'The Graph inventory is incomplete.');
    }
    for (const item of page.items) {
      const record = parse(recordSchema, item);
      if (records.has(record.id)) {
        fail('invalid_response', 'The Graph inventory repeated an item.');
      }
      records.set(record.id, record);
    }
    if (!cached) {
      await downloads.put(scope, bucket, key, Buffer.from(JSON.stringify(page)));
    }
    if (!page.nextAfter) {
      if (!page.changeCursor) {
        fail('invalid_response', 'The Graph inventory has no incremental cursor.');
      }
      return { items: [...records.values()], cursor: page.changeCursor };
    }
    if (page.nextAfter === after || page.nextAfter !== page.items.at(-1)?.id) {
      fail('invalid_response', 'The Graph inventory cursor did not advance.');
    }
    after = page.nextAfter;
  }
  fail('documentation_capacity', 'The Graph inventory exceeds its request budget.');
}

export async function exportGraph(client, store, source, tree, previous, state, assets, downloads) {
  if (!source.graph) {
    return;
  }
  const file = `${source.scope.replace(':', '-')}/graph.json`;
  const oldBytes =
    previous?.graph && equivalentAccess(previous, tree)
      ? await store.readPrevious(previous.graph.file)
      : null;
  const oldIndex = oldBytes ? JSON.parse(oldBytes.toString('utf8')) : null;
  let old = oldIndex;
  if (oldIndex?.formatVersion === 2) {
    old = { nodes: [], edges: [] };
    for (const collection of ['nodes', 'edges']) {
      const chunks = oldIndex.chunks?.[collection];
      if (!Array.isArray(chunks) || chunks.length > 300) {
        fail('invalid_documentation_manifest', 'The Graph chunk index is invalid.');
      }
      for (const path of chunks) {
        const bytes = await store.readPrevious(path);
        if (!bytes) {
          fail('invalid_documentation_manifest', 'A tracked Graph chunk is missing.');
        }
        const chunk = JSON.parse(bytes.toString('utf8'));
        if (!Array.isArray(chunk) || chunk.length > 100) {
          fail('invalid_documentation_manifest', 'A Graph chunk exceeds its bound.');
        }
        old[collection].push(...chunk.map((record) => parse(recordSchema, record)));
      }
    }
  }
  const nodes = await graphCollection(
    client,
    source.scope,
    'nodes',
    tree,
    old?.nodes,
    old && previous.graph.nodesCursor,
    downloads,
  );
  const edges = await graphCollection(
    client,
    source.scope,
    'edges',
    tree,
    old?.edges,
    old && previous.graph.edgesCursor,
    downloads,
  );
  if (nodes.items.length > 10000 || edges.items.length > 30000) {
    fail('documentation_capacity', 'The Graph exceeds its source capacity.');
  }
  const ids = new Set(nodes.items.map((node) => node.id));
  if (edges.items.some((edge) => !ids.has(edge.data.source) || !ids.has(edge.data.target))) {
    fail(
      'read_context_changed',
      'The Graph has missing endpoints; refresh its source before exporting.',
    );
  }
  for (const node of nodes.items) {
    if (node.data.imageAssetId) {
      assets.add(parse(id, node.data.imageAssetId));
    }
  }
  // Bounded portable chunks keep large Graphs out of one enormous JSON/Markdown
  // file. Borrowed references remain identities, never cached source bodies.
  const notice =
    '> Automatically generated from GeniusTasker. Edit through the [MCP](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/DOCUMENTATION_SYNC.md), then sync again.';
  const footer = `Source scope: \`${source.scope}\` · Epoch: \`${tree.epoch}\` · Checkpoint: \`${tree.checkpoint}\``;
  const overview = [
    notice,
    '',
    `# ${escape(tree.title)} — Graph`,
    '',
    'Linked Memory content is resolved online with current permissions. These files preserve this Graph’s own notes and qualified relations.',
    '',
  ];
  const chunks = { nodes: [], edges: [] };
  for (const [collection, records] of [
    ['nodes', nodes.items],
    ['edges', edges.items],
  ]) {
    records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (let offset = 0; offset < records.length; offset += 100) {
      const part = records.slice(offset, offset + 100),
        name = `graph/${collection}-${String(offset / 100).padStart(4, '0')}`;
      const path = `${source.scope.replace(':', '-')}/${name}`;
      chunks[collection].push(path + '.json');
      await store.put(path + '.json', JSON.stringify(part, null, 2) + '\n');
      const text = [
        notice,
        '',
        `# ${collection === 'nodes' ? 'Nodes' : 'Relations'} ${offset + 1}–${offset + part.length}`,
        '',
      ];
      for (const record of part) {
        if (collection === 'nodes') {
          text.push(
            `## ${escape(record.data.title ?? record.id)}`,
            '',
            String(record.data.text ?? record.data.summary ?? ''),
            '',
          );
          for (const ref of record.data.references ?? []) {
            text.push(
              `- Memory reference: \`${escape(ref.scope)}\` / \`${escape(ref.pageId)}\`${ref.blockId ? ' / `' + escape(ref.blockId) + '`' : ''} (resolve current access)`,
            );
          }
        } else {
          text.push(
            `## ${escape(record.data.label || record.data.relation)}`,
            '',
            `\`${escape(record.data.source)}\` → \`${escape(record.data.target)}\` · ${escape(record.data.certainty)}`,
            '',
            String(record.data.note ?? ''),
            '',
          );
        }
        text.push(
          `Source ID: \`${record.id}\` · Revision: \`${record.revision}\` · Updated: ${escape(record.data.updated ?? 'unknown')} · Author: ${escape(record.data.lastEditor ?? record.data.creator ?? 'unknown')}`,
          '',
        );
      }
      text.push('', '---', '', footer, '');
      await store.put(path + '.md', text.join('\n'));
      overview.push(
        `- [${collection === 'nodes' ? 'Nodes' : 'Relations'} ${offset + 1}–${offset + part.length}](${name}.md) · [JSON](${name}.json)`,
      );
    }
  }
  overview.push('', '---', '', footer, '');
  await store.put(file.replace('.json', '.md'), overview.join('\n'));
  await store.put(
    file,
    JSON.stringify(
      {
        formatVersion: 2,
        scope: source.scope,
        epoch: tree.epoch,
        counts: { nodes: nodes.items.length, edges: edges.items.length },
        chunks,
        referencePolicy:
          'Resolve linked Memory content online with current access. Unavailable targets do not remove nodes.',
      },
      null,
      2,
    ) + '\n',
  );
  state.graph = { file, nodesCursor: nodes.cursor, edgesCursor: edges.cursor };
}
