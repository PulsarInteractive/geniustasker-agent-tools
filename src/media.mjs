import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import * as z from 'zod/v4';
import { CredentialStore } from './store.mjs';
import { operationIdSchema } from './commands.mjs';
import { AgentError, fail } from './errors.mjs';

const mediaScope = z.string().regex(/^memory:[a-zA-Z0-9_-]{1,128}$/);
const types = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'text/plain',
];
export const mediaPrepareSchema = z
  .object({
    scope: mediaScope,
    file: z.string().min(1).max(4096),
    contentType: z.enum(types),
    epoch: z.string().min(1).max(128),
  })
  .strict();
export const mediaActionSchema = z
  .object({
    scope: mediaScope,
    ownerId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    id: operationIdSchema,
    action: z.enum(['inspect', 'publish', 'cancel', 'remove']),
  })
  .strict();
export const mediaDownloadSchema = mediaActionSchema
  .omit({ action: true })
  .extend({ file: z.string().min(1).max(4096) })
  .strict();
export const mediaCompareSchema = mediaDownloadSchema.omit({ ownerId: true });
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail(
      'invalid_arguments',
      'Invalid media arguments. Supply the Memory scope, epoch and a supported private file.',
    );
  }
  return result.data;
};
async function fileBytes(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 15000000) {
      fail('invalid_arguments', 'Use a regular file between 1 and 15,000,000 bytes.');
    }
    const bytes = Buffer.alloc(15000001);
    let size = 0;
    while (size < bytes.length) {
      const result = await handle.read(bytes, size, bytes.length - size, size);
      if (!result.bytesRead) {
        break;
      }
      size += result.bytesRead;
    }
    if (size > 15000000 || size !== stat.size) {
      fail('file_changed', 'The file changed while reading. Prepare it again.');
    }
    return bytes.subarray(0, size);
  } catch (error) {
    if (error instanceof AgentError) {
      throw error;
    }
    fail('invalid_arguments', 'Could not read a regular local media file.');
  } finally {
    await handle?.close();
  }
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Compare an explicitly selected local file with an existing authorized asset.
 * Current publications expose their verified digest, so equal images need no
 * download or upload. Legacy assets are compared with authenticated bytes. */
export async function compareMedia(client, value) {
  const input = parse(mediaCompareSchema, value),
    bytes = await fileBytes(resolve(input.file));
  const page = await client.get('resources', {
    scope: input.scope,
    collection: 'assets',
    id: input.id,
  });
  const asset = page?.items?.[0];
  if (
    page?.scope !== input.scope ||
    page.collection !== 'assets' ||
    page.items?.length !== 1 ||
    asset?.id !== input.id ||
    page.omittedIds?.length
  ) {
    fail('media_unavailable', 'The selected resource is not currently available.');
  }
  let remoteDigest = asset.data.sha256,
    downloaded = false;
  if (remoteDigest === undefined || remoteDigest === null) {
    const target = /^\/api\/v2\/media\/([a-zA-Z0-9_-]{1,128})\/([a-zA-Z0-9_-]{1,128})$/.exec(
      asset.data.url ?? '',
    );
    if (!target || target[2] !== input.id) {
      fail('invalid_response', 'The resource has an invalid authenticated media identity.');
    }
    const remote = await client.transport.request('/api/agents/v1/media/content', {
      query: { scope: input.scope, ownerId: target[1], id: input.id },
      binary: true,
      token: await client.accessToken(),
    });
    if (!Buffer.isBuffer(remote) || remote.length !== asset.data.sizeBytes) {
      fail('invalid_response', 'The resource download has an invalid size.');
    }
    remoteDigest = digest(remote);
    downloaded = true;
  }
  if (
    !/^[a-f0-9]{64}$/.test(remoteDigest) ||
    !Number.isSafeInteger(asset.data.sizeBytes) ||
    asset.data.sizeBytes < 1
  ) {
    fail('invalid_response', 'The resource has an invalid verified digest or size.');
  }
  const sha256 = digest(bytes),
    identical = sha256 === remoteDigest && bytes.length === asset.data.sizeBytes;
  return {
    scope: input.scope,
    assetId: input.id,
    revision: asset.revision,
    sha256,
    remoteSha256: remoteDigest,
    identical,
    downloaded,
    recommendation: identical
      ? 'Reuse this assetId; no upload or revision is needed.'
      : 'Bytes differ. Inspect the visual or content change before preparing an authorized replacement.',
  };
}
const binding = (session) => ({
  origin: session.origin,
  connectionId: session.connection_id,
  profileId: session.profile_id,
  sessionId: session.session_id,
});
function sessionView(value, id, size) {
  if (
    !value ||
    value.id !== id ||
    typeof value.ownerId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(value.ownerId) ||
    value.size !== size ||
    typeof value.published !== 'boolean'
  ) {
    fail('invalid_response', 'The attachment session did not match the prepared file.');
  }
  return value;
}
/** Private immutable local journal: retries reuse the same blob ID and digest.
 * No binary data, credentials or remote response text are written to this file.
 */
