import { constants } from 'node:fs';
import { open, lstat, mkdir, readdir, rename, rm, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve, join, parse, dirname, relative, sep } from 'node:path';
import { fail } from './errors.mjs';

const manifestName = '.geniustasker-manifest.json';
const journalName = '.geniustasker-swap.json';
const lockName = '.geniustasker-sync.lock';
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function safeRelative(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..' || part.length > 240) ||
    // eslint-disable-next-line no-control-regex -- Control bytes cannot be generated paths.
    /[\u0000-\u001f\u007f:]/u.test(value)
  ) {
    fail(
      'unsafe_documentation_path',
      'Generated paths must remain inside the managed content directory.',
    );
  }
  return value;
}
async function stat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
/** Check each existing component before creating a missing one. A destination
 * containing symlinks is refused, including a symlink in an ancestor directory. */
async function directory(path, create = false) {
  const absolute = resolve(path),
    root = parse(absolute).root;
  let current = root;
  for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!(await stat(current)) && create) {
      await mkdir(current, { mode: 0o700 });
    }
    const info = await stat(current);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) {
      fail(
        'unsafe_documentation_path',
        'Documentation directories must be real directories, without symlinks.',
      );
    }
  }
  return absolute;
}
async function bytesAt(path, maximum = 33554432) {
  await directory(dirname(path));
  const info = await stat(path);
  if (!info?.isFile() || info.isSymbolicLink() || info.size > maximum) {
    fail(
      'unsafe_documentation_file',
      'A managed file is missing, oversized or not a regular file.',
    );
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return await file.readFile();
  } finally {
    await file.close();
  }
}
async function exclusive(path, bytes) {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}
async function syncDirectory(path) {
  const file = await open(path, 'r');
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
async function jsonAt(path) {
  try {
    return JSON.parse((await bytesAt(path)).toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail('invalid_documentation_manifest', 'The local documentation metadata is not valid JSON.');
    }
    throw error;
  }
}
function validateManifest(value) {
  if (
    value?.formatVersion !== 1 ||
    !value.files ||
    typeof value.files !== 'object' ||
    Array.isArray(value.files) ||
    typeof value.realm !== 'string' ||
    !Array.isArray(value.sources)
  ) {
    fail(
      'invalid_documentation_manifest',
      'The directory is not a recognized generated documentation snapshot.',
    );
  }
  for (const [name, file] of Object.entries(value.files)) {
    safeRelative(name);
    if (
      name.startsWith('.') ||
      !/^[a-f0-9]{64}$/.test(file.sha256 ?? '') ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    ) {
      fail('invalid_documentation_manifest', 'A tracked file has invalid metadata.');
    }
  }
  return value;
}
async function inventory(root, prefix = '') {
  const found = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      fail(
        'unsafe_documentation_file',
        'Symlinks and special files cannot be managed documentation.',
      );
    }
    if (entry.isDirectory()) {
      found.push(...(await inventory(root, path)));
    } else {
      found.push(path);
    }
  }
  return found;
}

/** All generated files live under content/. Other files in the chosen root are
 * untouched. A staged directory and recoverable rename journal publish the
 * manifest and its files together; interrupted downloads never look deleted. */
