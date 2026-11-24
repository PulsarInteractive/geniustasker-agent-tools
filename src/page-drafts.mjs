import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const pageDraftTools = new Map(
  ['draft', 'drafts', 'edit_draft'].map((key) => {
    const tool = tools.find((t) => t.name === 'tasker_memory_' + key);
    return [key, { tool, schema: z.fromJSONSchema(tool.inputSchema) }];
  }),
);

export async function pageDraftRequest(client, key, input) {
  const entry = pageDraftTools.get(key);
  const parsed = entry?.schema.safeParse(input);
  if (!parsed?.success) {
    fail('invalid_arguments', 'Use the page draft selector and revisions returned by the server.');
  }
  const args = parsed.data;
  if (key === 'edit_draft' && (args.action === 'save') !== (args.content !== undefined)) {
    fail('invalid_arguments', 'Include content for a draft save only.');
  }
  const token = await client.accessToken();
  if (key === 'edit_draft') {
    client.invalidateReads();
  }
  const result = await client.transport.request('/api/agents/v1/' + entry.tool.route, {
    method: key === 'edit_draft' ? 'POST' : 'GET',
    token,
    ...(key === 'edit_draft' ? { json: args } : { query: args }),
  });
  if (
    key === 'drafts'
      ? !Array.isArray(result?.items)
      : result?.pageId !== args.pageId ||
        (key === 'draft'
          ? result.scope !== args.scope
          : result.operationId !== args.operationId || typeof result.revision !== 'string')
  ) {
    fail('invalid_response', 'The response did not match this private draft request.');
  }
  return result;
}
