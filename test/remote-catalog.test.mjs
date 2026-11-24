import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
const tools = JSON.parse(await readFile(new URL('../remote/tool-catalog.json', import.meta.url)));
test('remote catalogue has bounded explicit schemas and honest write annotations', () => {
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
  const ajv = new Ajv({
    strict: false,
    formats: {
      uuid: /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      int64: { type: 'number', validate: Number.isSafeInteger },
    },
  });
  for (const tool of tools) {
    assert.match(tool.name, /^(tasker|fitness)_[a-z_]+$/);
    assert.ok(tool.title && tool.description);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    ajv.compile(tool.inputSchema);
    if (tool.write) {
      assert.equal(
        tool.destructive,
        tool.name.startsWith('tasker_feedback_')
          ? tool.name.endsWith('_media_remove')
          : ![
              'tasker_attachment_add',
              'tasker_design_grid_decisions',
              'tasker_design_conformity',
              'tasker_design_publish_selection',
              'tasker_design_publish_version',
            ].includes(tool.name) && !tool.name.endsWith('_cleanup_preview'),
      );
    }
    assert.ok(!tool.route || /^[a-z]+(?:[-/][a-z]+)*$/.test(tool.route));
  }
  const execute = tools.find((t) => t.name.endsWith('_execute_command'));
  assert.equal(execute.write, true);
  const validate = ajv.compile(execute.inputSchema);
  assert.equal(validate({}), false);
  assert.equal(validate({ url: 'https://example.com' }), false);
  const prepare = tools.find((t) => t.name.endsWith('_prepare_command'));
  assert.ok(!prepare.write);
  assert.deepEqual(
    execute.inputSchema.properties.kind.enum,
    prepare.inputSchema.properties.kind.enum,
  );
  assert.ok(!tools.some((t) => /upload|local|profile|permission/.test(t.name)));
});

test('every command can request its exact permission without unrelated write grants', async () => {
  const { default: catalog } = await import('../src/command-catalog.mjs');
  for (const [kind, command] of Object.entries(catalog.commands)) {
    const tool = tools.find(
      (candidate) =>
        candidate.route === 'commands' &&
        candidate.name.includes('_edit_') &&
        candidate.inputSchema.properties.kind.enum.includes(kind),
    );
    assert.ok(tool, kind);
    const prune = kind === 'memory.design.pruneRevision';
    assert.deepEqual(
      tool.scopes,
      prune
        ? ['storage:clean', 'history:read', 'memory:read', 'storage:read', 'memory:write']
        : [command.permission],
      kind,
    );
    assert.equal(tool.route, 'commands');
    for (const accepted of tool.inputSchema.properties.kind.enum) {
      assert.equal(catalog.commands[accepted].permission, command.permission);
    }
    const validate = new Ajv({ strict: false }).compile(tool.inputSchema);
    const input = {
      operationId: '00000000-0000-4000-8000-000000000001',
      issuedAt: 1,
      kind,
      scope: 'project:example',
      id: 'record',
      epoch: 'epoch',
      expectedRevision: null,
      data: {},
    };
    if (prune) {
      assert.equal(validate(input), false);
      Object.assign(input, {
        scope: 'memory:design',
        id: 'design',
        expectedRevision: '8',
        data: { variantId: 'mobile', revision: '4', currentRevision: '7', confirmed: true },
      });
    }
    assert.equal(validate(input), true, kind);
    if (prune) {
      assert.equal(validate({ ...input, data: { ...input.data, confirmed: false } }), false);
    }
    const other = Object.keys(catalog.commands).find(
      (name) => catalog.commands[name].permission !== command.permission,
    );
    assert.equal(validate({ ...input, kind: other }), false, `${kind} must reject ${other}`);
  }
  for (const tool of tools.filter((candidate) => candidate.name.includes('_coach_'))) {
    assert.ok(tool.scopes.includes('coaching:write'));
    assert.equal(tool.route, 'commands');
    assert.equal(tool.write, true);
  }
});

test('hosted changes accepts one bounded opaque continuation with explicit task-state opt-in', () => {
  const changes = tools.find((tool) => tool.name === 'tasker_changes');
  assert.ok(changes);
  assert.equal(changes.route, 'changes');
  assert.equal(changes.write, false);
  assert.equal(changes.destructive, false);
  assert.deepEqual(changes.scopes, []);
  assert.deepEqual([...changes.inputSchema.required].sort(), ['collection', 'cursor', 'scope']);
  assert.deepEqual(changes.inputSchema.properties.taskState.enum, ['v1', 'v2']);
  const validate = new Ajv({ strict: false }).compile(changes.inputSchema);
  const base = { scope: 'project:work', collection: 'tasks', cursor: 'opaque+/=continuation' };
  for (const input of [base, { ...base, taskState: 'v1' }, { ...base, taskState: 'v2' }]) {
    assert.equal(validate(input), true);
  }
  for (const input of [
    { ...base, cursor: '' },
    { ...base, cursor: 'x'.repeat(4097) },
    { ...base, scope: '' },
    { ...base, collection: 'unknown' },
    { ...base, taskState: 'v3' },
    ...['after', 'archive', 'taskId', 'metricId', 'limit', 'pollSeconds'].map((key) => ({
      ...base,
      [key]: 'not-a-change-filter',
    })),
  ]) {
    assert.equal(validate(input), false);
  }
  assert.match(changes.description, /one bounded page/i);
  assert.match(changes.description, /pollAfterSeconds/);
  assert.match(changes.description, /normal read budget/);
});
