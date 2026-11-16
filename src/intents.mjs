import * as z from 'zod/v4';
import { fail } from './errors.mjs';
const uuid = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
const instant = z.iso.datetime({ offset: true });
const unique = (values) => new Set(values).size === values.length;
const ids = z.array(uuid).max(20).refine(unique);
const revision = z.string().regex(/^[1-9][0-9]{0,15}$/);
const selection = z
  .object({
    kind: z.enum(['focus', 'defer']),
    objective: z.enum(['finish', 'unblock', 'consistency', 'pause']),
    taskIds: ids.refine((v) => v.length > 0),
    startsAt: instant.nullable(),
    endsAt: instant,
  })
  .strict()
  .refine((v) => (v.kind === 'defer') === (v.objective === 'pause'));
export const intentReadSchema = z
  .object({
    scope: z
      .string()
      .max(136)
      .regex(/^project:[A-Za-z0-9_-]{1,128}$/),
  })
  .strict();
export const intentPreviewSchema = intentReadSchema.extend({ selection }).strict();
const entry = z.object({
  id: uuid,
  kind: z.enum(['focus', 'defer']),
  objective: z.enum(['finish', 'unblock', 'consistency', 'pause']),
  taskIds: ids,
  openTaskIds: ids,
  state: z.enum([
    'active',
    'scheduled',
    'expired',
    'cancelled',
    'consumed',
    'superseded',
    'stale_target',
    'stale_access',
    'stale_policy',
  ]),
  effective: z.boolean(),
  startsAt: instant,
  endsAt: instant,
  supersededBy: uuid.nullable(),
});
const snapshot = intentReadSchema.extend({
  epoch: z.string().min(1).max(128),
  projectRevision: revision,
  intentRevision: revision.nullable(),
  serverTime: instant,
  entries: z.array(entry).max(64),
});
const previewResult = snapshot.extend({
  selection,
  sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
  replaces: z.array(uuid).max(16).refine(unique),
});
const sameSelection = (a, b) =>
  a.kind === b.kind &&
  a.objective === b.objective &&
  a.startsAt === b.startsAt &&
  a.endsAt === b.endsAt &&
  JSON.stringify([...a.taskIds].sort()) === JSON.stringify([...b.taskIds].sort());
async function request(client, input, preview) {
  const parsed = (preview ? intentPreviewSchema : intentReadSchema).safeParse(input);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use an exact project, 1–20 task IDs and an explicit end time. Read workflow intents before changing a temporary instruction.',
    );
  }
  const token = await client.accessToken();
  const response = await client.transport.request(
    '/api/agents/v1/intents/' + (preview ? 'preview' : 'read'),
    { method: 'POST', json: parsed.data, token },
  );
  const checked = (preview ? previewResult : snapshot).safeParse(response);
  if (!checked.success) {
    fail(
      'invalid_response',
      'The temporary instruction response exceeds its bounds or has an invalid shape.',
    );
  }
  const result = checked.data;
  if (
    result.scope !== parsed.data.scope ||
    !unique(result.entries.map((e) => e.id)) ||
    result.entries.some(
      (e) =>
        e.openTaskIds.some((id) => !e.taskIds.includes(id)) ||
        e.effective !== (e.state === 'active' && e.openTaskIds.length > 0),
    ) ||
    (preview &&
      (!sameSelection(result.selection, parsed.data.selection) ||
        result.replaces.some((id) => !result.entries.some((e) => e.id === id))))
  ) {
    fail(
      'invalid_response',
      'The temporary instruction response does not match the requested scope, selection or replacement evidence.',
    );
  }
  return result;
}
/** One explicit metered read; no polling, mutation, pagination or local cache. */
export const readIntents = (client, input) => request(client, input, false);
export const previewIntent = (client, input) => request(client, input, true);
