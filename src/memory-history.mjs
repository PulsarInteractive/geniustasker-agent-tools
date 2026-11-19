import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const memoryHistoryTools = new Map(
  ['history', 'diff', 'restore'].map((key) => {
    const tool = tools.find((entry) => entry.name === 'tasker_memory_' + key);
    return [key, { tool, schema: z.fromJSONSchema(tool.inputSchema) }];
  }),
);

export async function memoryHistoryRequest(client, key, input) {
  const entry = memoryHistoryTools.get(key);
  const parsed = entry?.schema.safeParse(input);
  if (!parsed?.success) {
    fail('invalid_arguments', 'Use the documented note and revision selectors.');
  }
  const request = parsed.data;
  let result;
  if (key === 'restore') {
    const token = await client.accessToken();
    client.invalidateReads();
    result = await client.transport.request('/api/agents/v1/memory/restore', {
      method: 'POST',
      token,
      json: request,
    });
  } else {
    result = await client.get(entry.tool.route, request);
  }
  if (
    result?.pageId !== request.pageId ||
    (key === 'history' && (result.scope !== request.scope || !Array.isArray(result.items))) ||
    (key === 'diff' &&
      (result.fromRevision !== request.fromRevision ||
        (request.toRevision && result.toRevision !== request.toRevision) ||
        !Array.isArray(result.blocks) ||
        !Array.isArray(result.fields))) ||
    (key === 'restore' &&
      (typeof result.revision !== 'string' || result.revision === request.expectedRevision))
  ) {
    fail('invalid_response', 'The history response did not match the page or revisions requested.');
  }
  return result;
}
