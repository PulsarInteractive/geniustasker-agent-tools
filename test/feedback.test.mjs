import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rm, symlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { fixture, origin, tokens } from './helpers.mjs';
import { credentials } from '../src/client.mjs';
import { CommandJournal } from '../src/commands.mjs';
import { createMcpServer } from '../src/mcp.mjs';
import { main } from '../src/cli.mjs';
import {
  prepareFeedbackImage,
  uploadFeedbackImage,
  downloadFeedbackImage,
} from '../src/feedback-media-transfer.mjs';
import {
  readFeedbackCapabilities,
  readFeedbackPage,
  readFeedbackDetail,
  readFeedbackReceipt,
  validFeedbackMediaSession,
  validateFeedbackCreate,
  markFeedbackRead,
  removeFeedbackImage,
} from '../src/feedback.mjs';
import tools from '../remote/tool-catalog.json' with { type: 'json' };

const epoch = 'account-epoch';
const draft = () => ({
  type: 'BugReport',
  category: 'sync',
  title: 'The task list did not show the saved edit',
  description:
    'The web page showed the saved title; the open phone still showed its previous title.',
  attachments: [],
});
const command = () => ({
  ...draft(),
  commandId: randomUUID(),
  draftId: randomUUID(),
  expectedEpoch: epoch,
  issuedAt: Date.now(),
});
const capabilities = () => ({
  epoch,
  canReportBug: true,
  canRequestFeature: false,
  canRead: false,
  canReply: false,
  maxImages: 3,
  maxUploadBytes: 4000000,
  unread: 0,
});
const receipt = (value, extra = {}) => ({
  id: value.draftId,
  commandId: value.commandId,
  receivedAt: new Date().toISOString(),
  duplicate: false,
  ...extra,
});
const summary = (id) => ({
  id,
  owner: 'owner',
  type: 'BugReport',
  title: 'The task list did not show the saved edit',
  category: 'sync',
  status: 'under_review',
  resolution: null,
  source: 'agent',
  createdAt: '2026-11-16T10:00:00Z',
  updatedAt: '2026-11-16T10:00:00Z',
  revision: '2',
  unread: true,
});
const detail = (id, messages = []) => ({
  summary: summary(id),
  epoch,
  description: 'Observed behavior',
  context: {},
  attachments: [],
  messages,
});
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP438DwHwAGgAJ/EEwb4QAAAABJRU5ErkJggg==',
  'base64',
);
const media = (value, state = 'pending') => {
  const path = `/api/agents/v1/feedback/media/${value.id}/content`;
  return {
    assetId: value.id,
    draftId: value.draftId,
    state,
    uploadPath: path,
    image:
      state === 'pending'
        ? null
        : {
            assetId: value.id,
            contentType: 'image/webp',
            fileName: 'screenshot.webp',
            size: 80,
            width: 1,
            height: 1,
            readPath: path,
          },
  };
};

test('Free bug preparation reads epoch once, sends only on explicit submit and recovers its receipt without Starter/Pro reads', async (t) => {
  const calls = [];
  let sent;
  const f = await fixture(t, async (url, options) => {
    calls.push({ path: url.pathname, method: options.method });
    if (url.pathname.endsWith('/capabilities')) {
      return Response.json(capabilities());
    }
    if (url.pathname.includes('/receipts/')) {
      return Response.json(receipt(sent));
    }
    sent = JSON.parse(options.body);
    return Response.json(receipt(sent));
  });
  const journal = new CommandJournal(f.client);
  const prepared = await journal.prepareFeedback(draft());
  assert.equal(prepared.applied, false);
  assert.equal(prepared.command.expectedEpoch, epoch);
  assert.deepEqual(calls, [{ path: '/api/agents/v1/feedback/capabilities', method: 'GET' }]);
  assert.equal((await journal.inspect(prepared.command.commandId)).state, 'prepared');
  assert.equal((await journal.submitFeedback(prepared.command)).source, 'server');
  assert.deepEqual(sent, prepared.command);
  assert.equal((await journal.retry(sent.commandId)).source, 'local_receipt');
  assert.equal(calls.length, 2);
  assert.equal((await readFeedbackReceipt(f.client, { id: sent.commandId })).id, sent.draftId);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((entry) => !entry.path.includes('/detail/')));
});

