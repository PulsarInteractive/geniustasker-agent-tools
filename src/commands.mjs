import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod/v4';
import catalog from './command-catalog.mjs';
import { CredentialStore } from './store.mjs';
import { AgentError, fail, safeError } from './errors.mjs';

export const operationIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/);
const identifier = z
  .string()
  .min(1)
  .max(128)
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
  .regex(/^[^\u0000-\u001f]+$/u);
export const commandSchema = z
  .object({
    operationId: operationIdSchema,
    issuedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    scope: z
      .string()
      .max(256)
      // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
      .regex(/^(project|memory):[^\u0000-\u001f]+$/u),
    epoch: identifier,
    id: identifier,
    expectedRevision: z
      .string()
      .regex(/^[1-9][0-9]{0,15}$/)
      .nullable(),
    kind: z.enum(Object.keys(catalog.commands)),
    data: z.record(z.string(), z.json()),
  })
  .strict();
export const draftSchema = commandSchema.omit({ operationId: true, issuedAt: true });
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const checked = (schema, value) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    fail(
      'invalid_arguments',
      'The command does not match its schema. Use commands describe; do not supply credentials or server-owned fields.',
    );
  }
  return parsed.data;
};
/** Validate the public envelope, generated field allowlist and resource scope. */
export function validateCommand(value) {
  const command = checked(commandSchema, value),
    definition = catalog.commands[command.kind];
  if (
    Buffer.byteLength(JSON.stringify(command)) > catalog.maxCommandBytes ||
    Object.keys(command.data).some((key) => !definition.fields.includes(key)) ||
    (definition.create ? command.expectedRevision !== null : command.expectedRevision === null)
  ) {
    fail(
      'invalid_arguments',
      'Use the declared command fields and size limit. Creation requires a null revision; other commands require the current record revision.',
    );
  }
  const prefix = definition.module.startsWith('Memory/') ? 'memory:' : 'project:';
  if (
    !command.scope.startsWith(prefix) ||
    (definition.module.endsWith('/$') && command.id !== command.scope.slice(prefix.length))
  ) {
    fail('invalid_arguments', 'The command must target the matching project or memory scope.');
  }
  if (command.kind === 'ticket.plan' && command.id !== command.scope.slice(8)) {
    fail(
      'invalid_arguments',
      'ticket.plan targets the project ID and root revision; changes carry each task expectedVersion.',
    );
  }
  return command;
}
export function describeCommands() {
  return {
    ...catalog,
    envelope: z.toJSONSchema(commandSchema),
    draft: z.toJSONSchema(draftSchema),
    recovery:
      'Retain operationId, issuedAt and the complete body. Retry an uncertain write unchanged; reread before creating a new edit after a conflict.',
  };
}
/** Read one bounded regular JSON file, rejecting symlinks and non-file inputs. */
export async function readCommandFile(path) {
  if (typeof path !== 'string') {
    fail('invalid_arguments', 'Supply --file with a JSON command or draft.');
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > catalog.maxCommandBytes) {
      fail(
        'invalid_arguments',
        `Use a regular JSON file no larger than ${catalog.maxCommandBytes} bytes.`,
      );
    }
    const bytes = Buffer.alloc(catalog.maxCommandBytes + 1),
      result = await handle.read(bytes, 0, bytes.length, 0);
    if (result.bytesRead > catalog.maxCommandBytes) {
      fail('invalid_arguments', `Command file exceeds ${catalog.maxCommandBytes} bytes.`);
    }
    return JSON.parse(bytes.subarray(0, result.bytesRead).toString('utf8'));
  } catch (error) {
    if (error instanceof AgentError) {
      throw error;
    }
    fail('invalid_arguments', 'Could not read a regular, valid JSON command file.');
  } finally {
    await handle?.close();
  }
}
const binding = (session) => ({
  origin: session.origin,
  connectionId: session.connection_id,
  profileId: session.profile_id,
  sessionId: session.session_id,
});
const receiptSchema = z
  .object({
    operationId: operationIdSchema,
    scope: z.string(),
    kind: z.string(),
    epoch: z.string(),
    cursor: z.string(),
    items: z.array(
      z
        .object({
          id: z.string(),
          revision: z.string(),
          collection: z.string(),
          deleted: z.boolean(),
        })
        .strict(),
    ),
    affectedCollections: z.array(z.string()),
  })
  .strict();

