import test from 'node:test';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateCommand } from '../src/commands.mjs';

test('shared filters keep revisions and project identity without writable layout or server fields', () => {
  const request = {
    operationId: randomUUID(),
    issuedAt: 1791820800000,
    scope: 'project:work',
    epoch: 'test-epoch',
    id: 'release',
    expectedRevision: null,
    kind: 'filter.create',
    data: {
      name: 'Release',
      criteria: {
        formatVersion: 1,
        query: '',
        tags: [],
        allTags: true,
        assignees: [],
        statuses: ['New'],
        priorities: [],
        sprints: [],
        epics: [],
        placement: null,
        blocked: null,
      },
    },
  };
  assert.equal(validateCommand(request).kind, 'filter.create');
  assert.equal(
    validateCommand({
      ...request,
      kind: 'filter.update',
      expectedRevision: '2',
      data: { name: 'Beta' },
    }).data.name,
    'Beta',
  );
  assert.equal(
    validateCommand({ ...request, kind: 'filter.delete', expectedRevision: '2', data: {} }).kind,
    'filter.delete',
  );
  for (const patch of [
    { scope: 'memory:work' },
    { kind: 'filter.update', expectedRevision: null },
    { data: { ...request.data, layout: 'kanban' } },
    { data: { ...request.data, group: 'foreign-project' } },
  ]) {
    assert.throws(() => validateCommand({ ...request, ...patch }), { code: 'invalid_arguments' });
  }
});
