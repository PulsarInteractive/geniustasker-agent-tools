import * as z from 'zod/v4';
import catalog from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

const commands = {
  'guides components': 'tasker_guide_components',
  'design grid': 'tasker_design_grid',
  'design save-mockup': 'tasker_design_save_mockup',
  'design save-implementation': 'tasker_design_save_implementation',
  'design publish-version': 'tasker_design_publish_version',
  'design targets': 'tasker_design_targets',
  'design target': 'tasker_design_target',
  'design mockups': 'tasker_design_mockups',
  'design implementations': 'tasker_design_implementations',
  'design review': 'tasker_design_grid_decisions',
};
export const spaceCommands = new Map(
  Object.entries(commands).map(([command, name]) => {
    const tool = catalog.find((item) => item.name === name);
    return [command, { tool, schema: z.fromJSONSchema(tool.inputSchema) }];
  }),
);
const invalid = () =>
  fail('invalid_response', 'The response did not match the selected records.', { status: 502 });
const scopePattern = /^memory:[a-zA-Z0-9_-]{1,128}$/;
const baseId = /^[a-zA-Z0-9_-]{1,128}$/;
const blockId = /^[a-zA-Z0-9_-]{1,80}$/;
const revision = /^[0-9]{1,16}$/;
const unique = (ids) => new Set(ids).size === ids.length;
const imageKey = (item) => JSON.stringify([item.variantId, item.blockId]);

const linked = z.discriminatedUnion('status', [
  z.object({ blockId: z.string().regex(blockId), status: z.literal('unavailable') }).strict(),
  z
    .object({
      blockId: z.string().regex(blockId),
      status: z.literal('available'),
      kind: z.enum(['guide', 'design', 'skill', 'task']),
      scope: z.string().regex(/^(?:project|memory):[a-zA-Z0-9_-]{1,128}$/),
      targetId: z.string().regex(baseId),
      presentation: z.enum(['link', 'card', 'status', 'checklist', 'gallery']),
      designView: z
        .object({
          range: z.enum(['selection', 'descendants']),
          publishedRevision: z.string().regex(revision).nullish(),
          track: z.enum(['mockup', 'implemented']).nullish(),
          platform: z.string().max(60).nullish(),
          width: z.number().int().min(1).max(32768).nullish(),
          height: z.number().int().min(1).max(32768).nullish(),
        })
        .strict()
        .nullish(),
      images: z
        .array(
          z
            .object({
              variantId: z.string().regex(baseId),
              blockId: z.string().regex(blockId),
              revision: z.string().regex(revision),
              title: z.string().max(100),
              mediaKind: z.enum(['image', 'audio', 'video']).nullish(),
              posterBlockId: z.string().regex(blockId).nullish(),
              track: z.enum(['mockup', 'implemented']),
            })
            .strict(),
        )
        .max(4)
        .nullish(),
      hasMoreImages: z.boolean().nullish(),
      publicationLabel: z.string().max(80).nullish(),
      title: z.string(),
      targetStamp: z.string().nullish(),
      revision: z.string().regex(revision),
      taskStatus: z.string().nullish(),
      checklistCount: z.number().int().nonnegative().nullish(),
      checklistDoneCount: z.number().int().nonnegative().nullish(),
      useWhen: z.string().nullish(),
      headerAssetId: z.string().nullish(),
      headerAlt: z.string().nullish(),
    })
    .strict(),
]);

const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
function validGalleryRevision(input, item) {
  const published = item.designView?.publishedRevision;
  if (!published) {
    return !input.publishedRevision && !item.publicationLabel;
  }
  const images = item.images;
  return (
    item.designView.range === 'selection' &&
    (!input.publishedRevision || input.publishedRevision === published) &&
    item.revision === published &&
    typeof item.publicationLabel === 'string' &&
    item.publicationLabel.trim().length > 0 &&
    Array.isArray(images) &&
    unique(images.map((image) => image.blockId)) &&
    images.every(
      (image) =>
        image.variantId === item.targetId &&
        image.revision === published &&
        image.blockId !== input.afterImage &&
        (!input.focusImage || image.blockId === input.focusImage),
    )
  );
}

