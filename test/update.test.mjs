import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkUpdate, installUpdate, maybeNotifyUpdate } from '../src/update.mjs';
import { main } from '../src/cli.mjs';
import { fixture, origin } from './helpers.mjs';
import metadata from '../package.json' with { type: 'json' };

const name = '@pulsarinteractive/geniustasker';
const response = (version) => Response.json({ name, version });
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'tasker-update-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
function streams() {
  const out = [],
    err = [];
  return {
    out,
    err,
    stdout: { isTTY: true, write: (v) => out.push(v) },
    stderr: { isTTY: true, write: (v) => err.push(v) },
  };
}

test('registry discovery uses a fixed anonymous origin and compares beta and stable versions', async () => {
  const cases = [
    ['0.1.0-beta.8', '0.1.0-beta.10', true],
    ['0.1.0-beta.8', '0.1.0-beta.8', false],
    ['0.1.0-beta.8', '0.1.0-beta.2', false],
    ['0.1.0-beta.8', '0.1.0', true],
    ['0.1.0', '0.1.0-beta.9', false, 'beta'],
    ['1.0.0', '0.9.9', false],
    ['1.0.0', '1.1.0', true],
  ];
  for (const [currentVersion, candidate, expected, channel] of cases) {
    let calls = 0;
    const result = await checkUpdate({
      currentVersion,
      channel,
      fetchImpl: async (url, options) => {
        calls++;
        assert.match(
          url,
          /^https:\/\/registry\.npmjs\.org\/@pulsarinteractive%2Fgeniustasker\/(beta|latest)$/,
        );
        assert.equal(options.redirect, 'error');
        assert.deepEqual(options.headers, { Accept: 'application/json' });
        return response(candidate);
      },
    });
    assert.equal(result.updateAvailable, expected);
    assert.equal(result.availableVersion, candidate);
    assert.equal(calls, 1);
  }
});

