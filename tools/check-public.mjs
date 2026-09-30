import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = /^(?:README\.md|CHANGELOG\.md|CONTRIBUTING\.md|SECURITY\.md|\.gitignore|package(?:-lock)?\.json|plugin\.json|mcp\.json|\.agents\/plugins\/marketplace\.json|\.github\/workflows\/ci\.yml|(?:bin|src)\/[a-z-]+\.mjs|test\/(?:fixtures\/)?[a-z.-]+\.mjs|tools\/(?:check-public|check-package|check-plugin)\.mjs|tools\/schemas\/(?:plugin|mcp)\.schema\.json|docs\/[A-Z]+\.md|examples\/(?:mcp\.json|codex\.toml)|skills\/[a-z-]+\/(?:SKILL\.md|references\/[a-z-]+\.md|agents\/openai\.yaml))$/;
const blocked = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
  /(?:gh[pousr]_|github_pat_|npm_)[A-Za-z0-9_]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gta1\.[0-9a-f]{64}\.(?:wda|wdr)_[A-Za-z0-9_-]{40,}/,
  /eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/,
  /\/(?:Users|home)\/[a-zA-Z0-9._-]+\//,
  /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|icloud)\.com/i,
  /(?:AGENT_USER_IDS|MIGRATION_TOKEN|_authToken)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/,
];
export function inspectPublicFile(name, text, {symlink=false,size=Buffer.byteLength(text)}={}) {
  if(!allowed.test(name)) throw Error(`Outside public allowlist: ${name}`);
  if(symlink || size>150000 || text.includes('\0')) throw Error(`Unsafe public file: ${name}`);
  if(blocked.some(rule=>rule.test(text))) throw Error(`Private material rejected: ${name}`);
  if(name.endsWith('.mjs')) for(const match of text.matchAll(/(?:from\s*|import\()['"]([^'"]+)['"]/g)) {
    if(match[1].startsWith('/') || (match[1].startsWith('.') && !resolve(root,dirname(name),match[1]).startsWith(root))) throw Error(`Import escapes repository: ${name}`);
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))];
  if(files.length<20) throw Error('Incomplete repository inventory');
  for(const name of files){ const p=resolve(root,name),stat=lstatSync(p);inspectPublicFile(name,readFileSync(p,'utf8'),{symlink:stat.isSymbolicLink(),size:stat.size}); }
  console.log(`Public boundary checked: ${files.length} files; no secret values printed.`);
}
