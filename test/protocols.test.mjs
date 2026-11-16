import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import Ajv from 'ajv';
import { previewProtocol } from '../src/protocols.mjs';
import { main } from '../src/cli.mjs';
import { credentials } from '../src/client.mjs';
import { fixture, tokens, origin } from './helpers.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const input = {
  scope: 'project:review',
  protocolVersionId: id(1),
  bindings: {
    instanceId: id(2),
    scope: 'project:review',
    epoch: 'e',
    anchor: '2026-11-16T09:00:00+01:00',
    values: { feature: 'Accessibility', count: 0, enabled: false },
  },
};
const digest = 'a'.repeat(64);
function page(after = 0) {
  const total = 21;
  const steps = Array.from({ length: Math.min(20, total - after) }, (_, index) => ({
    key: `step${after + index}`,
    id: id(10 + after + index),
    title: 'Review behavior',
    description: 'Use verified requirements.',
    kind: 'Ticket',
    parent: null,
    dependencies: [],
    owner: 'member',
    dueDate: null,
    importance: 'Normal',
    importanceReason: '',
    delivery: { push: 'silent', recap: true, animation: 'inherit' },
    acceptance: ['Behavior verified'],
  }));
  return {
    protocolVersionId: input.protocolVersionId,
    instanceId: input.bindings.instanceId,
    epoch: 'e',
    digest,
    total,
    batchSize: 20,
    steps,
    nextAfter: after + steps.length < total ? after + steps.length : null,
  };
}

