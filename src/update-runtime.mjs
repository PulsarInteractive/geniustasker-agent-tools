import { constants, unlinkSync } from 'node:fs';
import { lstat, mkdir, open, opendir, realpath, rmdir, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './errors.mjs';

const installation = fileURLToPath(new URL('../', import.meta.url));
// The package's canonical path separates global, npx and source installations.
// This directory never contains account IDs, credentials or operation bodies.
export async function runtimePath(packageDirectory = installation) {
  const path = await realpath(packageDirectory);
  const key = createHash('sha256').update(path).digest('hex').slice(0, 24);
  return join(homedir(), '.cache', 'geniustasker', 'cli-runtime', key);
}

function busy() {
  fail('update_runtime_busy', 'Another GeniusTasker process or installer is active.', {
    status: 409,
    remediation:
      'Let CLI commands finish and close local MCP servers before updating. Retry the same saved operation after restarting; do not remove its journal. An interrupted installer leaves install.lock; remove that empty directory only after all clients and npm installers have stopped.',
  });
}
async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (process.getuid && info.uid !== process.getuid()) ||
    (process.platform !== 'win32' && info.mode & 0o077)
  ) {
    fail(
      'unsafe_update_runtime',
      'The local update runtime directory must be private and owned by you.',
    );
  }
}
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/** Readers register before checking the writer barrier. Writers create that
 * barrier before checking readers. Every interleaving either observes a reader
 * or rejects it before work begins; regular commands can still run concurrently.
 */
export async function acquireRuntime(directory = runtimePath()) {
  directory = await directory;
  await privateDirectory(directory);
  const active = join(directory, 'active');
  await privateDirectory(active);
  const path = join(active, `${process.pid}-${randomUUID()}.lock`);
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  await handle.close();
  const cleanup = () => {
    try {
      unlinkSync(path);
    } catch {
      /* Dead-process records are reclaimed on install. */
    }
  };
  process.once('exit', cleanup);
  let released = false;
  const release = async () => {
    if (released) {
      return;
    }
    released = true;
    process.removeListener('exit', cleanup);
    await unlink(path).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  };
  try {
    if (await exists(join(directory, 'install.lock'))) {
      busy();
    }
    return release;
  } catch (error) {
    await release();
    throw error;
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}
export async function acquireInstallation(directory = runtimePath()) {
  directory = await directory;
  await privateDirectory(directory);
  const active = join(directory, 'active');
  await privateDirectory(active);
  const lock = join(directory, 'install.lock');
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') {
      busy();
    }
    throw error;
  }
  let released = false;
  const release = async () => {
    if (released) {
      return;
    }
    released = true;
    await rmdir(lock);
  };
  try {
    const entries = await opendir(active);
    let count = 0;
    for await (const entry of entries) {
      if (++count > 256) {
        busy();
      }
      const match = /^([1-9]\d*)-[a-f0-9-]{36}\.lock$/.exec(entry.name);
      const path = join(active, entry.name);
      let info;
      try {
        info = await lstat(path);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }
      if (
        !match ||
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.nlink !== 1 ||
        (process.getuid && info.uid !== process.getuid()) ||
        (process.platform !== 'win32' && info.mode & 0o077) ||
        !Number.isSafeInteger(Number(match[1])) ||
        processAlive(Number(match[1]))
      ) {
        busy();
      }
      // Unique filenames are never reused. Only positively dead processes are
      // reclaimed; PID reuse and inaccessible processes conservatively block.
      await unlink(path).catch((error) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
    return release;
  } catch (error) {
    await release();
    throw error;
  }
}
