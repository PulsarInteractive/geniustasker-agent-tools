import * as z from 'zod/v4';
import catalog from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const scopedStorageTools = new Map(
  catalog
    .filter((t) =>
      /^(tasker_(project|memory|personal)_(storage_resources|cleanup_(preview|status|apply)))$/.test(
        t.name,
      ),
    )
    .map((tool) => [tool.name, { tool, schema: z.fromJSONSchema(tool.inputSchema) }]),
);
export const scopedStorageCommands = {
  'storage resources': 'storage_resources',
  'storage cleanup-preview': 'cleanup_preview',
  'storage cleanup-status': 'cleanup_status',
  'storage cleanup-apply': 'cleanup_apply',
};

export function scopedStorageToolFor(command, input) {
  const domain = typeof input?.scope === 'string' ? input.scope.split(':', 1)[0] : null;
  return 'tasker_' + domain + '_' + scopedStorageCommands[command];
}

const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const key = z.string().min(1).max(160);
const cleanupResult = z.object({
  scope: key,
  operationId: key,
  mode: z.enum(['light', 'deep']),
  state: z.enum(['preview', 'running', 'complete']),
  estimatedBytes: bytes,
  recoveredBytes: bytes,
  items: z
    .array(
      z.object({
        assetId: key,
        name: z.string(),
        state: z.enum(['ready', 'removed', 'excluded']),
        reason: z.string().nullable(),
        estimatedBytes: bytes,
        recoveredBytes: bytes,
      }),
    )
    .min(1)
    .max(16),
});
const resourcePage = z.object({
  scope: key,
  items: z
    .array(
      z.object({
        scope: key,
        assetId: key,
        name: z.string(),
        mime: z.string(),
        category: z.string(),
        state: z.string(),
        revision: key,
        chargedBytes: bytes,
        reclaimableBytes: bytes,
        sharedBytes: bytes,
        protectedBytes: bytes,
        issuedAt: bytes,
        reason: z.string().nullable(),
      }),
    )
    .max(25),
  coverage: z.string(),
  nextCursor: z.string().max(2048).nullable(),
});

function checkOperation(result, { scope, operationId, mode, assetIds }) {
  const parsed = cleanupResult.safeParse(result);
  if (
    !parsed.success ||
    result.scope !== scope ||
    (operationId !== undefined && operationId !== result.operationId) ||
    (mode !== undefined && mode !== result.mode)
  ) {
    fail(
      'invalid_response',
      'The cleanup receipt did not match this operation in the selected space.',
    );
  }
  const ids = new Set(result.items.map((item) => item.assetId));
  if (
    ids.size !== result.items.length ||
    (assetIds !== undefined &&
      (ids.size !== assetIds.length || assetIds.some((id) => !ids.has(id))))
  ) {
    fail('invalid_response', 'The files in the cleanup receipt did not match the selection.');
  }
  return parsed.data;
}

/** Shared behavior for CLI, stdio MCP and the hosted connector; send receives only allowlisted routes. */
export async function scopedStorageRequest(name, input, send) {
  const entry = scopedStorageTools.get(name);
  const parsed = entry?.schema.safeParse(input);
  if (!parsed?.success) {
    fail(
      'invalid_arguments',
      'Choose an authorized project, Memory or your personal space and supply the exact fields for this operation.',
    );
  }
  const { tool } = entry,
    data = parsed.data;
  if (data.assetIds && new Set(data.assetIds).size !== data.assetIds.length) {
    fail('invalid_arguments', 'Choose each file only once.');
  }
  if (tool.route === 'storage/resources') {
    const response = await send('GET', tool.route, data);
    const page = resourcePage.safeParse(response);
    if (
      !page.success ||
      response.scope !== data.scope ||
      response.items.length > (data.limit ?? 25) ||
      response.items.some((item) => item.scope !== data.scope)
    ) {
      fail('invalid_response', 'The resource page did not match the selected space or page size.');
    }
    return page.data;
  }
  if (tool.route === 'storage/cleanup/apply') {
    const id = { scope: data.scope, operationId: data.operationId };
    const latest = checkOperation(await send('GET', 'storage/cleanup/status', id), id);
    const result = await send('POST', tool.route, data);
    return checkOperation(result, {
      ...id,
      mode: latest.mode,
      assetIds: latest.items.map((i) => i.assetId),
    });
  }
  return checkOperation(await send(tool.method ?? 'GET', tool.route, data), data);
}

export function clientStorageRequest(client, name, input) {
  return scopedStorageRequest(name, input, async (method, route, data) =>
    method === 'GET'
      ? client.get(route, data)
      : client.transport.request('/api/agents/v1/' + route, {
          method,
          json: data,
          token: await client.accessToken(),
        }),
  );
}