export class MediaJournal {
  constructor(client) {
    this.client = client;
  }
  store(id) {
    parse(operationIdSchema, id);
    return new CredentialStore({
      directory: join(this.client.store.directory, 'media', this.client.store.context),
      context: id,
    });
  }
  async prepare(value) {
    const input = parse(mediaPrepareSchema, value),
      session = await this.client.authorizedSession();
    const path = resolve(input.file),
      bytes = await fileBytes(path),
      id = randomUUID(),
      store = this.store(id);
    const fileName = basename(path);
    if (fileName.length > 200) {
      fail('invalid_arguments', 'Use a filename of at most 200 characters.');
    }
    await store.locked(() =>
      store.write({
        formatVersion: 1,
        binding: binding(session),
        path,
        input: {
          id,
          issuedAt: Date.now(),
          scope: input.scope,
          expectedEpoch: input.epoch,
          size: bytes.length,
          sha256: digest(bytes),
          contentType: input.contentType,
          fileName,
          kind: 'memory',
        },
      }),
    );
    return {
      operationId: id,
      scope: input.scope,
      fileName,
      size: bytes.length,
      sha256: digest(bytes),
      prepared: true,
    };
  }
  async upload(id) {
    const store = this.store(id);
    return store.locked(async () => {
      const value = await store.read(),
        session = await this.client.authorizedSession();
      if (
        !value ||
        value.formatVersion !== 1 ||
        value.input?.id !== id ||
        JSON.stringify(value.binding) !== JSON.stringify(binding(session))
      ) {
        fail('media_context_changed', 'Prepare a new upload in this authenticated context.');
      }
      const bytes = await fileBytes(value.path);
      if (bytes.length !== value.input.size || digest(bytes) !== value.input.sha256) {
        fail('file_changed', 'The prepared file changed; prepare a new operation.');
      }
      const transport = this.client.transport,
        token = session.access_token;
      const opened = sessionView(
        await transport.request('/api/agents/v1/media/sessions', {
          method: 'POST',
          json: value.input,
          token,
        }),
        id,
        bytes.length,
      );
      const query = { scope: value.input.scope, ownerId: opened.ownerId, id };
      if (!opened.published) {
        await transport.request('/api/agents/v1/media/content', {
          method: 'PUT',
          query,
          bytes,
          token,
        });
        const published = sessionView(
          await transport.request('/api/agents/v1/media/actions', {
            method: 'POST',
            json: { ...query, action: 'publish' },
            token,
          }),
          id,
          bytes.length,
        );
        if (!published.published) {
          fail(
            'media_not_published',
            'Upload is not published; inspect its state before retrying.',
          );
        }
      }
      return {
        operationId: id,
        assetId: id,
        ownerId: opened.ownerId,
        scope: value.input.scope,
        published: true,
        fileName: value.input.fileName,
        size: bytes.length,
        sha256: value.input.sha256,
      };
    }, this.client.transport.signal);
  }
}
export async function mediaAction(client, value) {
  const input = parse(mediaActionSchema, value);
  return client.transport.request('/api/agents/v1/media/actions', {
    method: 'POST',
    json: input,
    token: await client.accessToken(),
  });
}
/** Explicit destination only. Exclusive creation never overwrites existing files. */
export async function downloadMedia(client, value) {
  const { file, ...query } = parse(mediaDownloadSchema, value);
  const bytes = await client.transport.request('/api/agents/v1/media/content', {
    query,
    binary: true,
    token: await client.accessToken(),
  });
  const path = resolve(file);
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { file: path, size: bytes.length, sha256: digest(bytes) };
}
