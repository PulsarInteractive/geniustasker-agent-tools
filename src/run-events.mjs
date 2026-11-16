import * as z from 'zod/v4';
import schemas from './command-input-schemas.mjs';
import { CommandJournal, commandSchema, operationIdSchema, validateCommand } from './commands.mjs';
import { fail } from './errors.mjs';

const claim = schemas['run.claim'].properties;
const report = schemas['run.checkpoint'].properties;
const evidence = report.evidence.items.properties;
const meaningful = (max) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !!value.trim());
const lease = z.number().int().min(report.leaseSeconds.minimum).max(report.leaseSeconds.maximum);
const base = {
  eventId: operationIdSchema,
  occurredAt: commandSchema.shape.issuedAt,
  scope: commandSchema.shape.scope.refine((value) => value.startsWith('project:')),
  epoch: commandSchema.shape.epoch,
  runId: operationIdSchema,
  summary: meaningful(report.summary.maxLength),
};
const links = z
  .array(
    z
      .object({
        label: meaningful(evidence.label.maxLength),
        url: meaningful(evidence.url.maxLength).refine((value) => {
          try {
            const url = new URL(value);
            return (
              url.protocol === 'https:' &&
              !!url.hostname &&
              !url.username &&
              !url.password &&
              !/\s/.test(value)
            );
          } catch {
            return false;
          }
        }),
      })
      .strict(),
  )
  .max(report.evidence.maxItems);
const details = {
  expectedRevision: commandSchema.shape.expectedRevision.unwrap(),
  nextSteps: z.string().max(report.nextSteps.maxLength).optional(),
  evidence: links.optional(),
};

/** An opt-in host event, not a terminal/process observer. Unknown fields are
 * refused, so arguments, environment, raw logs and arbitrary patches cannot
 * accidentally be forwarded through a generic host event object. */
export const runEventSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        ...base,
        type: z.literal('started'),
        expectedRevision: z.null(),
        task: meaningful(claim.task.maxLength),
        taskRevision: commandSchema.shape.expectedRevision.unwrap(),
        leaseSeconds: lease.optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        ...details,
        type: z.enum(['checkpoint', 'waiting', 'review', 'process_exited']),
        leaseSeconds: lease.optional(),
      })
      .strict(),
    z.object({ ...base, ...details, type: z.enum(['finished', 'failed', 'cancelled']) }).strict(),
  ])
  .superRefine((value, context) => {
    if (['waiting', 'review', 'process_exited'].includes(value.type) && !value.nextSteps?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['nextSteps'],
        message: 'Waiting and review need an explicit next step.',
      });
    }
  });
export const runEventToolSchema = z
  .object({ event: runEventSchema, prepareOnly: z.boolean().optional() })
  .strict();

export function runEventCommand(value) {
  const parsed = runEventSchema.safeParse(value);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use a documented host event with stable eventId/occurredAt, current run revision and a bounded factual summary. Waiting/review need nextSteps; do not include process arguments, environment or logs.',
    );
  }
  const event = parsed.data;
  const state = {
    checkpoint: 'Working',
    waiting: 'Waiting',
    review: 'NeedsReview',
    process_exited: 'NeedsReview',
    finished: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }[event.type];
  const kind =
    event.type === 'started'
      ? 'run.claim'
      : ['finished', 'failed', 'cancelled'].includes(event.type)
        ? 'run.finish'
        : 'run.checkpoint';
  const data =
    event.type === 'started'
      ? { task: event.task, taskRevision: event.taskRevision, summary: event.summary }
      : {
          state,
          summary: event.summary,
          ...(event.nextSteps !== undefined ? { nextSteps: event.nextSteps } : {}),
          ...(event.evidence !== undefined ? { evidence: event.evidence } : {}),
        };
  if (event.leaseSeconds !== undefined) {
    data.leaseSeconds = event.leaseSeconds;
  }
  return validateCommand({
    operationId: event.eventId,
    issuedAt: event.occurredAt,
    scope: event.scope,
    epoch: event.epoch,
    id: event.runId,
    expectedRevision: event.expectedRevision,
    kind,
    data,
  });
}

/** Exactly one explicit invocation. No reads/rebase/retry loop or subprocess. */
export async function reportRunEvent(client, value, { prepareOnly = false } = {}) {
  const command = runEventCommand(value),
    journal = new CommandJournal(client);
  const result = await (prepareOnly ? journal.prepareExact(command) : journal.execute(command));
  return { eventId: command.operationId, kind: command.kind, ...result };
}
