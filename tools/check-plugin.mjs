import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(root + p, 'utf8'));
const ajv = new Ajv2020({ strict: true, allErrors: true });
for (const name of ['plugin', 'mcp']) {
  const valid = ajv.compile(read(`tools/schemas/${name}.schema.json`));
  if (!valid(read(`${name}.json`))) {
    throw Error(`${name}: ${JSON.stringify(valid.errors)}`);
  }
}
const pkg = read('package.json'),
  plugin = read('plugin.json'),
  mcp = read('mcp.json');
assert.equal(pkg.version, plugin.version);
assert.equal(pkg.license, 'MIT');
assert.equal(plugin.license, pkg.license);
assert.equal(read('package-lock.json').packages[''].license, pkg.license);
assert.ok(fs.readFileSync(root + 'LICENSE', 'utf8').startsWith('MIT License\n'));
assert.ok(fs.readFileSync(root + 'LICENSES/Apache-2.0.txt', 'utf8').includes('Apache License'));

assert.equal(read('package-lock.json').version, pkg.version);
const spec = `${pkg.name}@${pkg.version}`;
assert.deepEqual(mcp.mcpServers.geniustasker, {
  type: 'stdio',
  command: 'npx',
  args: ['-y', spec, 'mcp', '--context', 'work'],
});
assert.ok(fs.readFileSync(root + 'src/mcp.mjs', 'utf8').includes(`version: '${pkg.version}'`));
assert.equal(read('examples/mcp.json').mcpServers.geniustasker.args[1], spec);
assert.ok(fs.readFileSync(root + 'examples/codex.toml', 'utf8').includes(spec));
const market = read('.agents/plugins/marketplace.json');
assert.equal(market.plugins[0].source.path, './');
assert.equal(market.plugins[0].name, plugin.name);
for (const entry of fs
  .readdirSync(root + 'skills', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())) {
  const name = entry.name;
  const base = root + `skills/${name}/`,
    skill = fs.readFileSync(base + 'SKILL.md', 'utf8');
  assert.ok(skill.startsWith(`---\nname: ${name}\ndescription: `));
  assert.ok(skill.includes('\n---\n'));
  assert.ok(fs.readFileSync(base + 'agents/openai.yaml', 'utf8').includes('$' + name));
  for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(base + match[1]), 'Missing skill reference');
  }
}
console.log('Plugin schemas, version pins, skill metadata and references checked.');
