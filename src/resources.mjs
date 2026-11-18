import * as z from 'zod/v4';
import { fail } from './errors.mjs';
import { validTaskAvailabilityPage } from './task-availability.mjs';

export const taskStateSchema = z
  .enum(['v1', 'v2'])
  .describe(
    'Explicit task-only opt-in after discovery: choose v2 when capabilities.collections[id=tasks].taskStateVersions includes v2, otherwise v1 only when taskState advertises v1. Omit on older deployments. A missing snapshot never means available; v1 omits snapshots for Paused tasks.',
  );

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
    taskId: z.string().min(1).max(128).optional(),
    metricId: z
      .string()
      .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
      .optional(),
    path: z.string().min(1).max(512).optional(),
    archive: z.enum(['active', 'archived', 'all']).optional(),
    taskState: taskStateSchema.optional(),
  })
  .strict();
export const projectMetricCollections = [
  'metrics',
  'metricObservations',
  'metricCorrections',
  'metricGoals',
];
export const personalMetricCollections = [
  'personalMetrics',
  'personalMetricObservations',
  'personalMetricCorrections',
  'personalMetricGoals',
];
export const metricCollections = [...projectMetricCollections, ...personalMetricCollections];
export const metricHistoryCollections = [
  'metricObservations',
  'metricCorrections',
  'personalMetricObservations',
  'personalMetricCorrections',
];
export const metricReadSchema = resourceReadSchema
  .omit({ path: true, taskState: true, taskId: true })
  .extend({
    collection: z.enum(metricCollections),
  })
  .strict();

/** Personal access is an explicit metric surface, never a generic account read.
 * Current owner, grant and project rights are always checked by the server. */
export function validateResourceScope({ scope, collection, metricId, taskState, taskId }) {
  if (taskId !== undefined && !['checklist', 'documents'].includes(collection)) {
    fail('invalid_arguments', 'Use taskId with checklist items or task documents.');
  }
  if (taskState !== undefined && collection !== 'tasks') {
    fail('invalid_arguments', 'taskState is available only for the tasks collection.');
  }
  if (
    (scope.startsWith('personal:') && !personalMetricCollections.includes(collection)) ||
    (personalMetricCollections.includes(collection) && !scope.startsWith('personal:')) ||
    (projectMetricCollections.includes(collection) && !scope.startsWith('project:'))
  ) {
    fail(
      'invalid_arguments',
      'Use metric definitions, observations, corrections or linked goals in their matching project or connected personal scope. Other personal collections are not exposed.',
    );
  }
  if (metricId !== undefined && !metricHistoryCollections.includes(collection)) {
    fail(
      'invalid_arguments',
      'metricId filters observations or correction snapshots only; use id for an exact definition or goal.',
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
  if (requested.collection === 'checklist' && !requested.taskId && !requested.id) {
    fail('invalid_arguments', 'Read a checklist with its taskId or one exact item id.');
  }
  if (requested.after && (!requested.epoch || !requested.checkpoint)) {
    fail(
      'invalid_arguments',
      'Continuation requires the unchanged epoch and checkpoint returned with the first page.',
    );
  }
  const result = await client.get('resources', requested);
  if (!validTaskAvailabilityPage(result, requested.collection, requested.taskState)) {
    client.invalidateReads?.();
    fail('invalid_response', 'The task availability snapshot was invalid; read the task again.');
  }
  return result;
}
export async function readMetrics(client, input) {
  const parsed = metricReadSchema.safeParse(input);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Read a declared metric definition, observation, correction or linked-goal collection with the matching scope and bounded continuation.',
    );
  }
  return readResources(client, parsed.data);
}
