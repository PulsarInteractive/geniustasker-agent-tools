import * as z from 'zod/v4';
import { fail } from './errors.mjs';

const uuid = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const scope = z
  .string()
  .max(128)
  .regex(/^project:[A-Za-z0-9_-]+$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const primitive = z.union([
  z.string().max(2000),
  z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  z.boolean(),
]);
export const protocolPreviewSchema = z
  .object({
    scope,
    protocolVersionId: uuid,
    bindings: z
      .object({
        instanceId: uuid,
        scope,
        epoch: z.string().min(1).max(128),
        anchor: z
          .string()
          .max(35)
          .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/),
        values: z
          .record(z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/), primitive)
          .refine((value) => Object.keys(value).length <= 24),
      })
      .strict(),
    after: z.number().int().min(0).max(199).optional(),
    digest: digest.optional(),
  })
  .strict()
  .refine((value) => value.scope === value.bindings.scope, {
    message: 'The binding must use the requested scope.',
  })
  .refine((value) => !(value.after > 0) || !!value.digest, {
    message: 'Continuation needs the original digest.',
  });

const delivery = z.object({
  push: z.enum(['inherit', 'silent', 'request']),
  recap: z.boolean(),
  animation: z.enum(['inherit', 'silent', 'request']),
});
const step = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/),
  id: uuid,
  title: z.string().min(3).max(200),
  description: z.string().max(600),
  kind: z.enum(['Epic', 'Ticket', 'Subtask']),
  parent: uuid.nullable(),
  dependencies: z.array(uuid).max(20),
  owner: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  dueDate: z.string().max(35).nullable(),
  estimateDays: z.number().min(0.1).max(60).nullable().optional(),
  importance: z.enum(['Minor', 'Normal', 'Important', 'Critical']),
  importanceReason: z.string().max(400),
  delivery,
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(10),
});
const resultSchema = z.object({
  protocolVersionId: uuid,
  instanceId: uuid,
  epoch: z.string().min(1).max(128),
  digest,
  total: z.number().int().min(1).max(200),
  batchSize: z.literal(20),
  steps: z.array(step).max(20),
  nextAfter: z.number().int().min(1).max(199).nullable(),
});

/** One metered read, despite POST carrying its structured bindings. No command
 * journal, response cache, implicit pagination, retries or task creation. */
export async function previewProtocol(client, input) {
  const checked = protocolPreviewSchema.safeParse(input);
  if (!checked.success) {
    fail(
      'invalid_arguments',
      'Use a published protocol version, matching project bindings and the original digest for continuation.',
    );
  }
  const request = checked.data;
  const token = await client.accessToken();
  const response = await client.transport.request('/api/agents/v1/protocols/preview', {
    method: 'POST',
    json: request,
    token,
  });
  const parsed = resultSchema.safeParse(response);
  if (!parsed.success) {
    fail(
      'invalid_response',
      'The protocol preview response is invalid or exceeds its page bounds.',
    );
  }
  const result = parsed.data,
    after = request.after ?? 0,
    end = after + result.steps.length;
  if (
    result.protocolVersionId !== request.protocolVersionId ||
    result.instanceId !== request.bindings.instanceId ||
    result.epoch !== request.bindings.epoch ||
    (request.digest && result.digest !== request.digest) ||
    after >= result.total ||
    end > result.total ||
    result.steps.length === 0 ||
    result.nextAfter !== (end < result.total ? end : null) ||
    new Set(result.steps.map((value) => value.id)).size !== result.steps.length ||
    new Set(result.steps.map((value) => value.key)).size !== result.steps.length
  ) {
    fail(
      'invalid_response',
      'The protocol preview does not match the requested identity, digest or page.',
    );
  }
  return result;
}
