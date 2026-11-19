import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const archiveTools = new Map(
  ['query', 'detail', 'comments'].map((key) => {
    const tool = tools.find((entry) => entry.name === 'tasker_archive_' + key);
    return [key, { tool, schema: z.fromJSONSchema(tool.inputSchema) }];
  }),
);

export function archiveQuery(input) {
  const parsed = archiveTools.get('query').schema.safeParse(input);
  if (!parsed.success) {
    fail('invalid_arguments', 'Choose one project and valid archive filters.');
  }
  const {
    scope,
    limit = 25,
    query = '',
    statuses = [],
    assignees = [],
    importance,
    archivedFrom,
    archivedUntil,
    sort = 'Newest',
    sharedFilterId = null,
    column = null,
    continuation = null,
  } = parsed.data;
  if (archivedFrom && archivedUntil && Date.parse(archivedFrom) > Date.parse(archivedUntil)) {
    fail('invalid_arguments', 'The archive interval must start before it ends.');
  }
  return {
    scope,
    limit,
    criteria: {
      formatVersion: 1,
      query,
      tags: [],
      allTags: false,
      assignees,
      statuses,
      priorities: [],
      sprints: [],
      epics: [],
      placement: null,
      blocked: null,
    },
    sort,
    sharedFilterId,
    column,
    continuation,
    archive: true,
    ...(importance ? { importance } : {}),
    ...(archivedFrom ? { archivedFrom } : {}),
    ...(archivedUntil ? { archivedUntil } : {}),
  };
}

export async function readArchive(client, key, input) {
  const entry = archiveTools.get(key);
  const parsed = entry?.schema.safeParse(input);
  if (!parsed?.success) {
    fail('invalid_arguments', 'Use the archive selectors for this operation.');
  }
  let response;
  if (key === 'query') {
    response = await client.transport.request('/api/agents/v1/' + entry.tool.route, {
      method: 'POST',
      token: await client.accessToken(),
      json: archiveQuery(parsed.data),
    });
  } else {
    response = await client.get(entry.tool.route, parsed.data);
  }
  if (
    response?.scope !== parsed.data.scope ||
    (key === 'query' &&
      (response.module !== 'Project/ProjectTask' ||
        !Array.isArray(response.items) ||
        response.items.length > (parsed.data.limit ?? 25) ||
        !(response.next === null || typeof response.next === 'string'))) ||
    (key !== 'query' && response.id !== parsed.data.id) ||
    (key === 'detail' &&
      (typeof response.revision !== 'string' ||
        !response.data ||
        typeof response.data !== 'object')) ||
    (key === 'comments' &&
      (!Array.isArray(response.items) ||
        !(response.nextAfter === null || typeof response.nextAfter === 'string')))
  ) {
    fail('invalid_response', 'The archive response did not match the requested task or page.');
  }
  return response;
}
