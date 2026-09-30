import { constants } from 'node:fs';
import { mkdir, lstat, open, rename, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fail } from './errors.mjs';

/** Dedicated directory only: do not point at a repository or a shared folder.
 * File permissions protect against other OS users, not processes of this user.
 * A hard crash deliberately leaves a lock/refresh marker rather than risking a
 * second use of a rotated refresh token. Doctor explains recovery. */
export class CredentialStore {
  constructor({ directory = join(homedir(), '.geniustasker'), context = 'default', lockTimeoutMs = 20000, maxBytes = 16384 } = {}) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$/.test(context)) fail('invalid_arguments', 'Context names use 1–48 letters, numbers, underscores or hyphens.');
    this.context = context; this.maxBytes = maxBytes;
    this.directory = resolve(directory); this.path = join(this.directory, `${context}.json`); this.lockPath = `${this.path}.lock`; this.lockTimeoutMs = lockTimeoutMs;
  }
  async prepare() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid()) || process.platform !== 'win32' && (stat.mode & 0o077))
      fail('unsafe_credential_store', 'The credential directory must be private and owned by you.', { remediation: 'Use a dedicated directory with permissions 0700.' });
  }
  async read() {
    await this.prepare(); let handle;
    try { handle = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (error.code === 'ENOENT') return null; fail('unsafe_credential_store', 'The credential file could not be opened safely.'); }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > this.maxBytes || process.platform !== 'win32' && (stat.mode & 0o077) || process.getuid && stat.uid !== process.getuid())
        fail('unsafe_credential_store', 'The credential file must be private and owned by you.');
      try { return JSON.parse(await handle.readFile('utf8')); }
      catch { fail('invalid_credential_store', 'The credential file is damaged.', { remediation: 'Revoke the session in Account → Agents, then remove this context and log in again.' }); }
    } finally { await handle.close(); }
  }
  async write(data) {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(data)); await handle.sync(); }
    finally { await handle.close(); }
    try {
      await rename(temporary, this.path);
      if (process.platform !== 'win32') {
        const directory = await open(this.directory, constants.O_RDONLY);
        try { await directory.sync(); } finally { await directory.close(); }
      }
    }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  async remove() { await unlink(this.path).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  async locked(callback, signal) {
    await this.prepare(); const deadline = Date.now() + this.lockTimeoutMs;
    while (true) {
      try { await mkdir(this.lockPath, { mode: 0o700 }); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) fail('credential_store_busy', 'Another command owns this credential context.', { retryable: true,
          remediation: 'Wait for that command. After a crash, stop all clients using this context, then remove its empty .lock directory.' });
        await delay(50, undefined, { signal });
      }
    }
    try { return await callback(); }
    finally { await rmdir(this.lockPath); }
  }
}
