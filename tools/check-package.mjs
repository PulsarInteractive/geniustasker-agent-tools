import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
  }),
);
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (
  metadata.name !== '@pulsarinteractive/geniustasker' ||
  metadata.publishConfig?.access !== 'public' ||
  metadata.publishConfig?.tag !== 'beta' ||
  !/^\d+\.\d+\.\d+-beta\.\d+$/.test(metadata.version)
) {
  throw Error('Release metadata must target the reviewed beta package');
}
if (metadata.license !== 'MIT' || !pack.files.some((entry) => entry.path === 'LICENSE')) {
  throw Error('The public archive must include its MIT license');
}
const readme = await readFile(join(root, 'README.md'), 'utf8');
if (readme.split('\n')[0] !== '# GeniusTasker CLI & MCP' || /private beta/i.test(readme)) {
  throw Error('Use the product title and keep release details in the documentation');
}
const allowed =
  /^(LICENSE|LICENSES\/Apache-2\.0\.txt|THIRD_PARTY_NOTICES\.md|package\.json|README\.md|CHANGELOG\.md|CONTRIBUTING\.md|SECURITY\.md|examples\/(?:mcp\.json|codex\.toml)|plugin\.json|mcp\.json|docs\/[A-Z]+\.md|bin\/[a-z-]+\.mjs|src\/[a-z-]+\.mjs|skills\/[a-z-]+\/SKILL\.md|skills\/[a-z-]+\/references\/[a-z-]+\.md|skills\/[a-z-]+\/agents\/openai\.yaml)$/;
for (const entry of pack.files) {
  if (!allowed.test(entry.path)) {
    throw Error(`Unexpected package file: ${entry.path}`);
  }
  const path = join(root, entry.path),
    stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100000) {
    throw Error('Unsafe package entry');
  }
  const text = await readFile(path, 'utf8');
  if (
    /sk-proj-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\/Users\/|\.dev\.vars|AGENT_USER_IDS\s*[:=]/u.test(
      text,
    )
  ) {
    throw Error(`Private material in package: ${entry.path}`);
  }
  if (entry.path.endsWith('.mjs')) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    for (const match of text.matchAll(/(?:from\s*|import\()['"]([^'"]+)['"]/g)) {
      const target = match[1];
      if (target.startsWith('.') && !resolve(path, '..', target).startsWith(root)) {
        throw Error('Import escapes standalone package');
      }
      if (target.startsWith('/')) {
        throw Error('Absolute package import');
      }
    }
  }
}
console.log(
  `Standalone package checked: ${pack.files.length} allowlisted files, ${pack.unpackedSize} unpacked bytes. No publication performed.`,
);
