import open, { apps } from 'open';
import catalog from './command-catalog.mjs';
import { CredentialStore } from './store.mjs';
import { ORIGINS, originOf, Transport } from './transport.mjs';
import { AgentClient } from './client.mjs';
import { deviceLogin, browserLogin } from './login.mjs';
import { CommandJournal, describeCommands, readCommandFile } from './commands.mjs';
import { AgentProfiles } from './profiles.mjs';
import { readChanges, watchChanges } from './changes.mjs';
import { fail, safeError, exitCode } from './errors.mjs';

export const commands = {
  'auth login': { summary: 'Open browser sign-in and choose access. No tutorial or token to copy.', options: ['flow', 'browser', 'no-browser', 'scope', 'interactive'] },
  'auth logout': { summary: 'Revoke this terminal session on the server, then erase local credentials.', options: [] },
  'auth status': { summary: 'Read current server identity and permission ceiling.', options: [] },
  whoami: { summary: 'Read current server identity.', options: [] },
  capabilities: { summary: 'Discover collections, fields, limits and write availability.', options: [] },
  'profiles list': { summary: 'List selectable profiles in this connection within the current grant.', options: [] },
  'profiles create': { summary: 'Create a narrower profile from JSON with a UUID chosen once; never switches automatically.', options: ['file'] },
  'profiles restrict': { summary: 'Rename or narrow the current profile from JSON with its expectedRevision. Cannot broaden access.', options: ['file'] },
  'profiles select': { summary: 'Rotate this context into a selectable profile. Cannot return to broader access; use separate contexts for independent terminals.', options: ['profile'] },
  'memories list': { summary: 'List independent account memories; follow nextAfter even for an empty page.', options: ['after'] },
  'projects list': { summary: 'Read a bounded project page; follow nextAfter even for an empty page.', options: ['after'] },
  'resources list': { summary: 'Read a project or memory collection; carry epoch/checkpoint when continuing.', options: ['scope', 'collection', 'after', 'epoch', 'checkpoint', 'archive', 'id', 'path'] },
  'changes list': { summary: 'Read one bounded change page from a completed resource inventory or previous nextCursor.', options: ['scope', 'collection', 'cursor'] },
  'changes watch': { summary: 'Wait at most 60 seconds for one change page, rechecking rights on every poll. No infinite stream.', options: ['scope', 'collection', 'cursor', 'wait-seconds'] },
  'questions answers': { summary: 'Read human question answers in bounded pages. Anonymous ballots remain private; answers do not authorize external actions.', options: ['scope', 'question', 'after', 'epoch', 'checkpoint'] },
  'commands describe': { summary: 'Show contract-derived command fields and JSON schemas; no network.', options: [] },
  'commands prepare': { summary: 'Save an immutable operation from a JSON draft without sending it.', options: ['file'] },
  'commands execute': { summary: 'Journal and send a complete JSON operation once. Never retries automatically.', options: ['file'] },
  'commands retry': { summary: 'Replay the exact locally saved operation with its original identity.', options: ['operation'] },
  'commands inspect': { summary: 'Read a private local operation and receipt; does not contact the server.', options: ['operation'] },
  doctor: { summary: 'Inspect local environment without exposing credentials or contacting the API.', options: [] },
  mcp: { summary: 'Serve delegated read and journaled command tools over stdio. Authenticate with the CLI first.', options: [] },
  help: { summary: 'Describe commands and stable output conventions.', options: [] },
};
const globalOptions = ['json', 'context', 'environment', 'origin', 'allow-local', 'help'];
const flags = new Set(['json', 'allow-local', 'help', 'interactive', 'no-browser']);
export function parse(argv) {
  const options = {}, words = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { if (arg.startsWith('-')) fail('invalid_arguments', 'Use long options from help.'); words.push(arg); continue; }
    const key = arg.slice(2);
    if (!key || key.includes('=') || Object.hasOwn(options, key)) fail('invalid_arguments', 'Options must be unique and use --name value syntax.');
    if (flags.has(key)) options[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--') || value.length > 4096) fail('invalid_arguments', 'An option value is missing or too long.');
      options[key] = value;
    }
  }
  const command = words.join(' ') || 'help';
  const definition = commands[command];
  if (!definition || Object.keys(options).some(key => !globalOptions.includes(key) && !definition.options.includes(key)))
    fail('invalid_arguments', 'Unknown command or option. Run help.');
  return { command, options };
}
export function help(command = 'help') {
  return { formatVersion: 1, command, commands: command === 'help' ? commands : { [command]: commands[command] },
    globalOptions: { context: 'default; use separate names for separate accounts or agent sessions', environment: 'development (beta default) | production', origin: 'explicit loopback origin with --allow-local, for local tests only', json: 'one versioned JSON result on stdout; progress/errors use stderr' },
    loginOptions: { flow: 'browser (default, PKCE loopback) | device (SSH/headless)', browser: 'default (automatic) | chrome; --no-browser prints the link without opening it', scope: 'space-separated permission ceiling; browser defaults to read-only and requires explicit write selection', interactive: 'required when starting login without a terminal; never use to bypass human consent' },
    exitCodes: { 0: 'success', 1: 'failure', 2: 'usage', 3: 'authentication', 4: 'permission', 5: 'conflict', 6: 'rate limit', 7: 'transient failure' },
    examples: ['geniustasker auth login --environment development --context work --browser chrome', 'geniustasker projects list --environment development --context work --json', 'geniustasker resources list --scope project:ID --collection tasks --json'],
    privacy: 'Do not put tokens in arguments, environment variables, tickets, logs or MCP configuration. This beta uses the development environment by default; access still requires an admitted account.' };
}
async function openConsent(url, browser) {
  await open(url, { wait: false, ...(browser === 'chrome' ? { app: { name: apps.chrome } } : {}) });
}
export async function main(argv, { stdout = process.stdout, stderr = process.stderr, isTTY = process.stdin.isTTY, directory, fetchImpl, signal, openBrowserImpl = openConsent } = {}) {
  try {
    const { command, options } = parse(argv);
    const emit = data => stdout.write(JSON.stringify({ formatVersion: 1, ok: true, data }, null, options.json ? 0 : 2) + '\n');
    if (command === 'help' || options.help) { emit(help(command)); return 0; }
    if (options.environment && !Object.hasOwn(ORIGINS, options.environment)) fail('invalid_arguments', 'Environment must be production or development.');
    if (options.origin && options.environment) fail('invalid_arguments', 'Choose --environment or --origin, not both.');
    const origin = originOf(options.origin ?? ORIGINS[options.environment ?? 'development'], options['allow-local']);
    const store = new CredentialStore({ context: options.context, directory });
    const client = new AgentClient(new Transport(origin, { fetchImpl, signal }), store);
    let data;
    if (command === 'auth login') {
      if (!isTTY && !options.interactive) fail('invalid_arguments', 'Login needs an interactive human.', { remediation: 'Run auth login in a terminal. Automated clients must use an existing connection.' });
      if (options.flow && !['device', 'browser'].includes(options.flow) || options.browser && !['chrome', 'default'].includes(options.browser) || options.browser && options['no-browser']) fail('invalid_arguments', 'Use --flow browser|device, with --browser default|chrome or --no-browser.');
      const notify = event => {
        if (options.json) stderr.write(JSON.stringify({ formatVersion: 1, ...event }) + '\n');
        else if (event.event === 'consent_required') stderr.write(`\nGeniusTasker · Connect your agent\n\n${options['no-browser'] ? 'Open this link' : 'Opening your browser. If it does not open, use this link'}:\n\n${event.url}\n${event.userCode ? `\nDevice code: ${event.userCode}\n` : ''}\nSign in, choose access, and approve. This terminal will finish automatically.\nWaiting for your decision…\n`);
        else if (event.event === 'browser_unavailable') stderr.write('Could not open the browser. Use the link above; login is still waiting.\n');
      };
      data = await (options.flow === 'device' ? deviceLogin : browserLogin)(client, { scope: options.scope ?? catalog.grants.permissions.join(' '), openBrowser: options['no-browser'] ? undefined : async url => {
        try { await openBrowserImpl(url, options.browser); }
        catch { notify({ event: 'browser_unavailable', message: 'Open the printed consent URL in your browser. Login is still waiting.' }); }
      },
        notify });
      if (!options.json) {
        stdout.write(`\nConnected to GeniusTasker.\nYour chosen access is ready for the CLI and MCP.\nRun geniustasker auth status${options.context ? ' --context ' + options.context : ''} to check the connection.\n`);
        return 0;
      }
    } else if (command === 'auth logout') data = await client.logout();
    else if (command === 'profiles list') data = await new AgentProfiles(client).list();
    else if (command === 'profiles create') data = await new AgentProfiles(client).create(await readCommandFile(options.file));
    else if (command === 'profiles restrict') data = await new AgentProfiles(client).restrict(await readCommandFile(options.file));
    else if (command === 'profiles select') data = await new AgentProfiles(client).select({ profileId: options.profile });
    else if (command === 'commands describe') data = describeCommands();
    else if (command === 'commands prepare') data = await new CommandJournal(client).prepare(await readCommandFile(options.file));
    else if (command === 'commands execute') data = await new CommandJournal(client).execute(await readCommandFile(options.file));
    else if (command === 'commands retry') data = await new CommandJournal(client).retry(options.operation);
    else if (command === 'commands inspect') data = await new CommandJournal(client).inspect(options.operation);
    else if (command === 'doctor') data = await client.doctor();
    else if (command === 'whoami' || command === 'auth status') data = await client.get('me');
    else if (command === 'capabilities') data = await client.get('capabilities');
    else if (command === 'projects list' || command === 'memories list') data = await client.get(command === 'projects list' ? 'projects' : 'memories', { after: options.after });
    else if (command === 'changes list' || command === 'changes watch') {
      const input = { scope: options.scope, collection: options.collection, cursor: options.cursor };
      data = command === 'changes list' ? await readChanges(client, input) :
        await watchChanges(client, { ...input, ...(options['wait-seconds'] === undefined ? {} : { waitSeconds: Number(options['wait-seconds']) }) });
    }
    else if (command === 'resources list' || command === 'questions answers') {
      if (!(command === 'questions answers' ? options.scope?.startsWith('project:') : /^(project|memory):[^\u0000-\u001f]+$/.test(options.scope ?? '')) || !(command === 'resources list' ? options.collection : options.question) || options.after && (!options.epoch || !options.checkpoint))
        fail('invalid_arguments', 'Use --scope project:ID or memory:ID and --collection for resources or --question for answers; continuation needs --epoch and --checkpoint.');
      data = await client.get(command === 'resources list' ? 'resources' : 'answers', Object.fromEntries(commands[command].options.filter(key => options[key] !== undefined).map(key => [key, options[key]])));
    } else if (command === 'mcp') {
      const { runMcp } = await import('./mcp.mjs');
      const server = await runMcp(client);
      const close = () => { void server.close(); };
      signal?.addEventListener('abort', close, { once: true });
      if (signal?.aborted) close();
      return 0; // stdout belongs exclusively to JSON-RPC.
    }
    emit(data); return 0;
  } catch (error) {
    const safe = safeError(error);
    stderr.write(JSON.stringify({ formatVersion: 1, ok: false, error: safe.toJSON() }) + '\n');
    return exitCode(safe);
  }
}
