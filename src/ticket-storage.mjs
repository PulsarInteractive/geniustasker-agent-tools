import * as z from 'zod/v4';
import catalog from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const ticketStorageTools = new Map(
  catalog
    .filter(
      (tool) =>
        /^tasker_(storage|attachment)_/.test(tool.name) && tool.route?.startsWith('storage/'),
    )
    .map((tool) => [
      tool.name.slice('tasker_'.length).replace('_', ' '),
      { tool, schema: z.fromJSONSchema(tool.inputSchema) },
    ]),
);

export async function ticketStorageRequest(client, command, input) {
  const entry = ticketStorageTools.get(command);
  const parsed = entry?.schema.safeParse(input);
  if (!parsed?.success) {
    fail(
      'invalid_arguments',
      'Supply one project and the exact fields for this storage operation.',
    );
  }
  const { tool } = entry,
    data = parsed.data;
  if (!/^project:[A-Za-z0-9_-]{1,128}$/.test(data.scope)) {
    fail('invalid_arguments', 'A selected project scope is required.');
  }
  if (
    command === 'storage selection' &&
    ((data.taskIds === undefined) === (data.attachmentIds === undefined) ||
      (data.taskIds ?? data.attachmentIds).length !== 1)
  ) {
    fail('invalid_arguments', 'Estimate exactly one task or attachment.');
  }
  if (
    tool.write &&
    (data.action === 'remove' ? data.assetId !== undefined : data.assetId === undefined)
  ) {
    fail(
      'invalid_arguments',
      'Add or replace needs a published asset. Removal needs the existing attachment ID only.',
    );
  }
  const result =
    tool.method === 'POST'
      ? await client.transport.request('/api/agents/v1/' + tool.route, {
          method: 'POST',
          json: data,
          token: await client.accessToken(),
        })
      : await client.get(tool.route, data);
  if (
    tool.write &&
    (result?.operationId !== data.operationId ||
      result.attachmentId !== data.attachmentId ||
      typeof result.revision !== 'string' ||
      !Number.isSafeInteger(result.releasedBytes) ||
      result.releasedBytes < 0 ||
      typeof result.pendingRelease !== 'boolean')
  ) {
    fail('invalid_response', 'The server receipt did not match the selected attachment operation.');
  }
  return result;
}
