import {
  feedbackDraftSchema,
  prepareFeedbackCommand,
  readFeedbackCapabilities,
  validateFeedbackCreate,
  validateFeedbackUpload,
  validFeedbackReceipt,
  validFeedbackMediaSession,
} from './feedback.mjs';
import { retryAt, requireRetryReady } from './recovery.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod/v4';
import catalog from './command-catalog.mjs';
import commandInputSchemas from './command-input-schemas.mjs';
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
      .regex(/^(project|memory|personal):[^\u0000-\u001f]+$/u),
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
export const metricCommandSchema = commandSchema
  .extend({
    kind: z.enum(
      Object.entries(catalog.commands)
        .filter(([, definition]) => definition.permission === 'metrics:write')
        .map(([kind]) => kind),
    ),
  })
  .strict();
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
const dataValidators = new Map();
function validateCommandData(kind, data) {
  const schema = commandInputSchemas[kind];
  if (!schema) {
    return;
  }
  if (!dataValidators.has(kind)) {
    dataValidators.set(kind, z.fromJSONSchema(schema));
  }
  checked(dataValidators.get(kind), data);
}
/** Validate the public envelope, generated data schema and resource scope. */
export function validateCommand(value) {
  const command = checked(commandSchema, value),
    definition = catalog.commands[command.kind];
  if (
    Buffer.byteLength(JSON.stringify(command)) > catalog.maxCommandBytes ||
    Object.keys(command.data).some((key) => !definition.fields.includes(key)) ||
    (!definition.upsert &&
      (definition.create ? command.expectedRevision !== null : command.expectedRevision === null))
  ) {
    fail(
      'invalid_arguments',
      'Use the declared command fields and size limit. Creation requires a null revision; updates require the current record revision. Declared upserts use the revision returned by their dedicated read.',
    );
  }
  validateCommandData(command.kind, command.data);
  const prefix =
    command.scope.startsWith('personal:') && definition.personalModule
      ? 'personal:'
      : definition.module.startsWith('Memory/')
        ? 'memory:'
        : 'project:';
  if (
    !command.scope.startsWith(prefix) ||
    (definition.module.endsWith('/$') && command.id !== command.scope.slice(prefix.length))
  ) {
    fail(
      'invalid_arguments',
      'Use the matching project or memory scope. Only declared personal metric commands may target personal:<connected-owner>.',
    );
  }
  if (
    ['memory.create', 'project.create'].includes(command.kind) &&
    (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(command.id) ||
      command.epoch !== command.id)
  ) {
    fail(
      'invalid_arguments',
      'Create a space with a UUID v4 as id and the same initial epoch. Use project:<id> or memory:<id> as appropriate; keep source identifiers in page sourceId.',
    );
  }
  if (command.kind === 'ticket.plan' && command.id !== command.scope.slice(8)) {
    fail(
      'invalid_arguments',
      'ticket.plan targets the project ID and root revision; changes carry each task expectedVersion.',
    );
  }
  return command;
}
export const commandHelpSchema = z.object({ kind: z.enum(Object.keys(catalog.commands)) }).strict();
export function commandHelp(input) {
  const { kind } = checked(commandHelpSchema, input);
  const definition = catalog.commands[kind];
  const schema = commandInputSchemas[kind];
  return {
    kind,
    ...definition,
    ...(schema
      ? {
          requiredFields: schema.required,
          properties: schema.properties,
          dataSchema: schema,
        }
      : {}),
  };
}
export function describeCommands() {
  return {
    ...catalog,
    commands: Object.fromEntries(
      Object.keys(catalog.commands).map((kind) => [kind, commandHelp({ kind })]),
    ),
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
function checkSavedCommand(row, input, identity, protocol) {
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
  if (row && (row.protocol !== protocol || canonical(row.input) !== canonical(input))) {
    fail(
      'idempotency_mismatch',
      'The operation ID already belongs to a different immutable request.',
      {
        status: 409,
        remediation: 'Use commands inspect, then retry the saved operation.',
      },
    );
  }
}
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

const confirmationProtocols = {
  feedback_submit: {
    validate: validateFeedbackCreate,
    validReceipt: validFeedbackReceipt,
    operationId: (input) => input.commandId,
    path: '/api/agents/v1/feedback',
  },
  feedback_media_open: {
    validate: validateFeedbackUpload,
    validReceipt: validFeedbackMediaSession,
    operationId: (input) => input.id,
    path: '/api/agents/v1/feedback/media/uploads',
  },
};

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
    return this.prepareExact(input);
  }
  /** Hosts already have stable event IDs/times. Preserve their exact command,
   * including an existing uncertain or confirmed journal, without sending it. */
  async prepareExact(value) {
    const input = validateCommand(value);
    const identity = binding(await this.client.session()),
      store = this.store(input.operationId);
    return store.locked(async () => {
      const row = await store.read();
      checkSavedCommand(row, input, identity);
      if (!row) {
        await store.write({ formatVersion: 1, binding: identity, input, state: 'prepared' });
      }
      return { operationId: input.operationId, state: row?.state ?? 'prepared', request: input };
    }, this.client.transport.signal);
  }
  async prepareFeedback(draft) {
    const value = checked(feedbackDraftSchema, draft);
    const identity = binding(await this.client.session());
    if (!value.expectedEpoch) {
      const capabilities = await readFeedbackCapabilities(this.client);
      if (!capabilities.canReportBug) {
        fail('agent_permission_denied', 'Feedback needs a personal feedback:write grant.');
      }
      if (value.type === 'FeatureRequest' && !capabilities.canRequestFeature) {
        fail(
          'feedback_premium_required',
          'This account can report bugs. Feature requests require a paid plan.',
        );
      }
      value.expectedEpoch = capabilities.epoch;
    }
    if (canonical(binding(await this.client.session())) !== canonical(identity)) {
      fail('operation_identity_mismatch', 'The connection changed while preparing feedback.');
    }
    const prepared = prepareFeedbackCommand(value),
      store = this.store(prepared.command.commandId);
    await store.locked(
      () =>
        store.write({
          formatVersion: 1,
          protocol: 'feedback_submit',
          binding: identity,
          input: prepared.command,
          state: 'prepared',
        }),
      this.client.transport.signal,
    );
    return prepared;
  }
  async submitFeedback(value) {
    return this.#execute(value, 'feedback_submit');
  }
  async openFeedbackMedia(value) {
    return this.#execute(value, 'feedback_media_open');
  }
  async #mediaUploadRow(store, protocol = 'feedback_media_open') {
    const identity = binding(await this.client.session());
    const row = await store.read();
    if (
      !row ||
      row.formatVersion !== 1 ||
      row.input?.id !== store.context ||
      row.protocol !== protocol ||
      row.state !== 'confirmed' ||
      !confirmationProtocols[protocol].validReceipt(row.receipt, row.input)
    ) {
      fail(
        'operation_not_found',
        'Confirm the saved upload reservation first. Recover an uncertain reservation with commands retry.',
      );
    }
    if (canonical(row.binding) !== canonical(identity)) {
      fail(
        'operation_identity_mismatch',
        'The upload belongs to another connection, profile, session or environment.',
      );
    }
    return { identity, row };
  }
  #confirmedMediaReceipt(row) {
    if (row.uploadState !== 'confirmed') {
      return null;
    }
    if (
      !confirmationProtocols[row.protocol].validReceipt(row.uploadReceipt, row.input) ||
      row.uploadReceipt.state !== 'ready'
    ) {
      fail(
        'invalid_response',
        'The saved feedback image receipt is invalid. Inspect the operation before acting.',
      );
    }
    return row.uploadReceipt;
  }
  #requireCurrentMediaSize(row) {
    if (row.input.size > 4_000_000) {
      fail('feedback_media_too_large', 'Use a screenshot no larger than 4,000,000 bytes.', {
        status: 413,
      });
    }
  }
  /** A confirmed upload can be replayed without reopening the source file.
   * The same identity and receipt checks still apply; no HTTP request is made. */
  async confirmedFeedbackMediaUpload(id) {
    return this.#confirmedMediaUpload(id, 'feedback_media_open');
  }
  async #confirmedMediaUpload(id, protocol) {
    const store = this.store(id);
    return store.locked(async () => {
      const { row } = await this.#mediaUploadRow(store, protocol);
      const receipt = this.#confirmedMediaReceipt(row);
      if (!receipt) {
        this.#requireCurrentMediaSize(row);
      }
      return receipt;
    }, this.client.transport.signal);
  }
  /** Binary transfer uses the already-confirmed immutable reservation. It
   * never renews an uncertain reservation or retries another request silently. */
  async uploadFeedbackMediaBytes(id, bytes, sha256) {
    return this.#uploadMediaBytes(id, bytes, sha256, 'feedback_media_open');
  }
  async #uploadMediaBytes(id, bytes, sha256, protocol) {
    const store = this.store(id);
    return store.locked(async () => {
      const { identity, row } = await this.#mediaUploadRow(store, protocol);
      const confirmed = this.#confirmedMediaReceipt(row);
      if (confirmed) {
        return confirmed;
      }
      this.#requireCurrentMediaSize(row);
      const source = row.input;
      if (
        !Buffer.isBuffer(bytes) ||
        bytes.length !== source.size ||
        sha256 !== source.sha256 ||
        createHash('sha256').update(bytes).digest('hex') !== source.sha256
      ) {
        fail(
          'idempotency_mismatch',
          'The image bytes changed after preparation. Do not reuse this reservation.',
        );
      }
      requireRetryReady(row.uploadRetryAt);
      const session = await this.client.authorizedSession();
      if (canonical(binding(session)) !== canonical(identity)) {
        fail('operation_identity_mismatch', 'The connection changed before upload.');
      }
      await store.write({ ...row, uploadState: 'uncertain' });
      this.client.invalidateReads?.();
      try {
        const result = await this.client.transport.request(row.receipt.uploadPath, {
          method: 'PUT',
          token: session.access_token,
          bytes,
        });
        if (
          !confirmationProtocols[protocol].validReceipt(result, row.input) ||
          result.state !== 'ready'
        ) {
          fail(
            'invalid_response',
            'The feedback image upload receipt is invalid. Retry the same bytes and reservation.',
            { execution: 'unknown' },
          );
        }
        await store.write({ ...row, uploadState: 'confirmed', uploadReceipt: result });
        return result;
      } catch (error) {
        const safe = safeError(error);
        await store
          .write({
            ...row,
            uploadState: 'uncertain',
            uploadRetryAt: retryAt(error),
            uploadError: safe.toJSON(),
          })
          .catch(() => {});
        throw new AgentError(safe.code, safe.message, {
          status: safe.status,
          retryable: safe.retryable,
          ...safe.details,
          execution: 'unknown',
          operationId: id,
        });
      }
    }, this.client.transport.signal);
  }
  async inspect(id) {
    const row = await this.store(id).read();
    if (
      !row ||
      row.formatVersion !== 1 ||
      (row.protocol
        ? confirmationProtocols[row.protocol]?.operationId(row.input)
        : row.input?.operationId) !== id
    ) {
      fail('operation_not_found', 'This context has no valid local operation with that ID.');
    }
    return {
      operationId: id,
      source: 'local_journal',
      ...(row.protocol ? { protocol: row.protocol } : {}),
      state: row.state,
      request: row.input,
      ...(row.receipt ? { receipt: row.receipt } : {}),
      ...(row.error ? { error: row.error } : {}),
      ...(row.retryAt ? { retryAt: row.retryAt } : {}),
    };
  }
  async execute(value) {
    return this.#execute(value);
  }
  async #execute(value, protocol) {
    const typed = protocol ? confirmationProtocols[protocol] : null;
    if (protocol && !typed) {
      fail('invalid_arguments', 'Unknown saved operation protocol.');
    }
    const input = typed ? typed.validate(value) : validateCommand(value),
      operationId = typed ? typed.operationId(input) : input.operationId,
      store = this.store(operationId);
    return store.locked(async () => {
      // Capture token and identity together under the refresh lock. A later
      // logout/login cannot turn this pending operation into another profile.
      const localSession = await this.client.session(),
        identity = binding(localSession);
      let row = await store.read();
      checkSavedCommand(row, input, identity, protocol);
      if (row?.state === 'confirmed') {
        if (typed && !typed.validReceipt(row.receipt, input)) {
          fail('invalid_response', 'Invalid saved feedback receipt.');
        }
        return { source: 'local_receipt', receipt: row.receipt };
      }
      requireRetryReady(row?.retryAt);
      const session = await this.client.authorizedSession();
      if (canonical(binding(session)) !== canonical(identity)) {
        fail('operation_identity_mismatch', 'The connection changed before transmission.');
      }
      row = {
        formatVersion: 1,
        ...(protocol ? { protocol } : {}),
        binding: identity,
        input,
        state: 'uncertain',
      };
      await store.write(row);
      try {
        const receipt = await this.client.transport.request(
          typed?.path ?? '/api/agents/v1/commands',
          {
            method: 'POST',
            json: input,
            token: session.access_token,
          },
        );
        if (
          typed
            ? !typed.validReceipt(receipt, input)
            : !receiptSchema.safeParse(receipt).success ||
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
          operationId,
        });
        // The uncertainty marker is already durable. Preserve the useful original
        // error/operation ID even if disk pressure prevents saving diagnostics.
        await store
          .write({ ...row, retryAt: retryAt(result), error: result.toJSON() })
          .catch(() => {});
        throw result;
      }
    }, this.client.transport.signal);
  }
  async retry(id) {
    const saved = await this.inspect(id);
    return this.#execute(saved.request, saved.protocol);
  }
}
