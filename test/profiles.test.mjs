import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AgentProfiles } from '../src/profiles.mjs';
import { CommandJournal } from '../src/commands.mjs';
import { fixture, tokens } from './helpers.mjs';
import catalog from '../src/command-catalog.mjs';

const grant = { allResources: false, resourceIds: ['project:one'], permissions: ['tasks:read'] };
const choices = () => ({ connectionId: 'connection', currentProfileId: 'profile', items: [
  { id: 'profile', name: 'Default', revision: 3, current: true, permissions: ['tasks:read','tasks:write'], allResources: false, resourceCount: 1 },
  { id: 'reader', name: 'Documentation', revision: 7, current: false, permissions: ['tasks:read'], allResources: false, resourceCount: 1 },
] });
const selected = () => ({ ...tokens('b'), profile_id: 'reader' });

test('a fully granted profile accepts the current approval permission without a stale CLI limit', async t => {
  let requests = 0;
  const f = await fixture(t, async (_url, options) => {
    requests++;
    return Response.json({ ...JSON.parse(options.body), connectionId: 'connection', revision: 1, disabledAt: null });
  });
  const profiles = new AgentProfiles(f.client);
  const input = { id: randomUUID(), name: 'Project team', grant: { ...grant, permissions: catalog.grants.permissions } };
  const result = await profiles.create(input);
  assert.ok(result.grant.permissions.includes('approvals:write'));
  assert.equal(result.grant.permissions.length, 12);
  for (const permissions of [[...input.grant.permissions, 'unknown:write'], ['tasks:read', 'tasks:read']])
    await assert.rejects(profiles.create({ ...input, grant: { ...grant, permissions } }), { code: 'invalid_arguments' });
  assert.equal(requests, 1);
});

test('profile inputs are strict and creation retains the chosen identity after a lost reply', async t => {
  const ids = [], id = randomUUID();
  const f = await fixture(t, async (_url, options) => {
    const input = JSON.parse(options.body); ids.push(input.id);
    assert.equal(options.headers.Authorization, `Bearer ${tokens().access_token}`);
    throw Error('private network trace');
  });
  const profiles = new AgentProfiles(f.client);
  for (const value of [{ id, name: 'Bad\nname', grant }, { id, name: 'Fine', grant, ownerId: 'other' }, { id, name: 'Fine', grant: { ...grant, allResources: true } }])
    await assert.rejects(profiles.create(value), { code: 'invalid_arguments' });
  assert.equal(ids.length, 0);
  for (let i = 0; i < 2; i++) await assert.rejects(profiles.create({ id, name: 'Documentation', grant }), error =>
    error.code === 'network_unavailable' && error.details.profileId === id && error.details.execution === 'unknown' && !error.message.includes('private'));
  assert.deepEqual(ids, [id, id]);
});

test('selection persists uncertainty before rotating, saves the new identity and never returns credentials', async t => {
  let selections = 0;
  const f = await fixture(t, async (url, options) => {
    if (url.pathname.endsWith('/profiles')) return Response.json(choices());
    selections++;
    assert.equal((await f.store.read()).refreshPending, true);
    assert.equal(options.body.get('profile_id'), 'reader');
    assert.equal(options.body.get('profile_revision'), '7');
    assert.equal(options.body.get('source_revision'), '3');
    return Response.json(selected());
  });
  const journal = new CommandJournal(f.client);
  const prepared = await journal.prepare({ scope: 'project:one', epoch: 'epoch', id: 'task', expectedRevision: null,
    kind: 'task.create', data: { title: 'Review' } });
  const result = await new AgentProfiles(f.client).select({ profileId: 'reader' });
  assert.equal(result.profileId, 'reader'); assert.equal(selections, 1);
  assert.ok(!JSON.stringify(result).includes('gta1.'));
  const saved = await f.store.read(); assert.equal(saved.profile_id, 'reader'); assert.equal(saved.refreshPending, false);
  await assert.rejects(journal.retry(prepared.operationId), { code: 'operation_identity_mismatch' });
});

test('a saved restriction cannot edit the profile selected since the draft was prepared', async t => {
  let requests = 0;
  const f = await fixture(t, async () => { requests++; throw Error('must not send'); });
  await assert.rejects(new AgentProfiles(f.client).restrict({
    profileId: 'previous-profile', name: 'Documentation', expectedRevision: 1, grant,
  }), { code: 'profile_selection_conflict' });
  assert.equal(requests, 0);
});

test('definite pre-rotation refusal keeps usable credentials, unknown rotation requires reconnect', async t => {
  for (const code of ['profile_selection_conflict', 'profile_selection_denied', 'network', 'malformed']) {
    let called = 0;
    const f = await fixture(t, async url => {
      if (url.pathname.endsWith('/profiles')) return Response.json(choices());
      called++;
      if (code === 'network') throw Error('lost response');
      if (code === 'malformed') return Response.json({ ...selected(), session_id: 'wrong-session' });
      return Response.json({ error: code }, { status: 400 });
    });
    await assert.rejects(new AgentProfiles(f.client).select({ profileId: 'reader' }));
    const uncertain = ['network', 'malformed'].includes(code);
    assert.equal((await f.store.read()).refreshPending, uncertain);
    if (uncertain) await assert.rejects(f.client.accessToken(), { code: 'reauthentication_required' });
    else assert.equal(await f.client.accessToken(), tokens().access_token);
    assert.equal(called, 1);
  }
});

test('a profile change cannot be silently shared by two racing contexts', async t => {
  let selections = 0;
  const f = await fixture(t, async (url) => {
    if (url.pathname.endsWith('/profiles')) return Response.json(choices());
    selections++; return Response.json(selected());
  });
  const profiles = new AgentProfiles(f.client);
  const result = await Promise.allSettled([profiles.select({ profileId: 'reader' }), profiles.select({ profileId: 'reader' })]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  const failure = result.find(r => r.status === 'rejected');
  assert.equal(failure.reason.code, 'profile_selection_conflict'); assert.equal(selections, 1);
});