test('preparation distinguishes a missing personal write grant from paid feature eligibility', async (t) => {
  let canReportBug = false;
  const f = await fixture(t, async () => Response.json({ ...capabilities(), canReportBug }));
  const journal = new CommandJournal(f.client);
  await assert.rejects(journal.prepareFeedback(draft()), { code: 'agent_permission_denied' });
  canReportBug = true;
  await assert.rejects(journal.prepareFeedback({ ...draft(), type: 'FeatureRequest' }), {
    code: 'feedback_premium_required',
  });
});

test('explicit epoch prepares offline, and preparing across a changed connection is fenced', async (t) => {
  const f = await fixture(t, async () => {
    throw Error('No network expected');
  });
  const journal = new CommandJournal(f.client);
  const prepared = await journal.prepareFeedback({ ...draft(), expectedEpoch: epoch });
  assert.equal(prepared.command.expectedEpoch, epoch);
  f.client.feedbackRead = async () => {
    await f.store.write({ ...credentials(tokens(), origin), session_id: 'replacement' });
    return capabilities();
  };
  await assert.rejects(journal.prepareFeedback(draft()), { code: 'operation_identity_mismatch' });
});

test('lost feedback response reuses immutable saved command; duplicate receipts may identify the original request', async (t) => {
  const input = command(),
    calls = [],
    originalId = randomUUID();
  const f = await fixture(t, async (url, options) => {
    calls.push({ path: url.pathname, body: options.body });
    if (calls.length === 1) {
      throw Error('lost response');
    }
    return Response.json(receipt(input, { id: originalId, duplicate: true }));
  });
  const journal = new CommandJournal(f.client);
  await assert.rejects(journal.submitFeedback(input), { code: 'network_unavailable' });
  await assert.rejects(journal.submitFeedback({ ...input, title: 'Different issue' }), {
    code: 'idempotency_mismatch',
  });
  assert.equal(calls.length, 1);
  const saved = await journal.retry(input.commandId);
  assert.equal(saved.receipt.id, originalId);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal((await journal.retry(input.commandId)).source, 'local_receipt');
  assert.equal(calls.length, 2);
  await f.store.write({ ...credentials(tokens(), origin), session_id: 'replacement' });
  await assert.rejects(journal.retry(input.commandId), { code: 'operation_identity_mismatch' });
});

test('forged response identities never confirm a submit, and no private or unrelated fields enter requests', async (t) => {
  const input = command();
  const f = await fixture(t, async () => Response.json(receipt(input, { id: randomUUID() })));
  const journal = new CommandJournal(f.client);
  await assert.rejects(journal.submitFeedback(input), { code: 'invalid_response' });
  assert.equal((await journal.inspect(input.commandId)).state, 'uncertain');
  for (const extra of [
    { owner: 'other-owner' },
    { status: 'closed' },
    { attachments: ['a', 'a'] },
    { attachments: ['a', 'b', 'c', 'd'] },
    { title: ' ' },
    { context: { healthData: 'private' } },
  ]) {
    assert.throws(() => validateFeedbackCreate({ ...input, ...extra }), {
      code: 'invalid_arguments',
    });
  }
});

test('Starter/Pro decision reads stay bounded and expose only the final team message', async (t) => {
  const id = randomUUID();
  const message = (author, text) => ({
    id: randomUUID(),
    author,
    text,
    createdAt: '2026-11-16T10:00:01Z',
    attachments: [],
  });
  const final = message('team', 'Resolved. The corrected version is available.');
  const calls = [];
  const f = await fixture(t, async (url, options) => {
    calls.push({ path: url.pathname, method: options.method });
    return Response.json(
      url.pathname.includes('/detail/')
        ? detail(id, [final])
        : { entries: [summary(id)], next: null },
    );
  });
  assert.equal(
    (await readFeedbackPage(f.client, { status: 'under_review', type: 'BugReport' })).entries
      .length,
    1,
  );
  const result = await readFeedbackDetail(f.client, { id });
  assert.equal(result.summary.id, id);
  assert.deepEqual(result.messages, [final]);
  assert.equal(calls[1].path, `/api/agents/v1/feedback/detail/${id}`);
  assert.ok(calls.every((call) => call.method === 'GET'));
  f.client.feedbackRead = async () => detail(id, [message('user', 'Old reply only')]);
  await assert.rejects(readFeedbackDetail(f.client, { id }), { code: 'invalid_response' });
  await assert.rejects(readFeedbackPage(f.client, { owner: 'other-owner' }), {
    code: 'invalid_arguments',
  });
  f.client.feedbackRead = async () => ({ ...detail(id), notes: ['private admin note'] });
  await assert.rejects(readFeedbackDetail(f.client, { id }), { code: 'invalid_response' });
  f.client.feedbackRead = async () => ({
    entries: Array.from({ length: 51 }, () => summary(randomUUID())),
    next: null,
  });
  await assert.rejects(readFeedbackPage(f.client, {}), { code: 'invalid_response' });
});