test('invalid metadata, oversized or stalled responses are bounded and never disclose raw diagnostics', async () => {
  const fixtures = [
    () => Response.json({ name: 'other', version: '1.0.0' }),
    () => response('1.0.0;bad'),
    () => response('file:elsewhere'),
    () => response('1.0.0-alpha.1'),
    () => new Response('x'.repeat(65537), { headers: { 'content-type': 'application/json' } }),
    () => new Response('not json', { headers: { 'content-type': 'application/json' } }),
    () => new Response('private diagnostics', { status: 503 }),
    () => Promise.reject(Error('private credentials')),
    () => new Promise(() => {}),
    () =>
      new Response(
        new ReadableStream({
          pull() {
            return new Promise(() => {});
          },
          cancel() {
            return new Promise(() => {});
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  ];
  for (const fetchImpl of fixtures) {
    const start = Date.now();
    await assert.rejects(checkUpdate({ fetchImpl, timeoutMs: 20 }), (error) => {
      assert.equal(error.code, 'update_check_unavailable');
      assert.doesNotMatch(JSON.stringify(error), /private|credentials/);
      return true;
    });
    assert.ok(Date.now() - start < 1000);
  }
  await assert.rejects(
    checkUpdate({ channel: 'https://other.test', fetchImpl: () => assert.fail() }),
    { code: 'invalid_arguments' },
  );
  await assert.rejects(
    checkUpdate({ channel: 'stable', fetchImpl: () => response('1.0.0-beta.9') }),
    { code: 'update_check_unavailable' },
  );
});

test('interactive notice checks at most daily across concurrent invocations, including failures', async (t) => {
  const cacheDirectory = await directory(t),
    io = streams();
  const config = {
    command: 'projects list',
    options: {},
    isTTY: true,
    ...io,
    env: {},
    cacheDirectory,
    now: 1000000000,
    currentVersion: '0.1.0-beta.8',
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response('0.1.0-beta.9');
  };
  await Promise.all(Array.from({ length: 5 }, () => maybeNotifyUpdate({ ...config, fetchImpl })));
  await maybeNotifyUpdate({ ...config, fetchImpl });
  assert.equal(calls, 1);
  assert.equal(io.err.length, 1);
  assert.equal(io.out.length, 0);
  assert.equal((await readdir(cacheDirectory)).length, 1);
  await maybeNotifyUpdate({
    ...config,
    now: config.now + 86400000,
    fetchImpl: async () => {
      calls++;
      throw Error('offline');
    },
  });
  await maybeNotifyUpdate({ ...config, now: config.now + 86400001, fetchImpl });
  assert.equal(calls, 2);
  assert.equal(io.err.length, 1);
  for (const file of await readdir(cacheDirectory)) {
    assert.ok((await readFile(join(cacheDirectory, file))).length < 150);
  }
});

test('MCP, JSON, local workflows, CI, disabled and redirected output never inspect updates', async (t) => {
  const root = await directory(t),
    cacheDirectory = join(root, 'absent'),
    io = streams();
  const base = {
    command: 'projects list',
    options: {},
    isTTY: true,
    ...io,
    env: {},
    cacheDirectory,
    fetchImpl: () => assert.fail('No registry call'),
  };
  for (const patch of [
    { command: 'mcp' },
    { command: 'help' },
    { command: 'doctor' },
    { command: 'workflow show' },
    { command: 'commands prepare' },
    { command: 'commands describe' },
    { command: 'commands inspect' },
    { command: 'media prepare' },
    { options: { json: true } },
    { options: { help: true } },
    { env: { CI: 'true' } },
    { env: { GENIUSTASKER_NO_UPDATE_CHECK: '1' } },
    { isTTY: false },
    { stdout: { write() {} } },
    { stderr: { write() {} } },
  ]) {
    await maybeNotifyUpdate({ ...base, ...patch });
  }
  assert.deepEqual(await readdir(root), []);
  assert.equal(io.err.length, 0);
});

test('unsafe notification caches are ignored without touching their target', async (t) => {
  const root = await directory(t),
    actual = join(root, 'actual'),
    linked = join(root, 'linked');
  await mkdir(actual);
  await symlink(actual, linked);
  await maybeNotifyUpdate({
    command: 'projects list',
    isTTY: true,
    ...streams(),
    env: {},
    cacheDirectory: linked,
    fetchImpl: () => assert.fail(),
  });
  assert.deepEqual(await readdir(actual), []);
});

test('explicit checks emit one JSON result without authentication or changes to private storage', async (t) => {
  const root = await directory(t),
    io = streams();
  const status = await main(['update', 'check', '--json'], {
    ...io,
    directory: join(root, 'private'),
    fetchImpl: () => assert.fail('No account API'),
    updateFetchImpl: () => response('99.0.0'),
  });
  assert.equal(status, 0);
  assert.equal(io.out.length, 1);
  assert.equal(io.err.length, 0);
  assert.equal(JSON.parse(io.out[0]).data.updateAvailable, true);
  assert.deepEqual(await readdir(root), []);
});

test('global install pins the checked version, disables scripts and verifies the installed manifest', async (t) => {
  const root = await directory(t),
    globalRoot = join(root, 'node_modules'),
    installedDirectory = join(globalRoot, '@pulsarinteractive', 'geniustasker');
  await mkdir(installedDirectory, { recursive: true });
  await writeFile(
    join(installedDirectory, 'package.json'),
    JSON.stringify({ name, version: metadata.version }),
  );
  const privateFile = join(root, 'credentials-and-journal');
  await writeFile(privateFile, 'unchanged');
  const calls = [];
  const result = await installUpdate({
    installedDirectory,
    runtimeDirectory: join(root, 'runtime'),
    fetchImpl: () => response('99.0.0'),
    npmImpl: async (args) => {
      calls.push(args);
      if (args[0] === 'root') {
        return { stdout: globalRoot + '\n' };
      }
      assert.deepEqual(args, [
        'install',
        '--global',
        '--registry=https://registry.npmjs.org',
        '--@pulsarinteractive:registry=https://registry.npmjs.org',
        '--ignore-scripts',
        '--engine-strict',
        name + '@99.0.0',
      ]);
      await writeFile(
        join(installedDirectory, 'package.json'),
        JSON.stringify({ name, version: '99.0.0' }),
      );
      return { stdout: '' };
    },
  });
  assert.equal(result.state, 'installed');
  assert.equal(result.restartMcp, true);
  assert.equal(calls.length, 2);
  assert.equal(await readFile(privateFile, 'utf8'), 'unchanged');
});

test('source/npx installs and unconfirmed npm results do not claim an installed update', async (t) => {
  const root = await directory(t),
    globalRoot = join(root, 'node_modules'),
    installedDirectory = join(globalRoot, '@pulsarinteractive', 'geniustasker');
  await mkdir(installedDirectory, { recursive: true });
  await writeFile(
    join(installedDirectory, 'package.json'),
    JSON.stringify({ name, version: metadata.version }),
  );
  await assert.rejects(
    installUpdate({
      installedDirectory: root,
      runtimeDirectory: join(root, 'runtime'),
      fetchImpl: () => response('99.0.0'),
      npmImpl: async (args) => {
        assert.deepEqual(args, ['root', '--global']);
        return { stdout: globalRoot };
      },
    }),
    { code: 'update_manual_required' },
  );
  await assert.rejects(
    installUpdate({
      installedDirectory,
      runtimeDirectory: join(root, 'runtime'),
      fetchImpl: () => response('99.0.0'),
      npmImpl: async (args) => ({ stdout: args[0] === 'root' ? globalRoot : '' }),
    }),
    { code: 'update_install_unconfirmed' },
  );
  assert.equal(
    (
      await installUpdate({
        currentVersion: '99.0.0',
        fetchImpl: () => response('1.0.0'),
        npmImpl: () => assert.fail(),
      })
    ).state,
    'up_to_date',
  );
});

test('a successful human command keeps its output and receipt when optional discovery fails', async (t) => {
  const f = await fixture(t, async () => Response.json({ projects: [] })),
    io = streams();
  const status = await main(['projects', 'list', '--origin', origin, '--allow-local'], {
    ...io,
    isTTY: true,
    directory: f.directory,
    fetchImpl: async () => Response.json({ projects: [] }),
    updateEnvironment: {},
    updateCacheDirectory: join(f.directory, 'update-cache'),
    updateFetchImpl: () => {
      throw Error('private registry failure');
    },
  });
  assert.equal(status, 0);
  assert.equal(io.out.length, 1);
  assert.equal(io.err.length, 0);
  assert.equal(JSON.parse(io.out[0]).ok, true);
  assert.ok(await f.store.read());
});

test('npm scoped registry configuration cannot redirect the package update', async (t) => {
  const root = await directory(t),
    userconfig = join(root, '.npmrc');
  await writeFile(userconfig, '@pulsarinteractive:registry=https://registry-override.invalid\n');
  const result = await checkUpdate({ fetchImpl: () => response('99.0.0') });
  assert.match(
    result.updateCommand,
    /--@pulsarinteractive:registry=https:\/\/registry\.npmjs\.org/,
  );
  const { stdout } = await promisify(execFile)(
    'npm',
    [
      'config',
      'get',
      '@pulsarinteractive:registry',
      '--registry=https://registry.npmjs.org',
      '--@pulsarinteractive:registry=https://registry.npmjs.org',
      '--userconfig',
      userconfig,
    ],
    { cwd: root, timeout: 10000, maxBuffer: 4096 },
  );
  assert.equal(stdout.trim(), 'https://registry.npmjs.org');
});

test('crashed or corrupt daily attempts cannot block later days and old markers expire', async (t) => {
  const cacheDirectory = await directory(t),
    io = streams(),
    day = 86400000,
    currentVersion = '0.1.0-beta.8';
  // Historical fixed-lock/cache damage is never read or used as an authority.
  await writeFile(join(cacheDirectory, 'check.lock'), 'old interrupted process');
  await writeFile(join(cacheDirectory, 'check.json'), '{damaged');
  await writeFile(join(cacheDirectory, `attempt-2-${currentVersion}.json`), '');
  let calls = 0;
  const config = {
    command: 'projects list',
    options: {},
    isTTY: true,
    ...io,
    env: {},
    cacheDirectory,
    currentVersion,
    fetchImpl: () => {
      calls++;
      return response('0.1.0-beta.9');
    },
  };
  await maybeNotifyUpdate({ ...config, now: 2 * day });
  assert.equal(calls, 0);
  await maybeNotifyUpdate({ ...config, now: 3 * day });
  assert.equal(calls, 1);
  await maybeNotifyUpdate({ ...config, now: 4 * day });
  assert.equal(calls, 2);
  assert.equal((await readdir(cacheDirectory)).includes(`attempt-2-${currentVersion}.json`), false);
  const markers = (await readdir(cacheDirectory)).filter((name) => name.startsWith('attempt-'));
  assert.equal(markers.length, 2);
});
