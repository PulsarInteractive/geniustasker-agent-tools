import * as z from 'zod/v4';
import { fail } from './errors.mjs';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const scope = z.string().regex(/^memory:[a-zA-Z0-9_-]{1,128}$/);
const cursor = {
  epoch: z.string().min(1).max(128).optional(),
  checkpoint: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .max(32)
    .optional(),
};
export const searchSchema = z
  .object({
    scope,
    query: z.string().trim().min(1).max(200),
    collection: z.enum(['pages', 'nodes']).optional(),
    after: id.optional(),
    ...cursor,
  })
  .strict()
  .refine((value) => !value.after || !!(value.epoch && value.checkpoint), {
    message: 'Continuation needs epoch and checkpoint.',
  });
export const graphSchema = z
  .object({ scope, center: id, depth: z.number().int().min(0).max(3).optional(), ...cursor })
  .strict();
export const referenceSchema = z
  .object({
    scope,
    pageId: id,
    blockId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,80}$/)
      .optional(),
  })
  .strict();

function input(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use a memory scope and the documented search, Graph or reference parameters.',
    );
  }
  return parsed.data;
}

/** Query one bounded page without following cursors or retrying automatically. */
export async function searchMemory(client, value) {
  const query = input(searchSchema, value);
  const result = await client.get('knowledge', { ...query, mode: 'search' });
  if (
    result?.scope !== query.scope ||
    result.mode !== 'search' ||
    !Array.isArray(result.items) ||
    result.items.length > 25
  ) {
    fail('invalid_response', 'The search response does not match the requested scope.');
  }
  return result;
}

/** Read a compact neighborhood; full node text remains a separate resource read. */
export async function exploreGraph(client, value) {
  const query = input(graphSchema, value);
  const result = await client.get('knowledge', { ...query, mode: 'graph' });
  if (
    result?.scope !== query.scope ||
    result.mode !== 'graph' ||
    !Array.isArray(result.nodes) ||
    !Array.isArray(result.edges) ||
    result.nodes.length > 80 ||
    result.edges.length > 160
  ) {
    fail('invalid_response', 'The Graph response does not match the requested scope or bounds.');
  }
  const ids = new Set(result.nodes.map((node) => node.id));
  if (
    !ids.has(query.center) ||
    result.edges.some((edge) => !ids.has(edge.data?.source) || !ids.has(edge.data?.target))
  ) {
    fail('invalid_response', 'The Graph response contains unresolved endpoints.');
  }
  return result;
}

/** Linked content is never persisted by this client. Resolve again after access
 * changes; unavailable content must not delete the user's node or relations. */
export async function resolveMemory(client, value) {
  const query = input(referenceSchema, value);
  const result = await client.get('reference', query);
  if (
    result?.scope !== query.scope ||
    result.pageId !== query.pageId ||
    result.blockId !== (query.blockId ?? null) ||
    !['available', 'unavailable', 'missing'].includes(result.status) ||
    (result.status === 'available' ? result.page?.id !== query.pageId : result.page !== null) ||
    (result.status === 'unavailable' && (result.epoch !== null || result.accessRevision !== null))
  ) {
    fail(
      'invalid_response',
      'The reference response does not match the requested target or current access.',
    );
  }
  return result;
}