function validateGuide(input, result) {
  if (
    result?.scope !== input.scope ||
    result.pageId !== input.pageId ||
    !matches(revision, result.revision) ||
    (result.sourceStamp !== undefined &&
      result.sourceStamp !== null &&
      typeof result.sourceStamp !== 'string') ||
    !Array.isArray(result.items) ||
    result.items.length !== input.blockIds.length ||
    Buffer.byteLength(JSON.stringify(result)) > 32768
  ) {
    invalid();
  }
  const selected = new Set(input.blockIds);
  if (
    !result.items.every(
      (item) =>
        linked.safeParse(item).success &&
        selected.delete(item.blockId) &&
        (item.status !== 'available' ||
          (item.presentation === 'gallery'
            ? item.kind === 'design' && validGalleryRevision(input, item)
            : [item.images, item.hasMoreImages, item.designView, item.publicationLabel].every(
                (field) => field === null || field === undefined,
              ))),
    )
  ) {
    invalid();
  }
  return {
    scope: input.scope,
    pageId: input.pageId,
    revision: result.revision,
    ...(result.sourceStamp === undefined ? {} : { sourceStamp: result.sourceStamp }),
    items: result.items,
  };
}

function validateGrid(input, result) {
  if (
    result?.scope !== input.scope ||
    !Array.isArray(result.items) ||
    result.items.length > 16 ||
    ((input.includeTotals !== false || result.counts !== undefined) &&
      !['media', 'approved', 'unchecked', 'rejected'].every(
        (k) => Number.isSafeInteger(result.counts?.[k]) && result.counts[k] >= 0,
      )) ||
    (result.nextCursor !== null &&
      (typeof result.nextCursor !== 'string' ||
        !result.nextCursor.length ||
        result.nextCursor === input.cursor)) ||
    !result.items.every(
      (item) =>
        matches(baseId, item?.variantId) &&
        matches(blockId, item?.blockId) &&
        matches(revision, item?.revision) &&
        Array.isArray(item.cells) &&
        item.cells.length <= 64,
    ) ||
    !unique(result.items.map(imageKey))
  ) {
    invalid();
  }
  return result;
}

function validateReceipts(input, result) {
  const pending = new Set(input.targets.map(imageKey));
  if (
    !Array.isArray(result?.items) ||
    result.items.length !== pending.size ||
    !result.items.every(
      (item) =>
        pending.delete(imageKey(item)) &&
        ((typeof item.error === 'string' && item.error.length > 0) ||
          (item.error === null &&
            typeof item.decisionId === 'string' &&
            item.decisionId.length > 0)),
    )
  ) {
    invalid();
  }
  return result;
}