/** A journal is bound to one authenticated terminal identity. Persist the full
 * request before the network call, never regenerate a UUID after a timeout.
 * It contains private project text but no access/refresh tokens. A process crash
 * leaves its operation lock for explicit recovery after all clients stop. */
export class CommandJournal {
  constructor(client) {
    this.client = client;
  }
  store(id) {
    checked(operationIdSchema, id);
    return new CredentialStore({
      directory: join(this.client.store.directory, 'operations', this.client.store.context),
      context: id,
      maxBytes: 524288,
    });
  }
  async prepare(draft) {
    const input = validateCommand({
      ...checked(draftSchema, draft),
      operationId: randomUUID(),
      issuedAt: Date.now(),
    });
    const identity = binding(await this.client.session()),
      store = this.store(input.operationId);
    await store.locked(
      () => store.write({ formatVersion: 1, binding: identity, input, state: 'prepared' }),
      this.client.transport.signal,
    );
    return { operationId: input.operationId, state: 'prepared', request: input };
  }
  async inspect(id) {
    const row = await this.store(id).read();
    if (!row || row.formatVersion !== 1 || row.input?.operationId !== id) {
      fail('operation_not_found', 'This context has no valid local operation with that ID.');
    }
    return {
      operationId: id,
      source: 'local_journal',
      state: row.state,
      request: row.input,
      ...(row.receipt ? { receipt: row.receipt } : {}),
      ...(row.error ? { error: row.error } : {}),
    };
  }
  async execute(value) {
    const input = validateCommand(value),
      store = this.store(input.operationId);
    return store.locked(async () => {
      // Capture token and identity together under the refresh lock. A later
      // logout/login cannot turn this pending operation into another profile.
      const session = await this.client.authorizedSession(),
        identity = binding(session);
      let row = await store.read();
      if (row && (row.formatVersion !== 1 || canonical(row.binding) !== canonical(identity))) {
        fail(
          'operation_identity_mismatch',
          'This operation belongs to another connection, profile, session or environment.',
          {
            remediation:
              'Inspect it locally and reread current records. Do not replay it through a replacement login.',
          },
        );
      }
      if (row && canonical(row.input) !== canonical(input)) {
        fail(
          'idempotency_mismatch',
          'The operation ID already belongs to a different immutable request.',
          { status: 409, remediation: 'Use commands inspect, then retry the saved operation.' },
        );
      }
      if (row?.state === 'confirmed') {
        return { source: 'local_receipt', receipt: row.receipt };
      }
      row = { formatVersion: 1, binding: identity, input, state: 'uncertain' };
      await store.write(row);
      try {
        const receipt = await this.client.transport.request('/api/agents/v1/commands', {
          method: 'POST',
          json: input,
          token: session.access_token,
        });
        if (
          !receiptSchema.safeParse(receipt).success ||
          ['operationId', 'scope', 'kind', 'epoch'].some((key) => receipt[key] !== input[key])
        ) {
          fail(
            'invalid_response',
            'The command receipt was invalid. The server may have committed.',
            { execution: 'unknown', remediation: 'Retry the identical saved operation.' },
          );
        }
        await store.write({ ...row, state: 'confirmed', receipt });
        return { source: 'server', receipt };
      } catch (error) {
        const safe = safeError(error);
        const result = new AgentError(safe.code, safe.message, {
          status: safe.status,
          retryable: safe.retryable,
          remediation: safe.remediation,
          execution: 'unknown',
          ...safe.details,
          operationId: input.operationId,
        });
        // The uncertainty marker is already durable. Preserve the useful original
        // error/operation ID even if disk pressure prevents saving diagnostics.
        await store.write({ ...row, error: result.toJSON() }).catch(() => {});
        throw result;
      }
    }, this.client.transport.signal);
  }
  async retry(id) {
    return this.execute((await this.inspect(id)).request);
  }
}
