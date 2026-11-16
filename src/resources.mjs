import * as z from 'zod/v4';
import { fail } from './errors.mjs';

export const resourceScopeSchema = z
  .string()
  .max(256)
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
  .regex(/^(project|memory|personal):[^\u0000-\u001f]+$/u);
export const resourceReadSchema = z
  .object({
    scope: resourceScopeSchema,
    collection: z.string().min(1).max(32),
    after: z.string().max(4096).optional(),
    epoch: z.string().max(4096).optional(),
    checkpoint: z.string().max(4096).optional(),
    id: z.string().min(1).max(128).optional(),
    path: z.string().min(1).max(512).optional(),
    archive: z.enum(['active', 'archived', 'all']).optional(),
  })
  .strict();
export const metricReadSchema = resourceReadSchema
  .omit({ path: true })
  .extend({
    collection: z.enum(['metrics', 'personalMetrics']),
  })
  .strict();

/** Personal access is an explicit metric surface, never a generic account read.
 * Current owner, grant and project rights are always checked by the server. */
export function validateResourceScope({ scope, collection }) {
  if (
    (scope.startsWith('personal:') && collection !== 'personalMetrics') ||
    (collection === 'personalMetrics' && !scope.startsWith('personal:')) ||
    (collection === 'metrics' && !scope.startsWith('project:'))
  ) {
    fail(
      'invalid_arguments',
      'Use project:<id> with metrics, or personal:<connected-owner> with personalMetrics. Other personal collections are not exposed.',
    );
  }
}
export async function readResources(client, input) {
  const parsed = resourceReadSchema.safeParse(input);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use a valid scope and collection with the returned epoch/checkpoint for continuation.',
    );
  }
  const requested = parsed.data;
  validateResourceScope(requested);
  if (requested.after && (!requested.epoch || !requested.checkpoint)) {
    fail(
      'invalid_arguments',
      'Continuation requires the unchanged epoch and checkpoint returned with the first page.',
    );
  }
  return client.get('resources', requested);
}
export async function readMetrics(client, input) {
  const parsed = metricReadSchema.safeParse(input);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Read metrics or personalMetrics with the matching scope and bounded continuation.',
    );
  }
  return readResources(client, parsed.data);
}
