import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { commandHelp, describeCommands } from '../src/commands.mjs';
import schemas from '../src/command-input-schemas.mjs';
import { main } from '../src/cli.mjs';

test('structured command help preserves protocol schemas, nullable fields and internal field exclusion', async () => {
  assert.deepEqual(
    Object.keys(schemas)
      .filter((kind) => kind.startsWith('protocol.'))
      .sort(),
    ['protocol.apply', 'protocol.cancel', 'protocol.publish', 'protocol.start'],
  );
  const text = JSON.stringify(schemas);
  assert.ok(!/x-web-core-|\$private|"\$ref"|nullable/.test(text));
  for (const [kind, schema] of Object.entries(schemas)) {
    assert.equal(Object.hasOwn(schema.properties, 'action'), false);
    // The generated nested checklist discriminant is intentionally public.
    if (kind !== 'run.checklist') {
      assert.ok(!JSON.stringify(schema).includes('"action"'));
    }
  }
  const validate = Object.fromEntries(
    Object.entries(schemas).map(([kind, schema]) => [
      kind,
      new Ajv({ strict: true }).compile(schema),
    ]),
  );
  const guide = await readFile(
    new URL('../skills/geniustasker/references/protocols.md', import.meta.url),
    'utf8',
  );
  const examples = [...guide.matchAll(/```json\n([\s\S]+?)\n```/g)].map((match) =>
    JSON.parse(match[1]),
  );
  const published = examples.find((value) => value.definition);
  const preview = examples.find((value) => value.bindings);
  assert.equal(
    validate['protocol.publish'](published),
    true,
    JSON.stringify(validate['protocol.publish'].errors),
  );
  assert.equal(
    validate['protocol.start']({
      protocolVersionId: preview.protocolVersionId,
      bindings: preview.bindings,
    }),
    true,
  );
  assert.equal(validate['protocol.apply']({ digest: 'a'.repeat(64), from: 0, count: 20 }), true);
  assert.equal(validate['protocol.apply']({ digest: 'a'.repeat(64), from: 0, count: 21 }), false);
  assert.equal(validate['protocol.publish']({ ...published, action: 'publishProtocol' }), false);
  const repeated = structuredClone(published);
  repeated.definition.steps[0].dependencies = ['previous', 'previous'];
  assert.equal(validate['protocol.publish'](repeated), false);
  assert.equal(validate['protocol.publish']({ definition: published.definition }), false);
  const effort = structuredClone(published);
  delete effort.definition.steps[0].estimateDays;
  assert.equal(validate['protocol.publish'](effort), true);
  assert.equal(Object.hasOwn(effort.definition.steps[0], 'estimateDays'), false);
  for (const estimateDays of [null, 0.1, 1, 12.375, 60]) {
    effort.definition.steps[0].estimateDays = estimateDays;
    assert.equal(validate['protocol.publish'](effort), true, String(estimateDays));
    assert.equal(effort.definition.steps[0].estimateDays, estimateDays);
  }
  for (const estimateDays of [0, 0.09, 60.1, '0.1', Infinity, NaN]) {
    effort.definition.steps[0].estimateDays = estimateDays;
    assert.equal(validate['protocol.publish'](effort), false, String(estimateDays));
  }
  assert.equal(validate['protocol.cancel']({}), true);
  assert.equal(validate['protocol.cancel']({ state: 'Applied' }), false);
  for (const [kind, schema] of Object.entries(schemas)) {
    const help = commandHelp({ kind });
    assert.deepEqual(help.requiredFields, schema.required);
    assert.deepEqual(Object.keys(help.properties), help.fields);
    assert.deepEqual(describeCommands().commands[kind], help);
  }
  assert.throws(() => commandHelp({ kind: 'untrusted.command' }), { code: 'invalid_arguments' });
});

test('CLI can inspect one protocol command schema without authentication or network access', async () => {
  let stdout = '',
    stderr = '';
  const code = await main(['commands', 'describe', '--kind', 'protocol.apply', '--json'], {
    stdout: {
      write: (chunk) => {
        stdout += chunk;
      },
    },
    stderr: {
      write: (chunk) => {
        stderr += chunk;
      },
    },
    client: { accessToken: () => assert.fail('Offline discovery must not authenticate') },
  });
  assert.equal(code, 0);
  assert.equal(stderr, '');
  const result = JSON.parse(stdout);
  assert.equal(result.data.kind, 'protocol.apply');
  assert.equal(result.data.properties.count.maximum, 20);
  assert.deepEqual(result.data.requiredFields, ['count', 'digest', 'from']);
});

test('CLI command help exposes optional fractional effort without changing the legacy protocol shape', async () => {
  let stdout = '';
  const code = await main(['commands', 'describe', '--kind', 'protocol.publish', '--json'], {
    stdout: {
      write: (chunk) => {
        stdout += chunk;
      },
    },
    stderr: { write: () => assert.fail('Unexpected CLI error') },
    fetchImpl: () => assert.fail('Offline help must not contact the API'),
  });
  assert.equal(code, 0);
  const step = JSON.parse(stdout).data.properties.definition.properties.steps.items;
  assert.equal(step.required.includes('estimateDays'), false);
  const validate = new Ajv({ strict: true }).compile(step.properties.estimateDays);
  assert.equal(validate(0.1), true);
  assert.equal(validate(null), true);
  assert.equal(validate(0.09), false);
  assert.equal(validate(60.1), false);
});

test('ticket help describes bounded links to published knowledge for creation and edits', () => {
  for (const name of ['task.create', 'task.update']) {
    const validate = new Ajv({ strict: true }).compile(schemas[name].properties.contentReferences);
    const reference = {
      kind: 'design',
      scope: 'memory:studio',
      pageId: 'home',
      revision: '7',
      blockId: 'phone',
      criterionId: 'page:labels',
    };
    assert.equal(validate([reference]), true);
    assert.equal(validate(Array(13).fill(reference)), false);
    assert.equal(validate([{ ...reference, title: 'Do not copy source data' }]), false);
    assert.equal(validate([{ ...reference, scope: 'unscoped' }]), false);
    assert.equal(validate([]), true);
  }
});