export class DocumentationStore {
  constructor(path, { maxFiles = 20000, maxBytes = 268435456 } = {}) {
    if (
      !Number.isSafeInteger(maxFiles) ||
      maxFiles < 1 ||
      maxFiles > 100000 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1024 ||
      maxBytes > 4294967296
    ) {
      fail('invalid_arguments', 'Use documented file and byte limits for repository sync.');
    }
    this.root = resolve(path);
    this.current = join(this.root, 'content');
    this.maxFiles = maxFiles;
    this.maxBytes = maxBytes;
  }
  async status() {
    if (!(await stat(this.root))) {
      return { configured: false };
    }
    await directory(this.root);
    if (await stat(join(this.root, journalName))) {
      return { interrupted: true };
    }
    if (!(await stat(this.current))) {
      return { configured: false };
    }
    await directory(this.current);
    return validateManifest(await jsonAt(join(this.current, manifestName)));
  }
  async recover() {
    const path = join(this.root, journalName);
    if (!(await stat(path))) {
      return;
    }
    const journal = await jsonAt(path);
    for (const [name, prefix] of [
      [journal.stage, '.stage-'],
      [journal.previous, '.previous-'],
    ]) {
      if (
        typeof name !== 'string' ||
        !name.startsWith(prefix) ||
        !/^[a-f0-9-]{36}$/.test(name.slice(prefix.length))
      ) {
        fail('invalid_documentation_manifest', 'The interrupted sync journal is invalid.');
      }
    }
    const previous = join(this.root, journal.previous),
      stage = join(this.root, journal.stage);
    for (const candidate of [this.current, previous, stage]) {
      if (await stat(candidate)) {
        await directory(candidate);
        validateManifest(await jsonAt(join(candidate, manifestName)));
      }
    }
    // Never publish a staged download after a crash without fresh authorization.
    // If the old snapshot was moved aside, restore it and perform a fresh sync.
    if (!(await stat(this.current)) && (await stat(previous))) {
      await rename(previous, this.current);
    }
    if (await stat(stage)) {
      await rm(stage, { recursive: true });
    }
    if (await stat(previous)) {
      await rm(previous, { recursive: true });
    }
    await unlink(path);
    await syncDirectory(this.root);
  }
  async unlock() {
    await directory(this.root);
    const path = join(this.root, lockName);
    if (!(await stat(path))) {
      return { unlocked: false };
    }
    const lock = await jsonAt(path);
    if (lock.hostname !== hostname() || !Number.isSafeInteger(lock.pid) || lock.pid < 1) {
      fail('documentation_locked', 'The lock belongs to another host or has invalid ownership.');
    }
    try {
      process.kill(lock.pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') {
        if (
          typeof lock.stage === 'string' &&
          /^\.stage-[a-f0-9-]{36}$/.test(lock.stage) &&
          !(await stat(join(this.root, journalName)))
        ) {
          const stage = join(this.root, lock.stage);
          if (await stat(stage)) {
            await directory(stage);
            await inventory(stage);
            await rm(stage, { recursive: true });
          }
        }
        await unlink(path);
        return { unlocked: true };
      }
      throw error;
    }
    fail('documentation_locked', 'The exporting process is still running.');
  }
  async run(callback) {
    await directory(this.root, true);
    this.stageName = '.stage-' + randomUUID();
    const lockPath = join(this.root, lockName);
    try {
      await exclusive(
        lockPath,
        JSON.stringify({
          pid: process.pid,
          hostname: hostname(),
          startedAt: new Date().toISOString(),
          stage: this.stageName,
        }),
      );
    } catch (error) {
      if (error.code === 'EEXIST') {
        fail(
          'documentation_locked',
          'Another sync owns this directory. Use docs unlock only after its process has stopped.',
        );
      }
      throw error;
    }
    try {
      await this.recover();
      this.previousManifest = (await stat(this.current))
        ? validateManifest(await jsonAt(join(this.current, manifestName)))
        : null;
      await this.assertUnchanged();
      this.stage = join(this.root, this.stageName);
      await mkdir(this.stage, { mode: 0o700 });
      this.files = Object.create(null);
      this.size = 0;
      this.fileCount = 0;
      return await callback(this);
    } finally {
      // A rename journal takes ownership during the commit window. Recovery
      // must retain its directories if a filesystem operation was interrupted.
      if (this.stage && !(await stat(join(this.root, journalName)))) {
        await rm(this.stage, { recursive: true, force: true });
      }
      await unlink(lockPath);
    }
  }
  async assertUnchanged() {
    if (!this.previousManifest) {
      if (await stat(this.current)) {
        fail(
          'documentation_conflict',
          'An existing content directory is not managed by this exporter.',
        );
      }
      return;
    }
    await directory(this.current);
    const expected = this.previousManifest.files;
    const actual = (await inventory(this.current)).filter((name) => name !== manifestName);
    if (
      actual.length !== Object.keys(expected).length ||
      actual.some((name) => !Object.hasOwn(expected, name))
    ) {
      fail(
        'documentation_conflict',
        'The generated content directory contains local additions or removals. Preserve them outside content/ before syncing.',
      );
    }
    for (const name of actual) {
      const bytes = await bytesAt(join(this.current, name));
      if (digest(bytes) !== expected[name].sha256 || bytes.length !== expected[name].size) {
        fail(
          'documentation_conflict',
          'A generated file was edited locally. Apply the change through MCP and preserve the local edit before syncing.',
        );
      }
    }
  }
  async readPrevious(name) {
    safeRelative(name);
    if (!Object.hasOwn(this.previousManifest?.files ?? {}, name)) {
      return null;
    }
    const bytes = await bytesAt(join(this.current, name));
    if (digest(bytes) !== this.previousManifest.files[name].sha256) {
      fail('documentation_conflict', 'A generated file changed during sync.');
    }
    return bytes;
  }
  async put(name, input) {
    safeRelative(name);
    if (name.startsWith('.')) {
      fail('unsafe_documentation_path', 'Generated content cannot overwrite sync metadata.');
    }
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const sha256 = digest(bytes);
    if (this.files[name]) {
      if (this.files[name].sha256 !== sha256) {
        fail('documentation_conflict', 'Two sources produced the same generated path.');
      }
      return;
    }
    if (
      this.fileCount >= this.maxFiles ||
      this.size + bytes.length > this.maxBytes ||
      bytes.length > 33554432
    ) {
      fail(
        'documentation_capacity',
        'This export exceeds its file or byte budget. Narrow the selection or explicitly increase the documented sync limits.',
      );
    }
    await directory(dirname(join(this.stage, name)), true);
    await exclusive(join(this.stage, name), bytes);
    this.files[name] = { sha256, size: bytes.length };
    this.size += bytes.length;
    this.fileCount++;
  }
  async discardPrefix(prefix) {
    safeRelative(prefix);
    const files = Object.keys(this.files).filter((name) => name.startsWith(prefix + '/'));
    for (const name of files) {
      this.size -= this.files[name].size;
      this.fileCount--;
      delete this.files[name];
    }
    const path = join(this.stage, prefix);
    if (await stat(path)) {
      await directory(path);
      await inventory(path);
      await rm(path, { recursive: true });
    }
  }
  async commit(metadata) {
    await this.assertUnchanged();
    const manifest = { ...metadata, formatVersion: 1, files: this.files };
    validateManifest(manifest);
    const body = JSON.stringify(manifest, null, 2) + '\n';
    if (Buffer.byteLength(body) > 33554432) {
      fail('documentation_capacity', 'The export manifest exceeds its size budget.');
    }
    await exclusive(join(this.stage, manifestName), body);
    await syncDirectory(this.stage);
    const previousName = '.previous-' + randomUUID(),
      previous = join(this.root, previousName);
    await exclusive(
      join(this.root, journalName),
      JSON.stringify({ stage: this.stageName, previous: previousName }),
    );
    await syncDirectory(this.root);
    if (await stat(this.current)) {
      await rename(this.current, previous);
    }
    await rename(this.stage, this.current);
    await syncDirectory(this.root);
    if (await stat(previous)) {
      await rm(previous, { recursive: true });
    }
    await unlink(join(this.root, journalName));
    await syncDirectory(this.root);
    return manifest;
  }
}