test('rolling-upgrade capabilities cannot re-enable a feedback conversation', async (t) => {
  const f = await fixture(t, async () =>
    Response.json({ ...capabilities(), canRead: true, canReply: true }),
  );
  assert.deepEqual(await readFeedbackCapabilities(f.client), {
    ...capabilities(),
    canRead: true,
    canReply: false,
  });
});

test('feedback media shares safe source transfer, server-compressed receipt, exact retry and no source persistence', async (t) => {
  let prepared,
    transfers = 0;
  const f = await fixture(t, async (url, options) => {
    if (url.pathname.endsWith('/uploads')) {
      assert.deepEqual(JSON.parse(options.body), prepared);
      return Response.json(media(prepared));
    }
    assert.equal(url.pathname, `/api/agents/v1/feedback/media/${prepared.id}/content`);
    assert.equal(options.method, 'PUT');
    assert.deepEqual(options.body, png);
    if (++transfers === 1) {
      throw Error('lost binary response');
    }
    return Response.json(media(prepared, 'ready'));
  });
  const file = join(f.directory, 'screen.png');
  await writeFile(file, png);
  prepared = await prepareFeedbackImage({ draftId: randomUUID(), expectedEpoch: epoch, file });
  const journal = new CommandJournal(f.client);
  assert.equal((await journal.openFeedbackMedia(prepared)).receipt.state, 'pending');
  await assert.rejects(uploadFeedbackImage(f.client, { operationId: prepared.id, file }), {
    code: 'network_unavailable',
  });
  await writeFile(file, Buffer.concat([png, Buffer.from('changed')]));
  await assert.rejects(uploadFeedbackImage(f.client, { operationId: prepared.id, file }), {
    code: 'idempotency_mismatch',
  });
  assert.equal(transfers, 1);
  await writeFile(file, png);
  assert.equal(
    (await uploadFeedbackImage(f.client, { operationId: prepared.id, file })).state,
    'ready',
  );
  await rm(file);
  assert.equal(
    (await uploadFeedbackImage(f.client, { operationId: prepared.id, file })).state,
    'ready',
  );
  assert.equal(transfers, 2);
  const saved = await readFile(journal.store(prepared.id).path, 'utf8');
  assert.equal(saved.includes(file), false);
  assert.equal(saved.includes(png.toString('base64')), false);
});

test('feedback screenshot receipts cannot redirect upload, attach foreign drafts or bypass normalization', async (t) => {
  const f = await fixture(t, async () => {
    throw Error('No network expected');
  });
  const file = join(f.directory, 'screen.png');
  await writeFile(file, png);
  const input = await prepareFeedbackImage({ draftId: randomUUID(), expectedEpoch: epoch, file });
  const ready = media(input, 'ready');
  assert.equal(validFeedbackMediaSession(ready, input), true);
  for (const extra of [
    { uploadPath: 'https://evil.example/content' },
    { draftId: randomUUID() },
    { image: { ...ready.image, width: 1081 } },
    { image: { ...ready.image, size: 1000001 } },
    { image: { ...ready.image, contentType: 'image/png' } },
    { image: { ...ready.image, readPath: '/private' } },
  ]) {
    assert.equal(validFeedbackMediaSession({ ...ready, ...extra }, input), false);
  }
});

