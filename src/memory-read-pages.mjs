import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const memoryReadPagesTool = tools.find((tool) => tool.name === 'tasker_memory_read_pages');
export const memoryReadPagesSchema = z.fromJSONSchema(memoryReadPagesTool.inputSchema);
const encoder = new TextEncoder();
const byteLength = (value) => encoder.encode(JSON.stringify(value)).length;
const batchBytes = 64 * 1024;
const revisionPattern = /^(0|[1-9][0-9]{0,31})$/;
const sectionResult = z.object({
  scope: z.string(),
  id: z.string(),
  title: z.string().max(160),
  revision: z.string(),
  epoch: z.string().min(1).max(128),
  checkpoint: z.string(),
  accessRevision: z.string().min(1).max(256),
  mode: z.enum(['blocks', 'outline']),
  notModified: z.boolean(),
  nextCursor: z.string().min(1).max(2048).nullable(),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
        kind: z.enum(['markdown', 'image', 'attachment', 'code', 'callout', 'mermaid']),
        order: z.number().int(),
        text: z.string().optional(),
        offset: z.number().int().nonnegative().optional(),
        complete: z.boolean().optional(),
        assetId: z.string().max(128).nullish(),
        caption: z.string().max(1000).nullish(),
        alt: z.string().max(1000).nullish(),
        language: z.string().max(40).nullish(),
      }),
    )
    .max(64),
});

function validateRequest(input) {
  const parsed = memoryReadPagesSchema.safeParse(input);
  if (!parsed.success) {
    fail('invalid_arguments', 'Choose one to five pages in one Memory.');
  }
  const { pages, epoch, checkpoint } = parsed.data;
  if (
    new Set(pages.map((page) => page.pageId)).size !== pages.length ||
    (epoch === undefined) !== (checkpoint === undefined) ||
    pages.some(
      (page) =>
        (page.blockIds &&
          (page.mode !== 'blocks' || new Set(page.blockIds).size !== page.blockIds.length)) ||
        (page.cursor && (!epoch || !page.revision || page.knownRevision !== undefined)) ||
        (page.revision !== undefined &&
          page.knownRevision !== undefined &&
          page.revision !== page.knownRevision),
    )
  ) {
    fail(
      'invalid_arguments',
      'Use different page IDs. Continue the same block selection with its cursor, revision, epoch and checkpoint.',
    );
  }
  return parsed.data;
}

// Page content stays in the request. A known revision is a conditional read, never a local cache hit.
function validatePage(query, value) {
  const parsed = sectionResult.safeParse(value);
  const selected = query.blockIds ? new Set(query.blockIds.split(',')) : null;
  if (
    !parsed.success ||
    !revisionPattern.test(value.revision) ||
    !revisionPattern.test(value.checkpoint) ||
    value.scope !== query.scope ||
    value.id !== query.pageId ||
    value.mode !== query.mode ||
    (selected && value.items.some((item) => !selected.has(item.id))) ||
    (value.nextCursor !== null && (value.nextCursor === query.cursor || !value.items.length)) ||
    (query.revision !== undefined && value.revision !== query.revision) ||
    (query.atRevision !== undefined && value.revision !== query.atRevision) ||
    (value.notModified &&
      (value.revision !== query.knownRevision || value.items.length || value.nextCursor)) ||
    byteLength(value) > query.maxBytes
  ) {
    fail('invalid_response', 'The Memory page did not match its selector or response bounds.', {
      status: 502,
    });
  }
  return parsed.data;
}

function isPageUnavailable(error) {
  return (
    error?.status === 404 &&
    ['memory_page_not_found', 'memory_version_not_found'].includes(error.code)
  );
}

const interruption = (error) => ({
  code: error.code,
  ...(Number.isSafeInteger(error.details?.retryAfterSeconds)
    ? { retryAfterSeconds: error.details.retryAfterSeconds }
    : {}),
  ...(Number.isSafeInteger(error.details?.resetAt) ? { resetAt: error.details.resetAt } : {}),
});

// Ordinary delegated GETs independently enforce plan, grants, ACLs and account quota.
// Keep metadata space outside each page budget. The final check counts actual serialized UTF-8.
export async function readMemoryPages(client, input) {
  const { scope, pages, epoch, checkpoint } = validateRequest(input);
  const maxBytes = Math.floor((batchBytes - 4096) / pages.length);
  const results = [];
  let snapshot = epoch ? { epoch, checkpoint } : {};
  let stopped;
  let attempted = 0;
  let cursor = 0;
  while (cursor < pages.length && !stopped) {
    // Establish one snapshot before concurrent reads, including when the first page is unavailable.
    const group = pages.slice(cursor, cursor + (snapshot.epoch ? 2 : 1));
    cursor += group.length;
    attempted += group.length;
    const reads = await Promise.allSettled(
      group.map(async (page) => {
        const query = {
          scope,
          ...page,
          ...(page.blockIds ? { blockIds: page.blockIds.join(',') } : {}),
          ...snapshot,
          maxBytes,
        };
        delete query.accessRevision;
        return validatePage(query, await client.get('memory/sections', query));
      }),
    );
    // A global refusal discards every successful read, including siblings already in flight.
    for (const read of reads) {
      if (
        read.status === 'rejected' &&
        !isPageUnavailable(read.reason) &&
        read.reason?.status !== 429 &&
        !(read.reason?.status === 409 && read.reason.code === 'memory_revision_changed')
      ) {
        throw read.reason;
      }
    }
    for (const [index, read] of reads.entries()) {
      const pageId = group[index].pageId;
      if (read.status === 'rejected') {
        const error = read.reason;
        if (isPageUnavailable(error)) {
          results.push({ pageId, status: 'unavailable' });
        } else if (error.status === 409) {
          results.push({ pageId, status: 'changed' });
        } else {
          stopped = error;
          results.push({ pageId, status: 'deferred' });
        }
        continue;
      }
      const {
        id,
        epoch,
        checkpoint,
        accessRevision,
        title,
        revision,
        mode,
        items,
        nextCursor,
        notModified,
      } = read.value;
      if (
        (snapshot.epoch !== undefined &&
          (epoch !== snapshot.epoch || checkpoint !== snapshot.checkpoint)) ||
        (snapshot.accessRevision !== undefined && accessRevision !== snapshot.accessRevision)
      ) {
        fail(
          'memory_read_context_changed',
          'Memory or access changed during this read. Restart from the authorized tree.',
          { status: 409 },
        );
      }
      snapshot = { epoch, checkpoint, accessRevision };
      results.push({
        pageId: id,
        status: notModified ? 'unchanged' : nextCursor ? 'partial' : 'complete',
        title,
        revision,
        mode,
        items,
        nextCursor,
      });
    }
  }
  if (stopped && results.every((page) => page.status === 'deferred')) {
    throw stopped;
  }
  for (const page of pages.slice(cursor)) {
    results.push({ pageId: page.pageId, status: 'deferred' });
  }
  const complete = results.filter(
    (page) => page.status === 'complete' || page.status === 'unchanged',
  ).length;
  const result = {
    scope,
    ...snapshot,
    requested: pages.length,
    attempted,
    complete,
    partial: complete !== pages.length,
    ...(stopped ? { interruption: interruption(stopped) } : {}),
    pages: results,
  };
  if (byteLength(result) > batchBytes) {
    fail('invalid_response', 'The combined Memory result exceeded the byte limit.', {
      status: 502,
    });
  }
  return result;
}
