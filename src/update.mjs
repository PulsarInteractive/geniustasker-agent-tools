import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, readFile, realpath, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import metadata from '../package.json' with { type: 'json' };
import { fail } from './errors.mjs';
import { acquireInstallation, runtimePath } from './update-runtime.mjs';

const packageName = '@pulsarinteractive/geniustasker';
const registry = 'https://registry.npmjs.org';
const dayMs = 24 * 60 * 60 * 1000;
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const offlineCommands = new Set([
  'help',
  'doctor',
  'mcp',
  'workflow show',
  'commands describe',
  'commands prepare',
  'commands inspect',
  'media prepare',
  'docs status',
  'docs unlock',
]);

// Accept only this product's stable/beta release versions, never an npm spec,
// URL, Git reference, shell token or an arbitrary dist tag from a response.
function versionParts(value) {
  if (typeof value !== 'string' || value.length > 64) {
    return null;
  }
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.exec(value);
  if (!match) {
    return null;
  }
  const numbers = match.slice(1).map((v) => (v === undefined ? null : Number(v)));
  return numbers.every((v) => v === null || Number.isSafeInteger(v)) ? numbers : null;
}
function newer(candidate, current) {
  const a = versionParts(candidate),
    b = versionParts(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i];
    }
  }
  return a[3] === null ? b[3] !== null : b[3] !== null && a[3] > b[3];
}
function selectedChannel(channel, currentVersion) {
  const selected = channel ?? (currentVersion.includes('-beta.') ? 'beta' : 'stable');
  if (!['beta', 'stable'].includes(selected)) {
    fail('invalid_arguments', 'Update channel must be beta or stable.');
  }
  return selected;
}

export async function checkUpdate({
  channel,
  currentVersion = metadata.version,
  fetchImpl = globalThis.fetch,
  timeoutMs = 1500,
  signal,
} = {}) {
  channel = selectedChannel(channel, currentVersion);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) {
    abort();
  }
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Error('deadline'));
    }, timeoutMs);
  });
  try {
    const manifest = await Promise.race([
      (async () => {
        const response = await fetchImpl(
          `${registry}/@pulsarinteractive%2Fgeniustasker/${channel === 'stable' ? 'latest' : 'beta'}`,
          {
            headers: { Accept: 'application/json' },
            redirect: 'error',
            signal: controller.signal,
          },
        );
        if (
          !response.ok ||
          response.redirected ||
          !response.body ||
          !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')
        ) {
          throw Error('response');
        }
        const reader = response.body.getReader(),
          parts = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) {
              break;
            }
            size += next.value.byteLength;
            if (size > 65536) {
              throw Error('size');
            }
            parts.push(Buffer.from(next.value));
          }
        } finally {
          // Cancellation must not extend the fixed update-check deadline.
          void reader.cancel().catch(() => {});
        }
        return JSON.parse(Buffer.concat(parts).toString('utf8'));
      })(),
      expired,
    ]);
    if (
      manifest.name !== packageName ||
      !versionParts(manifest.version) ||
      (channel === 'stable' && manifest.version.includes('-'))
    ) {
      throw Error('manifest');
    }
    return {
      package: packageName,
      installedVersion: currentVersion,
      channel,
      availableVersion: manifest.version,
      updateAvailable: newer(manifest.version, currentVersion),
      updateCommand: `npm install --global --registry=${registry} --@pulsarinteractive:registry=${registry} --ignore-scripts --engine-strict ${packageName}@${manifest.version}`,
      source: 'npm_registry',
    };
  } catch {
    fail('update_check_unavailable', 'Could not check for a GeniusTasker update.', {
      retryable: true,
      remediation: 'Keep using the installed version. Try update check later.',
    });
  } finally {
    clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener('abort', abort);
  }
}