test('CLI and actual MCP expose feedback workflow, immutable writes and shared inspect/retry', async (t) => {
  const f = await fixture(t, async (url, options) => {
    if (url.pathname.endsWith('/capabilities')) {
      return Response.json(capabilities());
    }
    return Response.json(receipt(JSON.parse(options.body)));
  });
  const input = { ...draft(), expectedEpoch: epoch };
  const file = join(f.directory, 'report.json');
  await writeFile(file, JSON.stringify(input));
  const run = async (args) => {
    let stdout = '',
      stderr = '';
    const code = await main([...args, '--origin', origin, '--allow-local', '--json'], {
      directory: f.directory,
      fetchImpl: f.transport.fetch,
      stdout: {
        write: (s) => {
          stdout += s;
        },
      },
      stderr: {
        write: (s) => {
          stderr += s;
        },
      },
    });
    assert.equal(code, 0, stderr);
    return JSON.parse(stdout).data;
  };
  const help = await run(['help']);
  assert.doesNotMatch(JSON.stringify(help), /feedback reply/);
  const prepared = await run(['feedback', 'prepare', '--file', file]);
  await writeFile(file, JSON.stringify(prepared.command));
  assert.equal((await run(['feedback', 'submit', '--file', file])).source, 'server');
  assert.equal(
    (await run(['commands', 'retry', '--operation', prepared.command.commandId])).source,
    'local_receipt',
  );
  const server = createMcpServer(f.client),
    client = new Client({ name: 'feedback-review', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  try {
    const list = (await client.listTools()).tools;
    assert.equal(
      list.some((tool) => tool.name === 'tasker_feedback_reply'),
      false,
    );
    assert.equal(
      list.find((t) => t.name === 'tasker_feedback_submit').annotations.destructiveHint,
      false,
    );
    assert.equal(
      list.find((t) => t.name === 'tasker_feedback_prepare').annotations.readOnlyHint,
      false,
    );
    assert.ok(list.some((t) => t.name === 'tasker_feedback_media_upload'));
    const guide = await client.callTool({
      name: 'tasker_workflow',
      arguments: { topic: 'feedback' },
    });
    assert.equal(guide.isError, undefined);
    const value = await client.callTool({ name: 'tasker_feedback_prepare', arguments: input });
    assert.equal(value.isError, undefined);
    const sent = await client.callTool({
      name: 'tasker_feedback_submit',
      arguments: value.structuredContent.data.command,
    });
    assert.equal(sent.structuredContent.data.source, 'server');
    assert.equal(
      (
        await client.callTool({
          name: 'tasker_feedback_submit',
          arguments: { ...input, owner: 'other-owner' },
        })
      ).isError,
      true,
    );
  } finally {
    await client.close();
    await server.close();
  }
});

test('nullable technical context round-trips without accepting private extra fields', async (t) => {
  const input = {
    ...command(),
    context: {
      appVersion: null,
      buildNumber: null,
      errorCode: null,
      locale: 'fr',
      platform: null,
      requestId: null,
      screen: null,
    },
  };
  assert.deepEqual(validateFeedbackCreate(input), input);
  let sent;
  const f = await fixture(t, async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json(receipt(input));
  });
  await new CommandJournal(f.client).submitFeedback(input);
  assert.deepEqual(sent.context, input.context);
  assert.throws(
    () =>
      validateFeedbackCreate({ ...input, context: { ...input.context, privateProjectLog: null } }),
    { code: 'invalid_arguments' },
  );
});

test('scope-free capability discovery reports effective denied rights without granting receipt or history access', async (t) => {
  const expected = {
    ...capabilities(),
    canReportBug: false,
    canRequestFeature: false,
    canRead: false,
    canReply: false,
    unread: 0,
  };
  const calls = [];
  const f = await fixture(t, async (url) => {
    calls.push(url.pathname);
    return Response.json(expected);
  });
  assert.deepEqual(await readFeedbackCapabilities(f.client), expected);
  assert.deepEqual(calls, ['/api/agents/v1/feedback/capabilities']);
  assert.deepEqual(tools.find((tool) => tool.name === 'tasker_feedback_capabilities').scopes, []);
  assert.deepEqual(tools.find((tool) => tool.name === 'tasker_feedback_receipt').scopes, [
    'feedback:write',
  ]);
  assert.deepEqual(
    tools.find((tool) => tool.name === 'tasker_feedback_list').inputSchema.properties.status.enum,
    ['received', 'under_review', 'planned', 'in_progress', 'closed'],
  );
});

test('feedback catalog removes replies and keeps submission and decision grants separate', () => {
  assert.equal(
    tools.some((tool) => tool.name === 'tasker_feedback_reply'),
    false,
  );
  assert.deepEqual(tools.find((tool) => tool.name === 'tasker_feedback_detail').scopes, [
    'feedback:read',
  ]);
  assert.deepEqual(tools.find((tool) => tool.name === 'tasker_feedback_submit').scopes, [
    'feedback:write',
  ]);
  assert.deepEqual(tools.find((tool) => tool.name === 'tasker_feedback_receipt').scopes, [
    'feedback:write',
  ]);
});

test('exact decision read markers, image removal and bounded private downloads preserve their routes', async (t) => {
  const id = randomUUID(),
    calls = [];
  let oversized = false;
  const f = await fixture(t, async (url, options) => {
    calls.push({ path: url.pathname, method: options.method, body: options.body });
    if (url.pathname.endsWith('/content')) {
      return new Response(oversized ? Buffer.alloc(1_000_001) : png);
    }
    return new Response(null, { status: 204 });
  });
  const input = { id, request: { expectedEpoch: epoch, revision: '9' } };
  assert.deepEqual(await markFeedbackRead(f.client, input), { id, revision: '9', read: true });
  assert.deepEqual(JSON.parse(calls[0].body), input.request);
  assert.equal(calls[0].path, `/api/agents/v1/feedback/${id}/read`);
  assert.deepEqual(await removeFeedbackImage(f.client, { id }), { id, removed: true });
  assert.equal(calls[1].method, 'DELETE');
  assert.equal(calls[1].path, `/api/agents/v1/feedback/media/${id}`);
  const file = join(f.directory, 'download.webp');
  assert.equal((await downloadFeedbackImage(f.client, { id, file })).bytes, png.length);
  assert.deepEqual(await readFile(file), png);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  await assert.rejects(downloadFeedbackImage(f.client, { id, file }), { code: 'EEXIST' });
  assert.deepEqual(await readFile(file), png, 'existing files are never overwritten');
  oversized = true;
  await assert.rejects(
    downloadFeedbackImage(f.client, { id, file: join(f.directory, 'oversized.webp') }),
    { code: 'invalid_response' },
  );
  await assert.rejects(stat(join(f.directory, 'oversized.webp')), { code: 'ENOENT' });
  const before = calls.length;
  await assert.rejects(markFeedbackRead(f.client, { ...input, owner: 'someone-else' }), {
    code: 'invalid_arguments',
  });
  for (const path of [
    `/api/agents/v1/feedback/media/${id}/content?owner=other`,
    '/api/agents/v1/feedback/media/../../content',
    '/api/agents/v1/feedback/media/not-a-uuid/content',
  ]) {
    await assert.rejects(f.transport.request(path, { binary: true }), {
      code: 'invalid_arguments',
    });
  }
  await assert.rejects(
    f.transport.request(`/api/agents/v1/feedback/media/${id}/content`, {
      method: 'PUT',
      bytes: Buffer.alloc(4_000_001),
    }),
    { code: 'invalid_arguments' },
  );
  assert.equal(calls.length, before, 'invalid metadata and binary routes fail before a request');
});

test('local screenshot preparation refuses oversized and nonregular sources without networking', async (t) => {
  const f = await fixture(t, async () => {
    throw Error('No request expected');
  });
  const file = join(f.directory, 'image.png'),
    link = join(f.directory, 'link.png');
  await writeFile(file, png);
  await symlink(file, link);
  const input = { draftId: randomUUID(), expectedEpoch: epoch };
  await assert.rejects(prepareFeedbackImage({ ...input, file: link }), {
    code: 'invalid_arguments',
  });
  await assert.rejects(prepareFeedbackImage({ ...input, file: f.directory }), {
    code: 'invalid_arguments',
  });
  await writeFile(file, Buffer.alloc(4_000_001));
  await assert.rejects(prepareFeedbackImage({ ...input, file }), {
    code: 'feedback_media_too_large',
  });
});
