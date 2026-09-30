import { test } from 'node:test';
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
