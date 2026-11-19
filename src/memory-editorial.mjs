import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import workflows from '../remote/workflows.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const editorialTools = new Map(
  ['review', 'template'].map((key) => {
    const tool = tools.find((item) => item.name === 'tasker_memory_' + key);
    return [key, { tool, schema: z.fromJSONSchema(tool.inputSchema) }];
  }),
);
export const documentationTool = tools.find(
  (entry) => entry.name === 'tasker_project_documentation',
);
export const documentationSchema = z.fromJSONSchema(documentationTool.inputSchema);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const policy = z.object({
  memoryId: id.nullable(),
  folderId: id.nullable(),
  guidance: z.string(),
  language: z.string().nullable(),
  autoDomains: z.array(z.string()),
  suggestionState: z.enum(['ask', 'later', 'dismissed']),
  stylePageId: id.nullable(),
});

function valid(key, input) {
  const result = editorialTools.get(key).schema.safeParse(input);
  if (!result.success) {
    fail('invalid_arguments', 'Use the documented editorial selectors.');
  }
  return result.data;
}

export function previewMemoryTemplate(input) {
  const { family, page, language } = valid('template', input);
  const choices = workflows.topics['memory-templates'].templates.find(
    (entry) => entry.family === family,
  ).pages;
  if (!page) {
    return {
      family,
      language,
      applied: false,
      pages: choices.map((choice) => ({ key: choice.key, title: choice.title[language] })),
    };
  }
  const chosen = choices.find((choice) => choice.key === page);
  if (!chosen) {
    fail('invalid_arguments', 'Choose a page listed for this family.');
  }
  return {
    family,
    language,
    applied: false,
    page: chosen.key,
    title: chosen.title[language],
    suggestedHeadings: chosen.sections[language],
  };
}

const evidence = new Set([
  'tested-release',
  'verified-behavior',
  'approved-decision',
  'verified-procedure',
]);
const result = (action, reason, extra = {}) => ({ action, reason, applied: false, ...extra });

async function pageIndex(client, scope, pageId, snapshot = {}) {
  const read = await client.get('resources', {
    scope,
    collection: 'pageIndex',
    id: pageId,
    ...snapshot,
  });
  if (
    read?.scope !== scope ||
    read.collection !== 'pageIndex' ||
    !Array.isArray(read.items) ||
    !read.epoch ||
    !read.checkpoint ||
    read.items.length > 1 ||
    (read.items.length && read.items[0].id !== pageId) ||
    (snapshot.epoch && (read.epoch !== snapshot.epoch || read.checkpoint !== snapshot.checkpoint))
  ) {
    fail('invalid_response', 'The Memory index returned an unexpected target or snapshot.');
  }
  return read;
}

// Follow only the candidate's ancestor chain when a destination folder is configured.
async function withinFolder(client, read, parentId, expected) {
  const visited = new Set();
  while (parentId && parentId !== expected) {
    if (visited.has(parentId) || visited.size >= 12) {
      return false;
    }
    visited.add(parentId);
    const parent = await pageIndex(client, read.scope, parentId, {
      epoch: read.epoch,
      checkpoint: read.checkpoint,
    });
    if (!parent.items[0]?.data?.directory) {
      return false;
    }
    parentId = parent.items[0].data.parentId;
  }
  return parentId === expected;
}
function permitsWrite(grant, scope) {
  return (
    grant?.permissions?.includes('memory:write') &&
    (grant.allResources === true || grant.resourceIds?.includes(scope))
  );
}

async function hasDelegatedWrite(client, scope) {
  const identity = await client.get('me');
  return (
    permitsWrite(identity?.connection?.grant, scope) &&
    permitsWrite(identity?.profile?.grant, scope)
  );
}

const proposalCommand = 'memory.page.proposeRevision';

function reviewedReferences(review) {
  if (
    !review ||
    typeof review.ownerId !== 'string' ||
    !review.ownerId.trim() ||
    !Array.isArray(review.handled) ||
    review.handled.length > 32
  ) {
    fail('invalid_response', 'The tracked decision did not return its reviewer or review history.');
  }
  return review.handled.map((entry) => {
    let signature;
    try {
      signature = JSON.parse(entry);
    } catch {
      // This page is tracked. An unreadable refusal history must stop the proposal.
    }
    if (
      !Array.isArray(signature) ||
      signature.length !== 3 ||
      signature.some((part) => typeof part !== 'string' || !part.length)
    ) {
      fail('invalid_response', 'The tracked decision returned an unreadable review history.');
    }
    return signature[2];
  });
}

export async function readProjectDocumentation(client, input) {
  const query = documentationSchema.safeParse(input);
  if (!query.success) {
    fail('invalid_arguments', 'Choose one project for its documentation settings.');
  }
  const project = await client.get('project/documentation', query.data);
  if (
    project?.scope !== query.data.scope ||
    typeof project.epoch !== 'string' ||
    typeof project.revision !== 'string' ||
    (project.documentation !== null && !policy.safeParse(project.documentation).success)
  ) {
    fail('invalid_response', 'The source project did not return its documentation policy.');
  }
  return project;
}

