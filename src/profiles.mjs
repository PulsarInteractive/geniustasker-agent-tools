import * as z from 'zod/v4';
import { AgentError, fail } from './errors.mjs';
import catalog from './command-catalog.mjs';

const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
  .regex(/^[^\u0000-\u001f\u007f]+$/u);
const unique = (values) => new Set(values).size === values.length;
export const grantSchema = z
  .object({
    allResources: z.boolean(),
    resourceIds: z
      .array(z.string().min(1).max(256))
      .max(catalog.grants.maxResources)
      .refine(unique),
    permissions: z
      .array(z.enum(catalog.grants.permissions))
      .max(catalog.grants.permissions.length)
      .refine(unique),
  })
  .strict()
  .refine((grant) => !grant.allResources || grant.resourceIds.length === 0);
export const profileCreateSchema = z.object({ id: z.uuid(), name, grant: grantSchema }).strict();
export const profileRestrictSchema = z
  .object({
    profileId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    name,
    expectedRevision: z.number().int().min(1),
    grant: grantSchema,
  })
  .strict();
export const profileSelectSchema = z
  .object({ profileId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })
  .strict();
const choiceSchema = z
  .object({
    id: z.string(),
    name,
    revision: z.number().int().min(1),
    current: z.boolean(),
    permissions: z.array(z.string()),
    allResources: z.boolean(),
    resourceCount: z.number().int().min(0),
  })
  .strict();
const choicesSchema = z
  .object({
    connectionId: z.string(),
    currentProfileId: z.string(),
    items: z.array(choiceSchema).max(catalog.grants.maxProfilesPerConnection),
  })
  .strict();
const profileSchema = z
  .object({
    id: z.string(),
    connectionId: z.string(),
    name,
    revision: z.number().int().min(1),
    grant: grantSchema,
    disabledAt: z.number().nullable(),
  })
  .strict();
const input = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail('invalid_arguments', 'Use the declared profile fields, a valid name and a bounded grant.');
  }
  return result.data;
};

/** Profile management is separate from domain-operation journals: creation has
 * an explicit UUID retained in the caller's file, restriction a live revision,
 * and selection rotates the credential family under the credential-store lock. */
export class AgentProfiles {
  constructor(client) {
    this.client = client;
  }
  async list() {
    const result = choicesSchema.safeParse(await this.client.get('profiles'));
    if (!result.success) {
      fail('invalid_response', 'The profile list was invalid.');
    }
    return result.data;
  }
  async create(value) {
    return this.write('profiles', 'POST', input(profileCreateSchema, value));
  }
  async restrict(value) {
    return this.write('profile', 'PUT', input(profileRestrictSchema, value));
  }
  async write(resource, method, value) {
    const session = await this.client.authorizedSession();
    if (method === 'PUT' && value.profileId !== session.profile_id) {
      fail('profile_selection_conflict', 'This draft belongs to another profile.', {
        status: 409,
        remediation: 'Read whoami and prepare a fresh restriction for the intended profile.',
      });
    }
    try {
      const result = await this.client.transport.request(`/api/agents/v1/${resource}`, {
        method,
        token: session.access_token,
        json: value,
      });
      const parsed = profileSchema.safeParse(result);
      if (
        !parsed.success ||
        parsed.data.connectionId !== session.connection_id ||
        parsed.data.id !== (method === 'POST' ? value.id : session.profile_id)
      ) {
        fail('invalid_response', 'The profile change could not be confirmed.');
      }
      return parsed.data;
    } catch (error) {
      if (!(error instanceof AgentError)) {
        throw error;
      }
      error.details.profileId = method === 'POST' ? value.id : session.profile_id;
      error.details.execution ??= 'unknown';
      error.remediation =
        method === 'POST'
          ? 'List profiles and reconcile this profileId. Keep the same UUID on retry; do not create a replacement after an uncertain reply.'
          : 'Read whoami to see the current profile and revision before preparing another restriction.';
      throw error;
    }
  }
  async select(value) {
    const { profileId } = input(profileSelectSchema, value);
    const choices = await this.list();
    const source = choices.items.find((p) => p.id === choices.currentProfileId && p.current);
    const target = choices.items.find((p) => p.id === profileId);
    if (!source || !target) {
      fail(
        'profile_selection_denied',
        'This profile is not available within the current connection and permissions.',
        {
          status: 403,
          remediation: 'Run profiles list. An agent cannot switch back to broader permissions.',
        },
      );
    }
    return this.client.selectProfile({
      profileId,
      expectedRevision: target.revision,
      expectedSourceRevision: source.revision,
      sourceProfileId: source.id,
      connectionId: choices.connectionId,
    });
  }
}
