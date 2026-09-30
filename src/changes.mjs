import { setTimeout as sleep } from 'node:timers/promises';
import * as z from 'zod/v4';
import { AgentClient } from './client.mjs';
import { Transport } from './transport.mjs';
import catalog from './command-catalog.mjs';
import { fail } from './errors.mjs';

export const changesSchema = z
  .object({
    scope: z
      .string()
      .max(256)
      // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
      .regex(/^(project|memory):[^\u0000-\u001f]+$/u),
    collection: z.string().min(1).max(32),
    cursor: z.string().min(1).max(4096),
  })
  .strict();
export const watchSchema = changesSchema
  .extend({ waitSeconds: z.number().int().min(1).max(catalog.changes.maxWatchSeconds).optional() })
  .strict();
const revision = z
  .string()
  .max(16)
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value) <= 9007199254740991n);
const changePageSchema = z
  .object({
    scope: z.string(),
    collection: z.string(),
    epoch: z.string().min(1),
    checkpoint: revision,
    items: z.array(
      z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('upsert'),
            id: z.string().min(1),
            revision,
            data: z.record(z.string(), z.unknown()),
          })
          .strict(),
        z
          .object({ kind: z.literal('remove'), id: z.string().min(1), revision, data: z.null() })
          .strict(),
      ]),
    ),
    omittedIds: z.array(z.string().min(1)),
    nextCursor: z.string().min(1).max(4096),
    hasMore: z.boolean(),
    pollAfterSeconds: z.number().int().min(1).max(86400),
  })
  .strict();
function query(input, schema) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use a project or memory scope, collection and unchanged change cursor; waitSeconds must be within the supported bound.',
    );
  }
  return parsed.data;
}
/** Validate the entire bounded page before a caller can adopt its next cursor. */
export async function readChanges(client, input) {
  const requested = query(input, changesSchema),
    page = await client.get('changes', requested);
  if (
    !changePageSchema.safeParse(page).success ||
    page.scope !== requested.scope ||
    page.collection !== requested.collection
  ) {
    fail('invalid_response', 'The change page was invalid; keep the previous cursor.');
  }
  return page;
}
/** One bounded wait, not a daemon. Each poll spends the same account budget as
 * any other read and repeats authorization. Errors are surfaced immediately;
 * quotas, expired history and revocation never trigger a blind retry loop. */
export async function watchChanges(client, input, requestSignal) {
  const { waitSeconds = 30, ...requested } = query(input, watchSchema);
  const deadline = new AbortController(),
    parents = [client.transport.signal, requestSignal].filter(Boolean);
  const parent = parents.length ? AbortSignal.any(parents) : undefined;
  const signal = parent ? AbortSignal.any([parent, deadline.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(), waitSeconds * 1000);
  const bounded = new AgentClient(
    new Transport(client.transport.origin, {
      fetchImpl: client.transport.fetch,
      timeoutMs: client.transport.timeoutMs,
      signal,
    }),
    client.store,
  );
  let page = null,
    polls = 0,
    cursor = requested.cursor;
  const timedOut = () => ({ reason: 'timeout', polls, page, nextCursor: cursor });
  try {
    if (parent?.aborted) {
      fail('cancelled', 'The wait was cancelled.', { nextCursor: cursor });
    }
    while (!signal.aborted) {
      page = await readChanges(bounded, { ...requested, cursor });
      polls++;
      cursor = page.nextCursor;
      if (page.items.length || page.omittedIds.length || page.hasMore) {
        return { reason: 'changes', polls, page, nextCursor: cursor };
      }
      await sleep(
        Math.max(catalog.changes.pollIntervalSeconds, page.pollAfterSeconds) * 1000,
        undefined,
        { signal },
      );
    }
    if (parent?.aborted) {
      fail('cancelled', 'The wait was cancelled.', { nextCursor: cursor });
    }
    return timedOut();
  } catch (error) {
    if (parent?.aborted) {
      fail('cancelled', 'The wait was cancelled.', { nextCursor: cursor });
    }
    if (
      deadline.signal.aborted &&
      (error?.name === 'AbortError' || error?.code === 'network_unavailable')
    ) {
      return timedOut();
    }
    // Completed empty polls may advance the cursor. Preserve it on an error,
    // but do not claim that a failed final request was an empty successful read.
    if (error?.details) {
      error.details.nextCursor = cursor;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
