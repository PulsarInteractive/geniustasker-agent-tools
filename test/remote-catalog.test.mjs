import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
const tools = JSON.parse(await readFile(new URL('../remote/tool-catalog.json', import.meta.url)));
test('remote catalogue has bounded explicit schemas and honest write annotations', () => {
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
  const ajv = new Ajv({ strict: false });
  for (const tool of tools) {
    assert.match(tool.name, /^(tasker|fitness)_[a-z_]+$/);
    assert.ok(tool.title && tool.description);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    ajv.compile(tool.inputSchema);
    if (tool.write) {
      assert.equal(tool.destructive, true);
    }
    assert.ok(!tool.route || /^[a-z]+(?:\/[a-z]+)?$/.test(tool.route));
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
        candidate.name.includes('_edit_') &&
        candidate.inputSchema.properties.kind.enum.includes(kind),
    );
    assert.ok(tool, kind);
    assert.deepEqual(tool.scopes, [command.permission], kind);
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
    assert.equal(validate(input), true, kind);
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
