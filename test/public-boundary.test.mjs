import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { inspectPublicFile } from '../tools/check-public.mjs';
test('public export rejects private trees, actual-shaped credentials and symlinks', () => {
  for (const name of [
    'AGENTS.md',
    'AGENTS.local.md',
    'CLAUDE.md',
    '.codex/config.toml',
    '.env',
    'server/secrets.json',
    'lib/app.dart',
    'private/account.json',
  ]) {
    assert.throws(() => inspectPublicFile(name, 'ordinary text'));
  }
  for (const secret of [
    'npm_' + 'x'.repeat(40),
    'sk-proj-' + 'a'.repeat(40),
    'gta1.' + '1'.repeat(64) + '.wda_' + 'a'.repeat(43),
  ]) {
    assert.throws(() => inspectPublicFile('README.md', secret));
  }
  assert.throws(() => inspectPublicFile('README.md', 'text', { symlink: true }));
  assert.throws(() =>
    inspectPublicFile('src/unsafe.mjs', 'import x from ' + JSON.stringify('../../outside.mjs')),
  );
  inspectPublicFile('README.md', 'Public npm installation guide');
  inspectPublicFile('test/helpers.mjs', 'Synthetic tokens are constructed at runtime.');
});

test(
  'public scan runs when the checkout path contains a symlink',
  { skip: process.platform === 'win32' },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'agent-tools-check-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const linked = join(directory, 'checkout');
    await symlink(fileURLToPath(new URL('../', import.meta.url)), linked, 'dir');
    const output = execFileSync(process.execPath, [join(linked, 'tools/check-public.mjs')], {
      encoding: 'utf8',
    });
    assert.match(output, /Public boundary checked: [0-9]+ files/);
  },
);