const executeFile = promisify(execFile);
async function runNpm(args, { signal } = {}) {
  // Standard Windows Node installations include npm-cli.js beside node.exe.
  // Other layouts fail with manual guidance; never use a shell for npm specs.
  const executable = process.platform === 'win32' ? process.execPath : 'npm';
  const values =
    process.platform === 'win32'
      ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args]
      : args;
  return executeFile(executable, values, { signal, timeout: 120000, maxBuffer: 65536 });
}
export async function installUpdate({
  channel,
  currentVersion = metadata.version,
  fetchImpl,
  signal,
  npmImpl = runNpm,
  installedDirectory = packageDirectory,
  runtimeDirectory,
} = {}) {
  const result = await checkUpdate({ channel, currentVersion, fetchImpl, signal });
  if (!result.updateAvailable) {
    return { ...result, state: 'up_to_date', installed: false };
  }
  let globalDirectory;
  try {
    const { stdout } = await npmImpl(['root', '--global'], { signal });
    if (typeof stdout !== 'string' || stdout.length > 4096) {
      throw Error('root');
    }
    globalDirectory = join(stdout.trim(), '@pulsarinteractive', 'geniustasker');
    const installed = await lstat(globalDirectory);
    if (
      !installed.isDirectory() ||
      installed.isSymbolicLink() ||
      (await realpath(globalDirectory)) !== (await realpath(installedDirectory))
    ) {
      throw Error('installation');
    }
  } catch {
    fail('update_manual_required', 'This copy is not the active global npm installation.', {
      remediation: `For a global installation, run ${result.updateCommand}. For npx or a project, update its pinned package version.`,
    });
  }
  const release = await acquireInstallation(runtimeDirectory ?? runtimePath(installedDirectory));
  try {
    await npmImpl(
      [
        'install',
        '--global',
        `--registry=${registry}`,
        `--@pulsarinteractive:registry=${registry}`,
        '--ignore-scripts',
        '--engine-strict',
        `${packageName}@${result.availableVersion}`,
      ],
      { signal },
    );
    const manifest = JSON.parse(await readFile(join(globalDirectory, 'package.json'), 'utf8'));
    if (manifest.name !== packageName || manifest.version !== result.availableVersion) {
      throw Error('verification');
    }
  } catch {
    fail('update_install_unconfirmed', 'The update could not be confirmed.', {
      remediation: `Check the global installation before retrying. You can run ${result.updateCommand}. Your GeniusTasker connection and saved operations were not changed by the updater.`,
    });
  } finally {
    await release();
  }
  return { ...result, state: 'installed', installed: true, restartMcp: true };
}

/** One atomic attempt marker per installed version and UTC date, outside
 * account storage. A killed checker consumes only today's attempt and cannot
 * block tomorrow. Keep at most the recent marker window; no live lock stealing. */
export async function maybeNotifyUpdate({
  command,
  options = {},
  isTTY,
  stdout,
  stderr,
  env = process.env,
  cacheDirectory = join(homedir(), '.cache', 'geniustasker', 'cli-updates'),
  now = Date.now(),
  currentVersion = metadata.version,
  fetchImpl,
  signal,
} = {}) {
  if (
    !isTTY ||
    !stdout?.isTTY ||
    !stderr?.isTTY ||
    options.json ||
    options.help ||
    offlineCommands.has(command) ||
    command.startsWith('update') ||
    env.CI ||
    env.GENIUSTASKER_NO_UPDATE_CHECK === '1' ||
    signal?.aborted ||
    !versionParts(currentVersion) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    return;
  }
  try {
    await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });
    const directory = await lstat(cacheDirectory);
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      (process.platform !== 'win32' && directory.mode & 0o077) ||
      (process.getuid && directory.uid !== process.getuid())
    ) {
      return;
    }
    const day = Math.floor(now / dayMs);
    const entries = await opendir(cacheDirectory);
    let scanned = 0;
    for await (const entry of entries) {
      // Only this updater's dated, ordinary files are reclaimed. Unexpected
      // entries are left alone; a damaged cache cannot trigger an account read.
      const match = /^attempt-(\d+)-([0-9]+\.[0-9]+\.[0-9]+(?:-beta\.[0-9]+)?)\.json$/.exec(
        entry.name,
      );
      if (match && entry.isFile() && Number(match[1]) < day - 1) {
        await unlink(join(cacheDirectory, entry.name)).catch(() => {});
      }
      if (++scanned >= 64) {
        break;
      }
    }
    const path = join(cacheDirectory, `attempt-${day}-${currentVersion}.json`);
    const attempt = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    try {
      await attempt.writeFile(JSON.stringify({ installedVersion: currentVersion, checkedAt: now }));
    } finally {
      await attempt.close();
    }
    const result = await checkUpdate({ currentVersion, fetchImpl, signal, timeoutMs: 900 });
    if (result.updateAvailable) {
      stderr.write(
        `GeniusTasker ${result.availableVersion} is available. Run geniustasker update install to update.\n`,
      );
    }
  } catch {
    // Optional discovery cannot change a command receipt or leak diagnostics.
  }
}
