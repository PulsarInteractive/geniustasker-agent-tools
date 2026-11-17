import * as z from 'zod/v4';
import contract from './feedback-contract.mjs';
import { fail } from './errors.mjs';

const schema = (name) =>
  z.fromJSONSchema({
    $ref: '#/$defs/GeniusTasker.Feedback.Feedback' + name,
    $defs: contract.definitions,
  });
const uuid = z.string().uuid();
const check = (validator, value) => {
  const parsed = validator.safeParse(value);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'Use the feedback schema, current account epoch and exact request revision.',
    );
  }
  return parsed.data;
};

export const feedbackCreateSchema = schema('Create');
export const feedbackDraftSchema = feedbackCreateSchema
  .omit({ commandId: true, issuedAt: true, draftId: true, expectedEpoch: true })
  .extend({ draftId: uuid.optional(), expectedEpoch: z.string().min(1).max(128).optional() })
  .strict();
export const feedbackReadSchema = z.object({ id: uuid }).strict();
export const feedbackPageSchema = z
  .object({
    status: schema('Status').optional(),
    type: schema('Type').optional(),
    after: z.string().max(2048).optional(),
  })
  .strict();
export const feedbackUploadSchema = schema('Upload');
export const feedbackMarkReadSchema = z.object({ id: uuid, request: schema('MarkRead') }).strict();
const capabilitiesSchema = schema('Capabilities');
const receiptSchema = schema('Receipt');
const detailSchema = schema('Detail');
const pageSchema = schema('Page');
const mediaSessionSchema = schema('MediaSession');

export function prepareFeedbackCommand(draft) {
  const value = check(feedbackDraftSchema, draft);
  return {
    applied: false,
    command: validateFeedbackCreate({
      ...value,
      commandId: crypto.randomUUID(),
      issuedAt: Date.now(),
      draftId: value.draftId ?? crypto.randomUUID(),
    }),
  };
}
export function validateFeedbackCreate(input) {
  const value = check(feedbackCreateSchema, input);
  if (!value.title.trim() || !value.description.trim()) {
    fail(
      'invalid_arguments',
      'Describe the observed problem or requested improvement before sending.',
    );
  }
  return value;
}
export function validateFeedbackUpload(input) {
  return check(feedbackUploadSchema, input);
}
export function validFeedbackReceipt(result, input) {
  return (
    receiptSchema.safeParse(result).success &&
    uuid.safeParse(result.id).success &&
    result.commandId === input.commandId &&
    (result.duplicate || result.id === input.draftId)
  );
}
export function validFeedbackDetail(result, id) {
  return detailSchema.safeParse(result).success && result.summary.id === id;
}
export function validFeedbackMediaSession(result, input) {
  const path = `/api/agents/v1/feedback/media/${input.id}/content`;
  return (
    mediaSessionSchema.safeParse(result).success &&
    result.assetId === input.id &&
    result.draftId === input.draftId &&
    result.uploadPath === path &&
    (result.state === 'pending'
      ? result.image === null
      : result.image?.assetId === input.id &&
        result.image.readPath === path &&
        result.image.contentType === 'image/webp' &&
        result.image.size > 0 &&
        result.image.size <= 1_000_000 &&
        result.image.width > 0 &&
        result.image.width <= 1080 &&
        result.image.height > 0 &&
        result.image.height <= 1080)
  );
}
export async function readFeedbackCapabilities(client) {
  const result = await client.feedbackRead('capabilities');
  if (!capabilitiesSchema.safeParse(result).success) {
    fail('invalid_response', 'Invalid feedback capabilities.');
  }
  // Tracking never enables a conversation, even if a server advertises one.
  return { ...result, canReply: false };
}
export async function readFeedbackPage(client, input) {
  const query = check(feedbackPageSchema, input);
  const result = await client.feedbackRead('', query);
  if (
    !pageSchema.safeParse(result).success ||
    result.entries.length > 50 ||
    new Set(result.entries.map((entry) => entry.id)).size !== result.entries.length
  ) {
    fail('invalid_response', 'Invalid feedback page.');
  }
  return result;
}
export async function readFeedbackDetail(client, input) {
  const { id } = check(feedbackReadSchema, input);
  const result = await client.feedbackRead(`detail/${id}`);
  if (!validFeedbackDetail(result, id)) {
    fail('invalid_response', 'Invalid feedback detail.');
  }
  return result;
}
export async function readFeedbackReceipt(client, input) {
  const { id } = check(feedbackReadSchema, input);
  const result = await client.feedbackRead(`receipts/${id}`);
  if (!receiptSchema.safeParse(result).success || result.commandId !== id) {
    fail('invalid_response', 'The receipt does not match the submitted command.');
  }
  return result;
}

export async function markFeedbackRead(client, input) {
  const { id, request } = check(feedbackMarkReadSchema, input);
  await client.transport.request(`/api/agents/v1/feedback/${id}/read`, {
    method: 'POST',
    token: await client.accessToken(),
    json: request,
  });
  return { id, revision: request.revision, read: true };
}
export async function removeFeedbackImage(client, input) {
  const { id } = check(feedbackReadSchema, input);
  await client.transport.request(`/api/agents/v1/feedback/media/${id}`, {
    method: 'DELETE',
    token: await client.accessToken(),
  });
  return { id, removed: true };
}
