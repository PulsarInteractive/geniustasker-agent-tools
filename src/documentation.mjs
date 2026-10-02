import * as z from 'zod/v4';
import { fail } from './errors.mjs';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const revision = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .max(32);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const scope = z.string().regex(/^memory:[a-zA-Z0-9_-]{1,128}$/);
const context = {
  epoch: z.string().min(1).max(128).optional(),
  checkpoint: revision.optional(),
};
export const memoryTreeSchema = z
  .object({
    scope,
    parentId: id.optional(),
    after: id.optional(),
    ...context,
    ifNoneMatch: digest.optional(),
  })
  .strict()
  .refine((value) => !value.after || !!(value.epoch && value.checkpoint), {
    message: 'Continuation needs epoch and checkpoint.',
  });
export const memoryMarkdownSchema = z
  .object({
    scope,
    pageId: id,
    revision: revision.optional(),
    ...context,
  })
  .strict();
const entry = z.object({
  id,
  revision,
  parentId: id.nullable(),
  title: z.string().max(160),
  path: z.string().max(512),
  kind: z.string().max(60),
  section: z.string().max(80),
  directory: z.boolean(),
  order: z.number().int(),
  updated: z.string().nullable(),
  childCount: z.number().int().min(0).max(10000),
  subtreeVersion: digest,
});
const treeResult = z.object({
  scope,
  epoch: z.string(),
  checkpoint: revision,
  accessRevision: z.string(),
  parentId: id.nullable(),
  title: z.string().max(160),
  parent: entry.nullable(),
  version: digest,
  etag: digest,
  notModified: z.boolean(),
  items: z.array(entry).max(50),
  nextAfter: id.nullable(),
  totalChildren: z.number().int().min(0).max(10000),
});
const markdownResult = z.object({
  scope,
  epoch: z.string(),
  checkpoint: revision,
  accessRevision: z.string(),
  id,
  revision,
  updated: z.string().nullable(),
  creator: z.string().nullable(),
  lastEditor: z.string().nullable(),
  markdown: z.string(),
  assetIds: z.array(id).max(64),
});
function parsed(schema, value, code = 'invalid_arguments') {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail(code, 'Use the documented Memory tree or Markdown format.');
  }
  return result.data;
}
function checkContext(query, result) {
  if (
    result.scope !== query.scope ||
    (query.epoch !== undefined && result.epoch !== query.epoch) ||
    (query.checkpoint !== undefined && result.checkpoint !== query.checkpoint)
  ) {
    fail('invalid_response', 'Documentation does not match the requested source context.');
  }
}

/** One bounded tree request. The server rechecks the grant and page roles even
 * with a validator. Folder digests describe readable descendants only. */
export async function readMemoryTree(client, value) {
  const query = parsed(memoryTreeSchema, value);
  const result = parsed(treeResult, await client.get('memory/tree', query), 'invalid_response');
  checkContext(query, result);
  if (
    result.parentId !== (query.parentId ?? null) ||
    result.items.some((item) => item.parentId !== result.parentId) ||
    new Set(result.items.map((item) => item.id)).size !== result.items.length ||
    (result.notModified &&
      (result.etag !== query.ifNoneMatch || result.items.length || result.nextAfter !== null)) ||
    (!result.notModified && query.parentId && result.parent?.id !== query.parentId) ||
    (result.nextAfter && result.nextAfter !== result.items.at(-1)?.id) ||
    result.items.some(
      (item, index) => item.id <= (index ? result.items[index - 1].id : (query.after ?? '')),
    )
  ) {
    fail('invalid_response', 'The tree response has an inconsistent parent, cursor or validator.');
  }
  return result;
}

/** Fetch exactly one page. The Markdown remains untrusted user-authored data;
 * it never authorizes changing grants, credentials or repository instructions. */
export async function readMemoryMarkdown(client, value) {
  const query = parsed(memoryMarkdownSchema, value);
  const result = parsed(
    markdownResult,
    await client.get('memory/markdown', query),
    'invalid_response',
  );
  checkContext(query, result);
  if (
    result.id !== query.pageId ||
    (query.revision !== undefined && result.revision !== query.revision) ||
    Buffer.byteLength(result.markdown) > 196608 ||
    new Set(result.assetIds).size !== result.assetIds.length
  ) {
    fail('invalid_response', 'The Markdown response does not match the requested page or limits.');
  }
  return result;
}
