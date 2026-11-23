import * as z from 'zod/v4';
import catalog from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

const commands = {
  'guides components': 'tasker_guide_components',
  'design grid': 'tasker_design_grid',
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
      presentation: z.enum(['link', 'card', 'status', 'checklist']),
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
    !result.items.every((item) => linked.safeParse(item).success && selected.delete(item.blockId))
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
    (!unique(input.blockIds) || !input.blockIds.every((id) => matches(blockId, id)))
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
  if (command === 'guides components') {
    return validateGuide(input, result);
  }
  if (command === 'design grid') {
    return validateGrid(input, result);
  }
  return validateReceipts(input, result);
}
