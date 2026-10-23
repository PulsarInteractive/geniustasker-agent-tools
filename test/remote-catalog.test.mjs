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