// The caller supplies the source's meaning. The actual project, destination and
// candidate revision are independently read with the ordinary delegated grants.
export async function reviewProjectMemory(client, input) {
  const { scope, change, domain, sources, candidates, existingFactMatches } = valid(
    'review',
    input,
  );
  if (new Set(candidates.map((p) => p.pageId)).size !== candidates.length) {
    fail('invalid_arguments', 'Provide different candidate pages from the scoped search.');
  }
  if (change === 'routine' || change === 'proposal') {
    return result('skip', 'keep_in_task');
  }
  const project = await readProjectDocumentation(client, { scope });
  if (project.documentation === null) {
    return result('skip', 'destination_unavailable');
  }
  const parsed = policy.safeParse(project.documentation);
  if (!parsed.success) {
    fail('invalid_response', 'The documentation policy format was unavailable.');
  }
  const { memoryId, folderId, suggestionState, autoDomains, language, stylePageId, guidance } =
    parsed.data;
  const decision = (action, reason, extra = {}) =>
    result(action, reason, { projectRevision: project.revision, ...extra });
  const proposal = (reason, extra = {}) =>
    suggestionState === 'ask'
      ? decision('propose', reason, extra)
      : decision('skip', 'suggestion_' + suggestionState);
  const verifiedSources = sources
    .filter(
      (source) =>
        evidence.has(source.kind) &&
        source.reference.trim() &&
        !/[\p{Cc}\p{Bidi_Control}]/u.test(source.reference),
    )
    .map((source) => ({ kind: source.kind, reference: source.reference.trim() }));
  if (change === 'uncertain' || !verifiedSources.length) {
    return decision('clarify', 'verify_durable_source');
  }
  if (!memoryId) {
    return proposal('first_page_and_destination');
  }
  if (!candidates.length) {
    return proposal('first_relevant_page', { memoryId, folderId, language, stylePageId });
  }
  if (candidates.length > 1) {
    return decision('clarify', 'ambiguous_destination');
  }
  const target = candidates[0];
  const memoryScope = 'memory:' + memoryId;
  const read = await pageIndex(client, memoryScope, target.pageId);
  const page = read.items[0];
  if (!page || page.data?.state === 'retired') {
    return decision('skip', 'candidate_unavailable');
  }
  if (page.revision !== target.revision) {
    return decision('clarify', 'reread_changed_page');
  }
  if (
    page.data?.directory ||
    (folderId && !(await withinFolder(client, read, page.data?.parentId, folderId)))
  ) {
    return decision('clarify', 'verify_destination_folder');
  }
  if (existingFactMatches) {
    return decision('skip', 'already_documented');
  }
  const context = {
    memoryId,
    folderId,
    pageId: page.id,
    revision: page.revision,
    domain,
    language,
    stylePageId,
    guidance,
  };
  const review = page.data?.decisionReview;
  if (review !== undefined && review !== null) {
    if (suggestionState !== 'ask') {
      return decision('skip', 'suggestion_' + suggestionState);
    }
    const reviewed = reviewedReferences(review);
    if (review.pending !== undefined && review.pending !== null) {
      return decision('skip', 'memory_decision_review_pending');
    }
    // The selector identifies a page, not a block. Reusing only reviewed evidence
    // must never trigger another automatic prompt. A distinct source can proceed.
    const source = verifiedSources.find((candidate) => !reviewed.includes(candidate.reference));
    if (!source) {
      return decision('skip', 'memory_decision_already_reviewed');
    }
    if (!(await hasDelegatedWrite(client, memoryScope))) {
      return proposal('no_delegated_write', { ...context, ownerId: review.ownerId });
    }
    const discovery = await client.get('capabilities');
    if (
      !Array.isArray(discovery?.commands) ||
      !discovery.commands.some((command) => command?.kind === proposalCommand)
    ) {
      return proposal('decision_review_command_unavailable', {
        ...context,
        ownerId: review.ownerId,
      });
    }
    return decision('prepare_proposal', 'tracked_decision_requires_review', {
      ...context,
      scope: memoryScope,
      epoch: read.epoch,
      ownerId: review.ownerId,
      command: proposalCommand,
      evidenceKind: source.kind,
      evidenceRef: source.reference,
      needsUserApprovalToSubmit: !autoDomains.includes(domain),
    });
  }
  if (!autoDomains.includes(domain)) {
    return proposal('domain_requires_review', context);
  }
  if (!(await hasDelegatedWrite(client, memoryScope))) {
    return proposal('no_delegated_write', context);
  }
  return decision('prepare_update', 'matching_domain_and_page', context);
}