export async function spaceRequest(client, command, value) {
  const { tool, schema } = spaceCommands.get(command);
  const parsed = schema.safeParse(value);
  if (!parsed.success || !scopePattern.test(parsed.data.scope)) {
    fail('invalid_arguments', tool.description);
  }
  const input = parsed.data;
  if (
    command === 'guides components' &&
    (!unique(input.blockIds) ||
      !input.blockIds.every((id) => matches(blockId, id)) ||
      ((input.afterImage || input.focusImage) && !input.publishedRevision) ||
      (input.focusImage && input.afterImage) ||
      (input.publishedRevision && input.blockIds.length !== 1))
  ) {
    fail(
      'invalid_arguments',
      'Select each component block once, using its ID from the page outline.',
    );
  }
  if (
    command === 'design review' &&
    (!unique(input.targets.map(imageKey)) ||
      !Number.isSafeInteger(input.issuedAt) ||
      input.issuedAt < 1 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.operationId,
      ))
  ) {
    fail(
      'invalid_arguments',
      'Supply a stable operation UUID, its issue time and distinct image blocks.',
    );
  }
  const result =
    tool.method === 'POST'
      ? await client.transport.request('/api/agents/v1/' + tool.route, {
          method: 'POST',
          json: input,
          token: await client.accessToken(),
        })
      : await client.get(tool.route, input);
  if (command === 'design save-mockup' || command === 'design save-implementation') {
    const track = command === 'design save-mockup' ? 'mockup' : 'implemented';
    const receipt = z
      .object({
        scope: z.literal(input.scope),
        variantId: z.literal(input.variantId),
        operationId: z.literal(input.operationId),
        blockId: z.literal(input.capture.blockId),
        track: z.literal(track),
        revision: z.string().regex(/^[1-9][0-9]{0,15}$/),
      })
      .strict();
    if (!receipt.safeParse(result).success) {
      invalid();
    }
    return result;
  }
  if (command === 'guides components') {
    return validateGuide(input, result);
  }
  if (command === 'design publish-version') {
    const receipt = z
      .object({
        variantId: z.literal(input.variantId),
        publishedRevision: z.literal(input.expectedRevision),
        currentRevision: z.string().regex(revision),
        label: z.literal(input.label.trim()),
        operationId: z.literal(input.operationId),
      })
      .strict();
    if (!receipt.safeParse(result).success) {
      invalid();
    }
    return result;
  }
  if (command === 'design targets') {
    const pointer = z
      .object({ variantId: z.string().regex(baseId), revision: z.string().regex(revision) })
      .strict();
    const evidence = z
      .object({
        expected: z.enum(['required', 'deferred', 'not-applicable']),
        presence: z.enum(['available', 'missing', 'unknown']),
        example: pointer.nullable(),
      })
      .strict()
      .refine(
        (v) =>
          (v.presence === 'available') === (v.example !== null) &&
          (!input.presence || v.presence === input.presence) &&
          (!input.expected || v.expected === input.expected),
      );
    const queue = z
      .object({
        scope: z.literal(input.scope),
        track: z.literal(input.track),
        epoch: z.string().min(1).max(128),
        checkpoint: z.string().regex(revision),
        items: z
          .array(
            z
              .object({
                pageId: z.string().regex(baseId),
                title: z.string(),
                revision: z.string().regex(revision),
                evidence,
              })
              .strict(),
          )
          .max(12),
        nextCursor: z
          .string()
          .regex(/^[a-f0-9]{64}\.[a-zA-Z0-9_-]{1,128}$/)
          .nullable(),
      })
      .strict();
    if (
      !queue.safeParse(result).success ||
      !unique(result.items.map((row) => row.pageId)) ||
      (result.nextCursor !== null && result.nextCursor === input.cursor)
    ) {
      invalid();
    }
    return result;
  }
  if (command === 'design target') {
    if (
      result?.scope !== input.scope ||
      result.pageId !== input.pageId ||
      !matches(revision, result.revision)
    ) {
      invalid();
    }
    for (const track of ['mockup', 'implemented']) {
      const evidence = result[track];
      if (
        !['required', 'deferred', 'not-applicable'].includes(evidence?.expected) ||
        evidence.expected !== result.expectation?.[track] ||
        !['available', 'missing', 'unknown'].includes(evidence.presence)
      ) {
        invalid();
      }
      if (
        evidence.presence === 'available'
          ? !matches(baseId, evidence.example?.variantId) ||
            !matches(revision, evidence.example?.revision)
          : evidence.example !== null
      ) {
        invalid();
      }
    }
    return result;
  }
  if (command === 'design mockups' || command === 'design implementations') {
    validateGrid({ ...input, includeTotals: false }, result);
    const track = command === 'design mockups' ? 'mockup' : 'implemented';
    if (result.items.some((item) => item.track !== track)) {
      invalid();
    }
    return result;
  }
  if (command === 'design grid') {
    return validateGrid(input, result);
  }
  return validateReceipts(input, result);
}