/** Interrupted downloads live in the private credential directory, outside the
 * repository. Callers must prove current access and a matching source revision
 * before choosing a cache key. The cache is not an offline authorization path. */
export class DocumentationDownloads {
  constructor(credentialDirectory, outputDirectory, realm, { maxBytes = 268435456 } = {}) {
    if (typeof credentialDirectory !== 'string' || !credentialDirectory) {
      fail(
        'invalid_arguments',
        'A private client credential directory is required for resumable documentation.',
      );
    }
    this.root = join(
      resolve(credentialDirectory),
      'documentation-cache',
      digest(resolve(outputDirectory)),
    );
    this.realm = realm;
    this.maxBytes = maxBytes * 2;
  }
  async begin(sources) {
    await directory(this.root, true);
    const marker = join(this.root, 'owner.json');
    if (await stat(marker)) {
      if ((await jsonAt(marker)).realm !== this.realm) {
        fail(
          'documentation_account_mismatch',
          'A pending export belongs to another account or environment.',
        );
      }
    } else {
      await exclusive(marker, JSON.stringify({ realm: this.realm }));
    }
    const allowed = new Set(sources.map((source) => digest(source.scope)));
    for (const entry of await readdir(this.root, { withFileTypes: true })) {
      if (entry.name === 'owner.json') {
        continue;
      }
      if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[a-f0-9]{64}$/.test(entry.name)) {
        fail(
          'unsafe_documentation_file',
          'The private download cache contains an unexpected entry.',
        );
      }
      if (!allowed.has(entry.name)) {
        await this.removeDirectory(join(this.root, entry.name));
      }
    }
    this.size = 0;
    for (const name of await inventory(this.root)) {
      this.size += (await stat(join(this.root, name))).size;
    }
    if (this.size > this.maxBytes) {
      fail(
        'documentation_capacity',
        'Pending downloads exceed this export budget. Use its previous budget or clear the pending cache.',
      );
    }
  }
  source(scope) {
    return join(this.root, digest(scope));
  }
  async removeDirectory(path) {
    await directory(path);
    await inventory(path);
    await rm(path, { recursive: true });
  }
  async prepare(scope, pages, tree) {
    const root = this.source(scope);
    await directory(root, true);
    const allowed = new Set(
      Object.values(pages).map((page) => digest(this.pageKey(scope, page, tree))),
    );
    const pageRoot = join(root, 'pages');
    await directory(pageRoot, true);
    for (const entry of await readdir(pageRoot, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
        fail('unsafe_documentation_file', 'The private page cache is invalid.');
      }
      if (!allowed.has(entry.name.slice(0, -5))) {
        await this.removeFile(join(pageRoot, entry.name));
      }
    }
    // Graph inventories carry a scope checkpoint. A changed checkpoint requires
    // a new initial snapshot; unchanged inventories can resume after throttling.
    const snapshots = join(root, 'snapshots');
    await directory(snapshots, true);
    const context = digest(JSON.stringify([tree.epoch, tree.accessRevision, tree.checkpoint]));
    for (const entry of await readdir(snapshots, { withFileTypes: true })) {
      if (entry.name !== context) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
          fail('unsafe_documentation_file', 'The private Graph cache is invalid.');
        }
        const path = join(snapshots, entry.name);
        for (const name of await inventory(path)) {
          this.size -= (await stat(join(path, name))).size;
        }
        await this.removeDirectory(path);
      }
    }
    await directory(join(snapshots, context), true);
  }
  pageKey(scope, page, tree) {
    return JSON.stringify([scope, tree.epoch, tree.accessRevision, page.id, page.revision]);
  }
  graphBucket(tree) {
    return `snapshots/${digest(JSON.stringify([tree.epoch, tree.accessRevision, tree.checkpoint]))}/graph`;
  }
  mediaBucket(tree) {
    return `snapshots/${digest(JSON.stringify([tree.epoch, tree.accessRevision, tree.checkpoint]))}/media`;
  }
  async removeFile(path) {
    const info = await stat(path);
    if (info) {
      this.size -= info.size;
      await unlink(path);
    }
  }
  async read(scope, bucket, key, maximum = 262144) {
    const path = join(this.source(scope), safeRelative(bucket), digest(key) + '.json');
    if (!(await stat(path))) {
      return null;
    }
    let record;
    try {
      record = JSON.parse(
        (await bytesAt(path, Math.ceil((maximum * 4) / 3) + 1024)).toString('utf8'),
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        await this.removeFile(path);
        return null;
      }
      throw error;
    }
    if (typeof record?.data !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) {
      await this.removeFile(path);
      return null;
    }
    const bytes = Buffer.from(record.data, 'base64');
    if (bytes.length > maximum || digest(bytes) !== record.sha256) {
      await this.removeFile(path);
      return null;
    }
    return bytes;
  }
  async put(scope, bucket, key, bytes) {
    const path = join(this.source(scope), safeRelative(bucket), digest(key) + '.json');
    if (await stat(path)) {
      return;
    }
    const encoded = JSON.stringify({ sha256: digest(bytes), data: bytes.toString('base64') });
    if (this.size + Buffer.byteLength(encoded) > this.maxBytes) {
      fail('documentation_capacity', 'Resumable downloads exceed the explicit export budget.');
    }
    await directory(dirname(path), true);
    await exclusive(path, encoded);
    this.size += Buffer.byteLength(encoded);
  }
  async clearSource(scope) {
    const path = this.source(scope);
    if (!(await stat(path))) {
      return;
    }
    for (const name of await inventory(path)) {
      this.size -= (await stat(join(path, name))).size;
    }
    await this.removeDirectory(path);
  }
  async finish() {
    await this.removeDirectory(this.root);
  }
}
