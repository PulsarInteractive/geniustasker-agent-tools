import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaJournal, downloadMedia } from '../src/media.mjs';
import { Transport } from '../src/transport.mjs';

test('media retry keeps one identity, rejects changed bytes and never follows server upload URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-media-'));
  try {
    const file = join(directory, 'drawing.txt');
    await writeFile(file, 'drawing');
    const calls = [];
    let opened,
      published = false,
      lost = true;
    const session = {
      origin: 'https://api.example.test',
      connection_id: 'one',
      profile_id: 'profile',
      session_id: 'terminal',
      access_token: 'synthetic',
    };
    const client = {
      store: { directory, context: 'test' },
      authorizedSession: async () => session,
      transport: {
        request: async (path, input) => {
          calls.push({ path, ...input });
          if (path.endsWith('/sessions')) {
            opened ??= input.json;
            assert.deepEqual(input.json, opened);
            return {
              id: opened.id,
              ownerId: 'owner',
              size: opened.size,
              published,
              uploadPath: 'https://untrusted.example/upload',
            };
          }
          if (path.endsWith('/content')) {
            assert.equal(input.bytes.toString(), 'drawing');
            if (lost) {
              lost = false;
              throw Error('lost response');
            }
            return null;
          }
          published = true;
          return { id: opened.id, ownerId: 'owner', size: opened.size, published: true };
        },
      },
    };
    const journal = new MediaJournal(client),
      operation = await journal.prepare({
        scope: 'memory:one',
        epoch: 'epoch',
        file,
        contentType: 'text/plain',
      });
    await assert.rejects(journal.upload(operation.operationId), /lost/);
    const result = await journal.upload(operation.operationId);
    assert.equal(result.published, true);
    assert.equal((await journal.upload(operation.operationId)).assetId, result.assetId);
    assert.ok(calls.every((c) => c.path.startsWith('/api/agents/v1/media/')));
    await writeFile(file, 'changed');
    await assert.rejects(journal.upload(operation.operationId), { code: 'file_changed' });
    await writeFile(file, 'drawing');
    session.profile_id = 'another';
    await assert.rejects(journal.upload(operation.operationId), { code: 'media_context_changed' });
    const link = join(directory, 'link');
    await symlink(file, link);
    await assert.rejects(
      journal.prepare({
        scope: 'memory:one',
        epoch: 'epoch',
        file: link,
        contentType: 'text/plain',
      }),
      { code: 'invalid_arguments' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('private downloads are explicit, exclusive files; binary transport is bounded and uses delegated routes only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-download-'));
  try {
    const transport = new Transport('https://api.example.test', {
      fetchImpl: async () => new Response('safe bytes'),
    });
    const client = { transport, accessToken: async () => 'synthetic' };
    const input = {
      scope: 'memory:one',
      ownerId: 'owner',
      id: '12345678-1234-1234-1234-123456789012',
      file: join(directory, 'copy'),
    };
    await downloadMedia(client, input);
    assert.equal(await readFile(input.file, 'utf8'), 'safe bytes');
    await assert.rejects(downloadMedia(client, input), { code: 'EEXIST' });
    await assert.rejects(
      transport.request('/api/agents/v1/commands', { bytes: Buffer.from('no') }),
      { code: 'invalid_arguments' },
    );
    await assert.rejects(
      transport.request('/api/agents/v1/media/content', { bytes: Buffer.alloc(15000001) }),
      { code: 'invalid_arguments' },
    );
    const oversized = new Transport('https://api.example.test', {
      fetchImpl: async () => new Response(Buffer.alloc(15000001)),
    });
    await assert.rejects(oversized.request('/api/agents/v1/media/content', { binary: true }), {
      code: 'invalid_response',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('project photos stage in their own project, resume the same ID and leave linking to the reviewed command', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tasker-project-photo-'));
  try {
    const file = join(directory, 'cover.png');
    await writeFile(file, Buffer.from('89504e470d0a1a0a', 'hex'));
    let input;
    let published = false;
    const calls = [];
    const client = {
      store: { directory, context: 'project-photo-test' },
      authorizedSession: async () => ({
        origin: 'https://api.example.test',
        connection_id: 'grant',
        profile_id: 'profile',
        session_id: 'session',
        access_token: 'synthetic',
      }),
      transport: {
        request: async (path, options) => {
          calls.push(path);
          if (path.endsWith('/sessions')) {
            input = options.json;
            assert.equal(input.scope, 'project:chosen');
            assert.equal(input.kind, 'project');
            assert.equal(input.purpose, 'projectPhoto');
          } else if (path.endsWith('/content')) {
            assert.equal(options.query.scope, 'project:chosen');
            assert.equal(options.bytes.length, 8);
          } else {
            assert.equal(options.json.scope, 'project:chosen');
            assert.equal(options.json.action, 'publish');
            published = true;
          }
          return { id: input.id, size: input.size, ownerId: 'owner', published };
        },
      },
    };
    const journal = new MediaJournal(client);
    const args = {
      scope: 'project:chosen',
      epoch: 'read-project-epoch',
      file,
      contentType: 'image/png',
      purpose: 'projectPhoto',
    };
    for (const invalid of [
      { ...args, purpose: undefined },
      { ...args, contentType: 'text/plain' },
      { ...args, scope: 'memory:chosen' },
    ]) {
      await assert.rejects(journal.prepare(invalid), { code: 'invalid_arguments' });
    }
    const { operationId } = await journal.prepare(args);
    assert.equal(calls.length, 0);
    assert.equal((await journal.upload(operationId)).assetId, operationId);
    assert.equal((await journal.upload(operationId)).assetId, operationId);
    assert.equal(calls.filter((x) => x.endsWith('/content')).length, 1);
    assert.ok(calls.every((x) => x.startsWith('/api/agents/v1/media/')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
