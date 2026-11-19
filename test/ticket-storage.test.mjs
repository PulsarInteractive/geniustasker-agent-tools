import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareTicketUpload, uploadTicketAttachment } from '../src/attachment-upload.mjs';
import { ticketStorageRequest } from '../src/ticket-storage.mjs';
import { CredentialStore } from '../src/store.mjs';

const target = { scope: 'project:synthetic', taskId: 'task', attachmentId: randomUUID() };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('one selected item and unchanged receipt identify an attachment operation', async () => {
  const requests = [];
  const cli = {
    get: async (route, q) => ({ route, q }),
    accessToken: async () => 'fixture',
    transport: {
      request: async (route, options) => {
        requests.push([route, options.json]);
        return { ...options.json, revision: '4', releasedBytes: 0, pendingRelease: true };
      },
    },
  };
  const data = {
    ...target,
    action: 'replace',
    epoch: 'synthetic',
    expectedRevision: '3',
    operationId: randomUUID(),
    issuedAt: Date.now(),
    assetId: randomUUID(),
  };
  assert.equal((await ticketStorageRequest(cli, 'attachment replace', data)).revision, '4');
  const refused = (e) => e.code === 'invalid_arguments';
  await assert.rejects(
    ticketStorageRequest(cli, 'storage selection', { scope: target.scope, taskIds: ['a', 'b'] }),
    refused,
  );
  await assert.rejects(
    ticketStorageRequest(cli, 'storage selection', {
      scope: target.scope,
      taskIds: ['a'],
      attachmentIds: ['a'],
    }),
    refused,
  );
  await assert.rejects(
    ticketStorageRequest(cli, 'attachment remove', { ...data, action: 'remove' }),
    refused,
  );
  await assert.rejects(
    ticketStorageRequest(cli, 'attachment remove', { ...data, action: 'replace' }),
    refused,
  );
  await assert.rejects(
    ticketStorageRequest(cli, 'attachment replace', { ...data, assetId: undefined }),
    refused,
  );
  assert.equal(requests.length, 1);
  cli.transport.request = async () => ({
    ...data,
    operationId: randomUUID(),
    revision: '4',
    releasedBytes: 0,
    pendingRelease: false,
  });
  await assert.rejects(
    ticketStorageRequest(cli, 'attachment replace', data),
    (e) => e.code === 'invalid_response',
  );
});

test('interrupt and resume verified 8 MiB parts and retain the original until an explicit attachment change', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-attachment-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'training.mp4'),
    bytes = Buffer.alloc(17_000_000, 37);
  await writeFile(file, bytes);
  const session = {
    origin: 'https://test.invalid',
    connection_id: 'c',
    profile_id: 'p',
    session_id: 's',
    access_token: 'fixture',
  };
  const parts = new Map();
  let cutoff = true,
    published = false,
    links = 0;
  const input = {
    ...target,
    file,
    epoch: 'synthetic',
    replaceRevision: '4',
    contentType: 'video/mp4',
  };
  const requests = [];
  const client = () => ({
    store: new CredentialStore({ directory: join(directory, 'creds') }),
    authorizedSession: async () => session,
    transport: {
      request: async (path, options) => {
        const route = path.split('attachment-uploads/')[1];
        requests.push(route);
        assert.equal(options.token, 'fixture');
        if (route === 'sessions') {
          assert.equal(options.json.sha256, hash(bytes));
          assert.equal(options.json.replaceRevision, '4');
          assert.equal(options.json.fileName, 'training.mp4');
          return { id: options.json.id, size: bytes.length, ownerId: 'owner', published };
        }
        assert.equal(options.query.attachmentId, target.attachmentId);
        assert.equal(options.query.replaceRevision, '4');
        if (route === 'parts') {
          return { parts: [...parts.keys()], partSize: 8388608, complete: false };
        }
        if (route.startsWith('parts/')) {
          const n = Number(route.slice(6));
          assert.equal(options.partSha256, hash(options.bytes));
          if (n === 2 && cutoff) {
            cutoff = false;
            throw Error('fixture disconnect');
          }
          parts.set(n, Buffer.from(options.bytes));
          return { complete: false };
        }
        if (route === 'complete') {
          assert.equal(hash(Buffer.concat([...parts.values()])), hash(bytes));
          return { complete: true };
        }
        if (route === 'publish') {
          published = true;
          return { id: options.query.id, ownerId: 'owner', published };
        }
        links++;
        throw Error('Unexpected task mutation');
      },
    },
  });
  const prepared = await prepareTicketUpload(client(), input);
  await assert.rejects(
    uploadTicketAttachment(client(), prepared.operationId),
    /fixture disconnect/,
  );
  assert.deepEqual([...parts.keys()], [1]);
  assert.equal(
    (await uploadTicketAttachment(client(), prepared.operationId)).assetId,
    prepared.operationId,
  );
  assert.equal(requests.filter((op) => op === 'parts/1').length, 1);
  await unlink(file);
  assert.equal((await uploadTicketAttachment(client(), prepared.operationId)).published, true);
  assert.equal(links, 0);
  session.profile_id = 'another';
  await assert.rejects(
    uploadTicketAttachment(client(), prepared.operationId),
    (e) => e.code === 'media_context_changed',
  );
});

test('changed local original fails before bytes or a replacement are sent', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-changed-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'note.txt');
  await writeFile(file, 'v1');
  const calls = [];
  const client = {
    store: new CredentialStore({ directory: join(directory, 'creds') }),
    authorizedSession: async () => ({
      origin: 'https://fixture.invalid',
      connection_id: 'a',
      profile_id: 'b',
      session_id: 'c',
      access_token: 'test',
    }),
    transport: {
      request: async (route, options) => {
        calls.push(route);
        return { id: options.json.id, size: 2, ownerId: 'owner', published: false };
      },
    },
  };
  const prepared = await prepareTicketUpload(client, {
    ...target,
    file,
    epoch: 'synthetic',
    contentType: 'text/plain',
  });
  await writeFile(file, 'v2');
  await assert.rejects(
    uploadTicketAttachment(client, prepared.operationId),
    (e) => e.code === 'file_changed',
  );
  assert.equal(calls.length, 1);
});
