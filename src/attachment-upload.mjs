import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import { CredentialStore } from './store.mjs';
import { AgentError, fail } from './errors.mjs';
import { operationIdSchema } from './commands.mjs';

const partBytes = 8 * 1024 * 1024,
  directBytes = 15_000_000;
export const ticketUploadInput = z
  .object({
    scope: z.string().regex(/^project:[A-Za-z0-9_-]{1,128}$/),
    taskId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    attachmentId: z.string().uuid(),
    epoch: z.string().min(1).max(128),
    replaceRevision: z
      .string()
      .regex(/^[1-9][0-9]{0,31}$/)
      .optional(),
    file: z.string().min(1).max(4096),
    contentType: z.string().min(1).max(128),
  })
  .strict();
const binding = (s) => [s.origin, s.connection_id, s.profile_id, s.session_id];
const digest = (b) => createHash('sha256').update(b).digest('hex');
const route = (op) => '/api/agents/v1/attachment-uploads/' + op;
function storeFor(client, id) {
  if (!operationIdSchema.safeParse(id).success) {
    fail('invalid_arguments', 'Use a prepared upload ID.');
  }
  return new CredentialStore({
    directory: join(client.store.directory, 'attachments', client.store.context),
    context: id,
  });
}
async function withFile(file, run) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 200_000_000) {
      fail('invalid_arguments', 'Choose one regular ticket attachment of at most 200 MB.');
    }
    return await run(handle, stat.size);
  } catch (error) {
    if (error instanceof AgentError) {
      throw error;
    }
    if (['ENOENT', 'ELOOP', 'EACCES', 'EISDIR'].includes(error.code)) {
      fail('invalid_arguments', 'The selected local attachment is unavailable.');
    }
    throw error;
  } finally {
    await handle?.close();
  }
}
async function readPart(handle, position, length) {
  const data = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const { bytesRead } = await handle.read(data, read, length - read, position + read);
    if (!bytesRead) {
      fail('file_changed', 'The source file changed. Prepare the new file explicitly.');
    }
    read += bytesRead;
  }
  return data;
}
export async function prepareTicketUpload(client, raw) {
  const validation = ticketUploadInput.safeParse(raw);
  if (!validation.success) {
    fail('invalid_arguments', 'Specify the project, task and attachment and a regular local file.');
  }
  const { file, scope, taskId, attachmentId, epoch, replaceRevision, contentType } =
    validation.data;
  const session = await client.authorizedSession(),
    path = resolve(file),
    id = randomUUID(),
    fileName = basename(path);
  if (fileName.length > 200) {
    fail('invalid_arguments', 'Choose a filename of at most 200 characters.');
  }
  return withFile(path, async (handle, size) => {
    const hash = createHash('sha256'),
      hashes = [];
    for (let at = 0; at < size; at += partBytes) {
      const part = await readPart(handle, at, Math.min(partBytes, size - at));
      hash.update(part);
      hashes.push(digest(part));
    }
    const input = {
      id,
      issuedAt: Date.now(),
      scope,
      taskId,
      attachmentId,
      expectedEpoch: epoch,
      ...(replaceRevision ? { replaceRevision } : {}),
      size,
      sha256: hash.digest('hex'),
      fileName,
      contentType,
      kind: 'project',
      purpose: 'ticketAttachment',
    };
    const store = storeFor(client, id);
    await store.locked(() => store.write({ binding: binding(session), input, hashes, path }));
    return { operationId: id, fileName, size, scope, taskId, attachmentId, prepared: true };
  });
}
export async function uploadTicketAttachment(client, id) {
  const store = storeFor(client, id);
  return store.locked(async () => {
    const saved = await store.read(),
      session = await client.authorizedSession();
    if (
      saved?.input?.id !== id ||
      JSON.stringify(saved.binding) !== JSON.stringify(binding(session))
    ) {
      fail('media_context_changed', 'Resume in the original authorized context.');
    }
    const input = saved.input,
      token = session.access_token;
    const request = (op, options = {}) =>
      client.transport.request(route(op), { ...options, token });
    const opened = await request('sessions', { method: 'POST', json: input });
    if (
      opened?.id !== id ||
      opened.size !== input.size ||
      !/^[-_a-zA-Z0-9]{1,128}$/.test(opened.ownerId) ||
      typeof opened.published !== 'boolean'
    ) {
      fail('invalid_response', 'The session does not match this upload.');
    }
    const query = {
      scope: input.scope,
      taskId: input.taskId,
      attachmentId: input.attachmentId,
      ownerId: opened.ownerId,
      id,
      ...(input.replaceRevision ? { replaceRevision: input.replaceRevision } : {}),
    };
    const receipt = {
      scope: input.scope,
      taskId: input.taskId,
      attachmentId: input.attachmentId,
      assetId: id,
      published: true,
    };
    if (opened.published) {
      return receipt;
    }
    await withFile(saved.path, async (handle, size) => {
      if (size !== input.size) {
        fail('file_changed', 'Prepare the changed source file again.');
      }
      if (size <= directBytes) {
        const bytes = await readPart(handle, 0, size);
        if (digest(bytes) !== input.sha256) {
          fail('file_changed', 'Prepare the changed source file again.');
        }
        await request('content', { method: 'PUT', query, bytes });
        return;
      }
      const state = await request('parts', { query });
      if (
        state?.partSize !== partBytes ||
        !Array.isArray(state.parts) ||
        state.parts.some((v) => !Number.isInteger(v) || v < 1 || v > saved.hashes.length) ||
        new Set(state.parts).size !== state.parts.length ||
        typeof state.complete !== 'boolean'
      ) {
        fail('invalid_response', 'The upload part index is invalid.');
      }
      if (state.complete) {
        return;
      }
      for (let n = 1; n <= saved.hashes.length; n++) {
        if (state.parts.includes(n)) {
          continue;
        }
        const at = (n - 1) * partBytes,
          bytes = await readPart(handle, at, Math.min(partBytes, size - at)),
          partSha256 = digest(bytes);
        if (partSha256 !== saved.hashes[n - 1]) {
          fail('file_changed', 'Prepare the changed source file again.');
        }
        await request('parts/' + n, { method: 'PUT', query, bytes, partSha256 });
      }
      const completed = await request('complete', { method: 'POST', query });
      if (!completed?.complete) {
        fail('media_not_published', 'The transfer has not completed. Resume the same upload.');
      }
    });
    const published = await request('publish', { method: 'POST', query });
    if (!published?.published || published.id !== id || published.ownerId !== opened.ownerId) {
      fail('media_not_published', 'Resume the same upload and verify its publication.');
    }
    return receipt;
  });
}