test('protocol preview sends one authorized POST per requested page, without changing credentials or journaling a command', async (t) => {
  const calls = [];
  const f = await fixture(t, async (url, options) => {
    assert.equal(url.href, `${origin}/api/agents/v1/protocols/preview`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${tokens().access_token}`);
    const body = JSON.parse(options.body);
    calls.push(body);
    return Response.json(page(body.after));
  });
  const before = await f.store.read(),
    files = await readdir(f.directory);
  assert.equal((await previewProtocol(f.client, input)).nextAfter, 20);
  assert.deepEqual(calls, [input]);
  assert.equal((await previewProtocol(f.client, { ...input, after: 20, digest })).steps.length, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(await f.store.read(), before);
  assert.deepEqual(await readdir(f.directory), files);
});

test('malformed or mismatched preview inputs fail before authentication or network access', async () => {
  const client = { accessToken: () => assert.fail('Input must be validated first') };
  for (const value of [
    { ...input, scope: 'memory:review' },
    { ...input, after: 1 },
    { ...input, after: 200, digest },
    { ...input, url: 'https://untrusted.invalid' },
    { ...input, bindings: { ...input.bindings, scope: 'project:other' } },
    { ...input, bindings: { ...input.bindings, instanceId: 'broken' } },
    { ...input, bindings: { ...input.bindings, values: { unsafe: { nested: true } } } },
    {
      ...input,
      bindings: {
        ...input.bindings,
        values: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`v${i}`, i])),
      },
    },
  ]) {
    await assert.rejects(previewProtocol(client, value), { code: 'invalid_arguments' });
  }
});

test('preview checks bound identity, digest, page size, progress and unique steps before returning data', async (t) => {
  let response;
  const f = await fixture(t, async () => Response.json(response));
  for (const changed of [
    { protocolVersionId: id(99) },
    { instanceId: id(99) },
    { epoch: 'changed' },
    { total: 201 },
    { batchSize: 200 },
    { nextAfter: 19 },
    { steps: [] },
    { steps: [...page().steps, page().steps[0]] },
    { steps: Array.from({ length: 20 }, () => page().steps[0]) },
  ]) {
    response = { ...page(), ...changed };
    await assert.rejects(previewProtocol(f.client, input), { code: 'invalid_response' });
  }
  response = { ...page(20), digest: 'b'.repeat(64) };
  await assert.rejects(previewProtocol(f.client, { ...input, after: 20, digest }), {
    code: 'invalid_response',
  });
});

test('quota refusal and uncertain reads never trigger an implicit retry or apply command', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return Response.json(
      {
        error: {
          code: 'agent_rate_limited',
          message: 'Please wait.',
          retryable: true,
          retryAfterSeconds: 60,
        },
      },
      { status: 429 },
    );
  });
  await assert.rejects(
    previewProtocol(f.client, input),
    (error) => error.status === 429 && error.details.retryAfterSeconds === 60,
  );
  assert.equal(calls, 1);
  f.transport.fetch = async () => {
    calls++;
    throw Error('lost response');
  };
  await assert.rejects(previewProtocol(f.client, input), { code: 'network_unavailable' });
  assert.equal(calls, 2);
});

test('CLI protocol preview keeps JSON output separate and submits the file exactly once', async (t) => {
  let calls = 0,
    stdout = '',
    stderr = '';
  const f = await fixture(t);
  const file = join(f.directory, 'preview.json');
  await writeFile(file, JSON.stringify(input));
  const status = await main(
    ['protocols', 'preview', '--file', file, '--origin', origin, '--allow-local', '--json'],
    {
      directory: f.directory,
      runtimeDirectory: join(f.directory, 'runtime'),
      isTTY: false,
      stdout: {
        write: (value) => {
          stdout += value;
        },
      },
      stderr: {
        write: (value) => {
          stderr += value;
        },
      },
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url.pathname, '/api/agents/v1/protocols/preview');
        assert.deepEqual(JSON.parse(options.body), input);
        return Response.json(page());
      },
    },
  );
  assert.equal(status, 0);
  assert.equal(calls, 1);
  assert.equal(stderr, '');
  assert.deepEqual(JSON.parse(stdout), { formatVersion: 1, ok: true, data: page() });
});

test('remote preview is a read-only POST with tasks:read and a bounded public input schema', () => {
  const tool = tools.find((value) => value.name === 'tasker_protocol_preview');
  assert.equal(tool.method, 'POST');
  assert.equal(tool.write, false);
  assert.equal(tool.destructive, false);
  assert.equal(tool.route, 'protocols/preview');
  assert.deepEqual(tool.scopes, ['tasks:read']);
  const validate = new Ajv({ strict: false }).compile(tool.inputSchema);
  assert.equal(validate(input), true);
  assert.equal(validate({ ...input, after: 200 }), false);
  assert.equal(validate({ ...input, extra: 'ignore controls' }), false);
});

test('real stdio MCP exposes preview as readonly and returns exactly one protected HTTP page', async (t) => {
  let calls = 0;
  const server = createServer(async (request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/api/agents/v1/protocols/preview');
    assert.equal(request.headers.authorization, `Bearer ${tokens().access_token}`);
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
    }
    assert.deepEqual(JSON.parse(raw), input);
    calls++;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(page()));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const f = await fixture(t, undefined, { authenticated: false });
  await f.store.locked(() => f.store.write(credentials(tokens(), endpoint)));
  const client = new Client({ name: 'protocol-preview-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('fixtures/client-process.mjs', import.meta.url)),
      'mcp',
      f.directory,
      endpoint,
    ],
    stderr: 'pipe',
  });
  let errors = '';
  transport.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  await client.connect(transport);
  t.after(() => client.close());
  const tool = (await client.listTools()).tools.find(
    (value) => value.name === 'tasker_protocol_preview',
  );
  assert.equal(tool.annotations.readOnlyHint, true);
  const helpTool = (await client.listTools()).tools.find(
    (value) => value.name === 'tasker_command_help',
  );
  assert.equal(helpTool.annotations.readOnlyHint, true);
  const help = await client.callTool({
    name: 'tasker_command_help',
    arguments: { kind: 'protocol.publish' },
  });
  assert.equal(help.isError, undefined);
  assert.equal(help.structuredContent.data.properties.definition.properties.steps.maxItems, 200);
  assert.equal(calls, 0, 'Schema help uses no network or account access');
  assert.equal(tool.annotations.destructiveHint, false);
  const result = await client.callTool({ name: tool.name, arguments: input });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent.data, page());
  assert.equal(calls, 1);
  assert.equal(errors, '');
  const guide = await client.callTool({
    name: 'tasker_workflow',
    arguments: { topic: 'protocols' },
  });
  assert.notEqual(guide.isError, true);
  assert.equal(calls, 1);
});
