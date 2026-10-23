import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateCommand } from '../src/commands.mjs';
import catalog from '../src/command-catalog.mjs';
import { workflow } from '../src/workflows.mjs';

test('project creation uses explicit scope identity and a new permission', () => {
  const id = randomUUID();
  const input = {
    operationId: randomUUID(),
    issuedAt: Date.now(),
    kind: 'project.create',
    scope: `project:${id}`,
    id,
    epoch: id,
    expectedRevision: null,
    data: { title: 'Product' },
  };
  assert.equal(validateCommand(input).id, id);
  assert.equal(catalog.commands['project.create'].permission, 'projects:write');
  for (const patch of [
    { epoch: 'wrong' },
    { scope: `memory:${id}` },
    { expectedRevision: '1' },
    { data: { title: 'Product', agentsEnabled: true } },
    { data: { memberNumber: 50 } },
  ]) {
    assert.throws(() => validateCommand({ ...input, ...patch }), { code: 'invalid_arguments' });
  }
});

test('planning guides and exact command boundaries cover lifecycle operations', () => {
  assert.ok(workflow({ topic: 'planning' }).steps.some((step) => step.includes('carryToSprint')));
  for (const prefix of ['sprint', 'workflow', 'schedule', 'document', 'folder']) {
    for (const op of ['create', 'update', 'delete']) {
      const kind = `${prefix}.${op}`,
        definition = catalog.commands[kind];
      assert.ok(definition, kind);
      assert.equal(definition.permission, 'tasks:write');
      const input = {
        operationId: randomUUID(),
        issuedAt: Date.now(),
        kind,
        scope: 'project:work',
        id: 'record',
        epoch: 'epoch',
        expectedRevision: op === 'create' ? null : '2',
        data: {},
      };
      assert.equal(validateCommand(input).kind, kind);
      assert.throws(() => validateCommand({ ...input, data: { action: 'arbitrary' } }), {
        code: 'invalid_arguments',
      });
      assert.throws(
        () => validateCommand({ ...input, expectedRevision: op === 'create' ? '2' : null }),
        { code: 'invalid_arguments' },
      );
    }
  }
});
