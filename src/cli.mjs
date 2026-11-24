import { withFeedbackDiscovery } from './presentation.mjs';
import {
  readFeedbackCapabilities,
  readFeedbackPage,
  readFeedbackDetail,
  readFeedbackReceipt,
  markFeedbackRead,
  removeFeedbackImage,
} from './feedback.mjs';
import {
  prepareFeedbackImage,
  uploadFeedbackImage,
  downloadFeedbackImage,
} from './feedback-media-transfer.mjs';
import { prepareTicketUpload, uploadTicketAttachment } from './attachment-upload.mjs';
import { ticketStorageTools, ticketStorageRequest } from './ticket-storage.mjs';
import { readArchive } from './archive.mjs';
import {
  readProjectDocumentation,
  reviewProjectMemory,
  previewMemoryTemplate,
} from './memory-editorial.mjs';
import { pageDraftRequest } from './page-drafts.mjs';
import { memoryHistoryRequest } from './memory-history.mjs';
import { readMemoryPages } from './memory-read-pages.mjs';
import { workflow, workflowTopics } from './workflows.mjs';
import { readFile } from 'node:fs/promises';
import {
  syncDocumentation,
  documentationStatus,
  unlockDocumentation,
} from './documentation-sync.mjs';
import open, { apps } from 'open';
import { CredentialStore } from './store.mjs';
import { ORIGINS, originOf, Transport } from './transport.mjs';
import { AgentClient } from './client.mjs';
import { deviceLogin, browserLogin } from './login.mjs';
import { CommandJournal, describeCommands, commandHelp, readCommandFile } from './commands.mjs';
import { AgentProfiles } from './profiles.mjs';
import { readChanges, watchChanges } from './changes.mjs';
import { readMemoryTree, readMemoryMarkdown } from './documentation.mjs';
import { searchMemory, exploreGraph, resolveMemory } from './knowledge.mjs';
import { previewProtocol } from './protocols.mjs';
import { readIntents, previewIntent } from './intents.mjs';
import { reportRunEvent } from './run-events.mjs';
import { readResources, readMetrics } from './resources.mjs';
import { MediaJournal, mediaAction, downloadMedia, compareMedia } from './media.mjs';
import { fail, safeError, exitCode } from './errors.mjs';
import { checkUpdate, installUpdate, maybeNotifyUpdate } from './update.mjs';
import { acquireRuntime } from './update-runtime.mjs';

export const commands = {
  'feedback capabilities': {
    summary: 'Read private feedback eligibility, current epoch and image limits.',
    options: [],
  },
  'feedback prepare': {
    summary:
      'Save an immutable draft from JSON without sending. Reads current epoch once if omitted.',
    options: ['file'],
  },
  'feedback submit': {
    summary: 'Send exact approved feedback JSON with its saved command and draft IDs.',
    options: ['file'],
  },
  'feedback list': {
    summary: 'Read one bounded page of your Starter/Pro feedback.',
    options: ['status', 'type', 'after'],
  },
  'feedback show': {
    summary:
      'Read one exact private request, its status, resolution and optional final decision message.',
    options: ['id'],
  },
  'feedback receipt': {
    summary: 'Recover delivery by exact command ID, including Free bug reports.',
    options: ['id'],
  },
  'feedback media-prepare': {
    summary: 'Inspect one local screenshot up to 4 MB and prepare metadata; no network.',
    options: ['draft-id', 'epoch', 'file'],
  },
  'feedback media-open': {
    summary: 'Reserve one screenshot from prepared JSON before sending feedback.',
    options: ['file'],
  },
  'feedback media-upload': {
    summary: 'Upload exact reserved bytes for server compression or replay a confirmed receipt.',
    options: ['operation', 'file'],
  },
  'feedback mark-read': {
    summary: 'Mark the exact viewed decision revision as read from JSON.',
    options: ['file'],
  },
  'feedback media-remove': {
    summary: 'Remove one exact screenshot at the user’s request.',
    options: ['id'],
  },
  'feedback media-download': {
    summary: 'Download an authorized feedback screenshot to a new file.',
    options: ['id', 'file'],
  },

  'update check': {
    summary: 'Check the official npm registry for this installation channel; no account access.',
    options: ['channel'],
  },
  'update install': {
    summary: 'Explicitly update a global npm installation when no CLI or MCP process is active.',
    options: ['channel'],
  },
  'workflow show': {
    summary: 'Read a reviewed workflow guide offline.',
    options: ['topic'],
    topics: workflowTopics,
  },
  'auth login': {
    summary: 'Open browser sign-in and choose access. No tutorial or token to copy.',
    options: ['flow', 'browser', 'no-browser', 'scope', 'interactive'],
  },
  'auth logout': {
    summary: 'Revoke this terminal session on the server, then erase local credentials.',
    options: [],
  },
  'auth status': { summary: 'Read current server identity and permission ceiling.', options: [] },
  whoami: { summary: 'Read current server identity.', options: [] },
  capabilities: {
    summary: 'Discover collections, fields, limits and write availability.',
    options: [],
  },
  'profiles list': {
    summary: 'List selectable profiles in this connection within the current grant.',
    options: [],
  },
  'profiles create': {
    summary:
      'Create a narrower profile from JSON with a UUID chosen once; never switches automatically.',
    options: ['file'],
  },
  'profiles restrict': {
    summary:
      'Rename or narrow the current profile from JSON with its expectedRevision. Cannot broaden access.',
    options: ['file'],
  },
  'profiles select': {
    summary:
      'Rotate this context into a selectable profile. Cannot return to broader access; use separate contexts for independent terminals.',
    options: ['profile'],
  },
  'memories list': {
    summary: 'List independent account memories; follow nextAfter even for an empty page.',
    options: ['after'],
  },
  'metrics list': {
    summary:
      'Read one bounded page of custom metric definitions (default), observations, corrections or linked goals. Select --collection; requires metrics:read.',
    options: ['scope', 'collection', 'id', 'metric-id', 'after', 'epoch', 'checkpoint', 'archive'],
  },
  'media compare': {
    summary: 'Compare a local file with an existing resource before uploading a replacement.',
    options: ['scope', 'id', 'file'],
  },
  'media prepare': {
    summary: 'Prepare a local private attachment; retain its operation ID.',
    options: ['scope', 'file', 'content-type', 'epoch'],
  },
  'media upload': {
    summary: 'Upload or safely retry the prepared operation.',
    options: ['operation'],
  },
  'media action': {
    summary: 'Inspect, publish, cancel or remove a private attachment.',
    options: ['scope', 'owner', 'id', 'action'],
  },
  'media download': {
    summary: 'Download an authorized attachment to a new local file.',
    options: ['scope', 'owner', 'id', 'file'],
  },
  'docs sync': {
    summary: 'Refresh selected Memory/Graph sources in a managed local documentation directory.',
    options: ['directory', 'file', 'max-files', 'max-bytes'],
  },
  'docs status': {
    summary: 'Inspect the local snapshot date and selections without a network request.',
    options: ['directory'],
  },
  'docs unlock': {
    summary: 'Remove a sync lock only when its process on this host has stopped.',
    options: ['directory'],
  },
  'memory tree': {
    summary: 'Read one folder and descendant versions; unchanged validators avoid page bodies.',
    options: ['scope', 'parent', 'after', 'epoch', 'checkpoint', 'if-none-match'],
  },
  ...Object.fromEntries(
    [...ticketStorageTools].map(([command, { tool }]) => [
      command,
      { summary: tool.description, options: ['file'] },
    ]),
  ),
  'attachment prepare-upload': {
    summary: 'Prepare a local original and bind it to one ticket and attachment.',
    options: ['file'],
  },
  'attachment upload': {
    summary: 'Resume the prepared private upload and return its published asset ID.',
    options: ['operation'],
  },
  'archive query': {
    summary: 'Search one project archive with bounded filters from a JSON file.',
    options: ['file'],
  },
  'archive detail': {
    summary: 'Read one archived task with historical access.',
    options: ['scope', 'id'],
  },
  'archive comments': {
    summary: 'Read one page of comments for the selected archived task.',
    options: ['scope', 'id', 'after'],
  },
  'memory review': {
    summary: 'Evaluate verified evidence against the live documentation policy. Reads only.',
    options: ['file'],
  },
  'memory template': {
    summary: 'List optional pages in a family or preview one selected page.',
    options: ['family', 'page', 'language'],
  },
  'memory drafts': { summary: 'List your private working copies.', options: ['scope', 'after'] },
  'memory draft': { summary: 'Read your working copy of one page.', options: ['scope', 'page'] },
  'memory edit-draft': { summary: 'Save, publish or discard one working copy.', options: ['file'] },
  'memory history': {
    summary: 'Read a page of retained revision metadata for an authorized note.',
    options: ['scope', 'page', 'before-revision'],
  },
  'memory diff': {
    summary: 'Compare changed fields and block excerpts between retained revisions.',
    options: ['scope', 'page', 'from', 'to'],
  },
  'memory restore': {
    summary: 'Restore a confirmed note revision using an immutable JSON request.',
    options: ['file'],
  },
  'memory read-pages': {
    summary:
      'Read one bounded batch of selected page outlines or blocks. The JSON file contains scope, pages and optional snapshot.',
    options: ['file'],
  },
  'memory markdown': {
    summary: 'Fetch one portable Markdown document with stable media IDs and source metadata.',
    options: ['scope', 'page', 'revision', 'epoch', 'checkpoint'],
  },
  'memory search': {
    summary: 'Search document blocks or Graph nodes without loading the corpus.',
    options: ['scope', 'query', 'collection', 'after', 'epoch', 'checkpoint'],
  },
  'graph explore': {
    summary: 'Read a bounded Graph neighborhood around one node.',
    options: ['scope', 'center', 'depth', 'epoch', 'checkpoint'],
  },
  'memory resolve': {
    summary:
      'Resolve a Memory page or block with current permissions; unavailable links preserve nodes.',
    options: ['scope', 'page', 'block'],
  },
  'projects documentation': {
    summary: 'Read the current editorial policy and its authorized target.',
    options: ['scope'],
  },
  'projects list': {
    summary: 'Read a bounded project page; follow nextAfter even for an empty page.',
    options: ['after'],
  },
  'intents read': {
    summary: 'Read personal temporary instructions for one project.',
    options: ['scope'],
  },
  'intents preview': {
    summary: 'Preview a temporary focus/defer selection from JSON without changing tasks.',
    options: ['file'],
  },
  'protocols preview': {
    summary: 'Preview one page of a published task protocol from JSON without creating tasks.',
    options: ['file'],
  },
  'runs event': {
    summary:
      'Journal one real host event and send it once; --prepare only saves it. No process monitoring.',
    options: ['file', 'prepare'],
  },
  'resources list': {
    summary: 'Read a project or memory collection; carry epoch/checkpoint when continuing.',
    options: [
      'scope',
      'collection',
      'after',
      'epoch',
      'checkpoint',
      'archive',
      'id',
      'path',
      'metric-id',
      'task-state',
      'task-id',
    ],
  },
  'changes list': {
    summary:
      'Read one bounded change page from a completed resource inventory or previous nextCursor.',
    options: ['scope', 'collection', 'cursor', 'task-state'],
  },
  'changes watch': {
    summary:
      'Wait at most 60 seconds for one change page, rechecking rights on every poll. No infinite stream.',
    options: ['scope', 'collection', 'cursor', 'wait-seconds', 'task-state'],
  },
  'questions answers': {
    summary:
      'Read human question answers in bounded pages. Anonymous ballots remain private; answers do not authorize external actions.',
    options: ['scope', 'question', 'after', 'epoch', 'checkpoint'],
  },
  'commands describe': {
    summary: 'Show contract-derived command fields and JSON schemas; no network.',
    options: ['kind'],
  },
  'commands prepare': {
    summary: 'Save an immutable operation from a JSON draft without sending it.',
    options: ['file'],
  },
  'commands execute': {
    summary: 'Journal and send a complete JSON operation once. Never retries automatically.',
    options: ['file'],
  },
  'commands retry': {
    summary: 'Replay the exact locally saved operation with its original identity.',
    options: ['operation'],
  },
  'commands inspect': {
    summary: 'Read a private local operation and receipt; does not contact the server.',
    options: ['operation'],
  },
  doctor: {
    summary: 'Inspect local environment without exposing credentials or contacting the API.',
    options: [],
  },
  mcp: {
    summary:
      'Serve delegated read and journaled command tools over stdio. Authenticate with the CLI first.',
    options: [],
  },
  help: { summary: 'Describe commands and stable output conventions.', options: [] },
};
const globalOptions = ['json', 'context', 'environment', 'origin', 'allow-local', 'help'];
const flags = new Set(['json', 'allow-local', 'help', 'interactive', 'no-browser', 'prepare']);
export function parse(argv) {
  const options = {},
    words = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (arg.startsWith('-')) {
        fail('invalid_arguments', 'Use long options from help.');
      }
      words.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (!key || key.includes('=') || Object.hasOwn(options, key)) {
      fail('invalid_arguments', 'Options must be unique and use --name value syntax.');
    }
    if (flags.has(key)) {
      options[key] = true;
    } else {
      const value = argv[++i];
      if (!value || value.startsWith('--') || value.length > 4096) {
        fail('invalid_arguments', 'An option value is missing or too long.');
      }
      options[key] = value;
    }
  }
  const command = words.join(' ') || 'help';
  const definition = commands[command];
  if (
    !definition ||
    Object.keys(options).some(
      (key) => !globalOptions.includes(key) && !definition.options.includes(key),
    )
  ) {
    fail('invalid_arguments', 'Unknown command or option. Run help.');
  }
  return { command, options };
}
export function help(command = 'help') {
  return {
    formatVersion: 1,
    command,
    commands: command === 'help' ? commands : { [command]: commands[command] },
    globalOptions: {
      context: 'default; use separate names for separate accounts or agent sessions',
      environment: 'development (beta default) | production',
      origin: 'explicit loopback origin with --allow-local, for local tests only',
      json: 'one versioned JSON result on stdout; progress/errors use stderr',
    },
    loginOptions: {
      flow: 'browser (default, PKCE loopback) | device (SSH/headless)',
      browser: 'default (automatic) | chrome; --no-browser prints the link without opening it',
      scope:
        'space-separated permission ceiling; omitted by default so the server proposes its available permissions for human approval',
      interactive:
        'required when starting login without a terminal; never use to bypass human consent',
    },
    exitCodes: {
      0: 'success',
      1: 'failure',
      2: 'usage',
      3: 'authentication',
      4: 'permission',
      5: 'conflict',
      6: 'rate limit',
      7: 'transient failure',
    },
    examples: [
      'geniustasker auth login --environment development --context work --browser chrome',
      'geniustasker projects list --environment development --context work --json',
      'geniustasker resources list --scope project:ID --collection tasks --json',
    ],
    privacy:
      'Do not put tokens in arguments, environment variables, tickets, logs or MCP configuration. This beta uses the development environment by default; access still requires an admitted account.',
  };
}
async function openConsent(url, browser) {
  await open(url, { wait: false, ...(browser === 'chrome' ? { app: { name: apps.chrome } } : {}) });
}
export async function main(
  argv,
  {
    stdout = process.stdout,
    stderr = process.stderr,
    isTTY = process.stdin.isTTY,
    directory,
    fetchImpl,
    signal,
    openBrowserImpl = openConsent,
    updateFetchImpl,
    updateCacheDirectory,
    updateEnvironment,
    updateNpmImpl,
    updateInstalledDirectory,
    runtimeDirectory,
  } = {},
) {
  let releaseRuntime;
  try {
    const { command, options } = parse(argv);
    const emit = (data) =>
      stdout.write(
        JSON.stringify({ formatVersion: 1, ok: true, data }, null, options.json ? 0 : 2) + '\n',
      );
    if (command === 'help' || options.help) {
      emit(help(command));
      return 0;
    }
    if (command === 'update check' || command === 'update install') {
      emit(
        await (command === 'update check' ? checkUpdate : installUpdate)({
          channel: options.channel,
          fetchImpl: updateFetchImpl,
          signal,
          npmImpl: updateNpmImpl,
          installedDirectory: updateInstalledDirectory,
          runtimeDirectory,
        }),
      );
      return 0;
    }
    releaseRuntime = await acquireRuntime(runtimeDirectory);
    if (options.environment && !Object.hasOwn(ORIGINS, options.environment)) {
      fail('invalid_arguments', 'Environment must be production or development.');
    }
    if (options.origin && options.environment) {
      fail('invalid_arguments', 'Choose --environment or --origin, not both.');
    }
    const origin = originOf(
      options.origin ?? ORIGINS[options.environment ?? 'development'],
      options['allow-local'],
    );
    const store = new CredentialStore({ context: options.context, directory });
    const client = new AgentClient(new Transport(origin, { fetchImpl, signal }), store);
    let data;
    if (command === 'feedback capabilities') {
      data = await readFeedbackCapabilities(client);
    } else if (command === 'feedback prepare') {
      data = await new CommandJournal(client).prepareFeedback(await readCommandFile(options.file));
    } else if (command === 'feedback submit') {
      data = await new CommandJournal(client).submitFeedback(await readCommandFile(options.file));
    } else if (command === 'feedback list') {
      data = await readFeedbackPage(client, {
        status: options.status,
        type: options.type,
        after: options.after,
      });
    } else if (command === 'feedback show') {
      data = await readFeedbackDetail(client, { id: options.id });
    } else if (command === 'feedback receipt') {
      data = await readFeedbackReceipt(client, { id: options.id });
    } else if (command === 'feedback media-prepare') {
      data = await prepareFeedbackImage({
        draftId: options['draft-id'],
        expectedEpoch: options.epoch,
        file: options.file,
      });
    } else if (command === 'feedback media-open') {
      data = await new CommandJournal(client).openFeedbackMedia(
        await readCommandFile(options.file),
      );
    } else if (command === 'feedback media-upload') {
      data = await uploadFeedbackImage(client, {
        operationId: options.operation,
        file: options.file,
      });
    } else if (command === 'feedback mark-read') {
      data = await markFeedbackRead(client, await readCommandFile(options.file));
    } else if (command === 'feedback media-remove') {
      data = await removeFeedbackImage(client, { id: options.id });
    } else if (command === 'feedback media-download') {
      data = await downloadFeedbackImage(client, { id: options.id, file: options.file });
    } else if (command === 'auth login') {
      if (!isTTY && !options.interactive) {
        fail('invalid_arguments', 'Login needs an interactive human.', {
          remediation:
            'Run auth login in a terminal. Automated clients must use an existing connection.',
        });
      }
      if (
        (options.flow && !['device', 'browser'].includes(options.flow)) ||
        (options.browser && !['chrome', 'default'].includes(options.browser)) ||
        (options.browser && options['no-browser'])
      ) {
        fail(
          'invalid_arguments',
          'Use --flow browser|device, with --browser default|chrome or --no-browser.',
        );
      }
      const notify = (event) => {
        if (options.json) {
          stderr.write(JSON.stringify({ formatVersion: 1, ...event }) + '\n');
        } else if (event.event === 'consent_required') {
          stderr.write(
            `\nGeniusTasker · Connect your agent\n\n${options['no-browser'] ? 'Open this link' : 'Opening your browser. If it does not open, use this link'}:\n\n${event.url}\n${event.userCode ? `\nDevice code: ${event.userCode}\n` : ''}\nSign in, choose access, and approve. This terminal will finish automatically.\nWaiting for your decision…\n`,
          );
        } else if (event.event === 'browser_unavailable') {
          stderr.write('Could not open the browser. Use the link above; login is still waiting.\n');
        }
      };
      data = await (options.flow === 'device' ? deviceLogin : browserLogin)(client, {
        // The selected deployment owns the default consent proposal. A newer
        // CLI catalogue can contain permissions that production does not yet serve.
        scope: options.scope,
        openBrowser: options['no-browser']
          ? undefined
          : async (url) => {
              try {
                await openBrowserImpl(url, options.browser);
              } catch {
                notify({
                  event: 'browser_unavailable',
                  message: 'Open the printed consent URL in your browser. Login is still waiting.',
                });
              }
            },
        notify,
      });
      if (!options.json) {
        stdout.write(
          `\nConnected to GeniusTasker.\nYour chosen access is ready for the CLI and MCP.\nRun geniustasker auth status${options.context ? ' --context ' + options.context : ''} to check the connection.\n`,
        );
        return 0;
      }
    } else if (command === 'auth logout') {
      data = await client.logout();
    } else if (command === 'profiles list') {
      data = await new AgentProfiles(client).list();
    } else if (command === 'profiles create') {
      data = await new AgentProfiles(client).create(await readCommandFile(options.file));
    } else if (command === 'profiles restrict') {
      data = await new AgentProfiles(client).restrict(await readCommandFile(options.file));
    } else if (command === 'profiles select') {
      data = await new AgentProfiles(client).select({ profileId: options.profile });
    } else if (command === 'intents read') {
      data = await readIntents(client, { scope: options.scope });
    } else if (command === 'intents preview') {
      data = await previewIntent(client, await readCommandFile(options.file));
    } else if (command === 'protocols preview') {
      data = await previewProtocol(client, await readCommandFile(options.file));
    } else if (command === 'runs event') {
      data = await reportRunEvent(client, await readCommandFile(options.file), {
        prepareOnly: options.prepare === true,
      });
    } else if (command === 'workflow show') {
      data = workflow({ topic: options.topic });
    } else if (command === 'commands describe') {
      data = options.kind ? commandHelp({ kind: options.kind }) : describeCommands();
    } else if (command === 'commands prepare') {
      data = await new CommandJournal(client).prepare(await readCommandFile(options.file));
    } else if (command === 'commands execute') {
      data = await new CommandJournal(client).execute(await readCommandFile(options.file));
    } else if (command === 'commands retry') {
      data = await new CommandJournal(client).retry(options.operation);
    } else if (command === 'commands inspect') {
      data = await new CommandJournal(client).inspect(options.operation);
    } else if (command === 'doctor') {
      data = await client.doctor();
    } else if (command === 'whoami' || command === 'auth status') {
      data = await client.get('me');
    } else if (command === 'capabilities') {
      data = withFeedbackDiscovery(await client.get('capabilities'));
    } else if (command === 'projects list' || command === 'memories list') {
      data = await client.get(command === 'projects list' ? 'projects' : 'memories', {
        after: options.after,
      });
    } else if (command === 'changes list' || command === 'changes watch') {
      const input = {
        scope: options.scope,
        collection: options.collection,
        cursor: options.cursor,
        taskState: options['task-state'],
      };
      data =
        command === 'changes list'
          ? await readChanges(client, input)
          : await watchChanges(client, {
              ...input,
              ...(options['wait-seconds'] === undefined
                ? {}
                : { waitSeconds: Number(options['wait-seconds']) }),
            });
    } else if (command === 'docs sync') {
      let configuration;
      if (options.file) {
        const raw = await readFile(options.file, 'utf8');
        if (Buffer.byteLength(raw) > 32768) {
          fail('invalid_arguments', 'The source configuration is too large.');
        }
        try {
          configuration = JSON.parse(raw);
        } catch {
          fail('invalid_arguments', 'The source configuration must be JSON.');
        }
      }
      data = await syncDocumentation(client, {
        directory: options.directory,
        configuration,
        maxFiles: options['max-files'] === undefined ? undefined : Number(options['max-files']),
        maxBytes: options['max-bytes'] === undefined ? undefined : Number(options['max-bytes']),
      });
    } else if (command === 'docs status' || command === 'docs unlock') {
      data = await (command === 'docs status' ? documentationStatus : unlockDocumentation)({
        directory: options.directory,
      });
    } else if (command === 'memory tree') {
      data = await readMemoryTree(client, {
        scope: options.scope,
        parentId: options.parent,
        after: options.after,
        epoch: options.epoch,
        checkpoint: options.checkpoint,
        ifNoneMatch: options['if-none-match'],
      });
    } else if (command === 'attachment prepare-upload') {
      data = await prepareTicketUpload(client, await readCommandFile(options.file));
    } else if (command === 'attachment upload') {
      data = await uploadTicketAttachment(client, options.operation);
    } else if (ticketStorageTools.has(command)) {
      data = await ticketStorageRequest(client, command, await readCommandFile(options.file));
    } else if (command.startsWith('archive ')) {
      const operation = command.split(' ')[1];
      const input =
        operation === 'query'
          ? await readCommandFile(options.file)
          : {
              scope: options.scope,
              id: options.id,
              ...(options.after ? { after: options.after } : {}),
            };
      data = await readArchive(client, operation, input);
    } else if (command === 'projects documentation') {
      data = await readProjectDocumentation(client, { scope: options.scope });
    } else if (command === 'memory review') {
      data = await reviewProjectMemory(client, await readCommandFile(options.file));
    } else if (command === 'memory template') {
      data = previewMemoryTemplate({
        family: options.family,
        language: options.language,
        ...(options.page ? { page: options.page } : {}),
      });
    } else if (command === 'memory draft') {
      data = await pageDraftRequest(client, 'draft', {
        scope: options.scope,
        pageId: options.page,
      });
    } else if (command === 'memory drafts') {
      data = await pageDraftRequest(client, 'drafts', {
        scope: options.scope,
        ...(options.after ? { after: options.after } : {}),
      });
    } else if (command === 'memory edit-draft') {
      data = await pageDraftRequest(client, 'edit_draft', await readCommandFile(options.file));
    } else if (command === 'memory history') {
      data = await memoryHistoryRequest(client, 'history', {
        scope: options.scope,
        pageId: options.page,
        ...(options['before-revision'] ? { beforeRevision: options['before-revision'] } : {}),
      });
    } else if (command === 'memory diff') {
      data = await memoryHistoryRequest(client, 'diff', {
        scope: options.scope,
        pageId: options.page,
        fromRevision: options.from,
        ...(options.to ? { toRevision: options.to } : {}),
      });
    } else if (command === 'memory restore') {
      data = await memoryHistoryRequest(client, 'restore', await readCommandFile(options.file));
    } else if (command === 'memory read-pages') {
      data = await readMemoryPages(client, await readCommandFile(options.file));
    } else if (command === 'memory markdown') {
      data = await readMemoryMarkdown(client, {
        scope: options.scope,
        pageId: options.page,
        revision: options.revision,
        epoch: options.epoch,
        checkpoint: options.checkpoint,
      });
    } else if (command === 'media compare') {
      data = await compareMedia(client, {
        scope: options.scope,
        id: options.id,
        file: options.file,
      });
    } else if (command === 'media prepare') {
      data = await new MediaJournal(client).prepare({
        scope: options.scope,
        file: options.file,
        contentType: options['content-type'],
        epoch: options.epoch,
      });
    } else if (command === 'media upload') {
      data = await new MediaJournal(client).upload(options.operation);
    } else if (command === 'media action') {
      data = await mediaAction(client, {
        scope: options.scope,
        ownerId: options.owner,
        id: options.id,
        action: options.action,
      });
    } else if (command === 'media download') {
      data = await downloadMedia(client, {
        scope: options.scope,
        ownerId: options.owner,
        id: options.id,
        file: options.file,
      });
    } else if (['memory search', 'graph explore', 'memory resolve'].includes(command)) {
      const input = Object.fromEntries(
        commands[command].options
          .filter((key) => options[key] !== undefined)
          .map((key) => [key, options[key]]),
      );
      if (command === 'memory search') {
        data = await searchMemory(client, input);
      } else if (command === 'graph explore') {
        data = await exploreGraph(client, {
          ...input,
          ...(input.depth === undefined ? {} : { depth: Number(input.depth) }),
        });
      } else {
        data = await resolveMemory(client, {
          scope: input.scope,
          pageId: input.page,
          ...(input.block === undefined ? {} : { blockId: input.block }),
        });
      }
    } else if (command === 'metrics list') {
      const input = Object.fromEntries(
        commands[command].options
          .filter((key) => options[key] !== undefined)
          .map((key) => [key === 'metric-id' ? 'metricId' : key, options[key]]),
      );
      data = await readMetrics(client, {
        ...input,
        collection:
          options.collection ??
          (options.scope?.startsWith('personal:') ? 'personalMetrics' : 'metrics'),
      });
    } else if (command === 'resources list' || command === 'questions answers') {
      if (
        !(command === 'questions answers'
          ? options.scope?.startsWith('project:')
          : // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted input.
            /^(project|memory|personal):[^\u0000-\u001f]+$/.test(options.scope ?? '')) ||
        !(command === 'resources list' ? options.collection : options.question) ||
        (options.after && (!options.epoch || !options.checkpoint))
      ) {
        fail(
          'invalid_arguments',
          'Use --scope project:ID or memory:ID and --collection for resources or --question for answers; personal:<connected-owner> is limited to metric definitions, observations and corrections. Continuation needs --epoch and --checkpoint.',
        );
      }
      const input = Object.fromEntries(
        commands[command].options
          .filter((key) => options[key] !== undefined)
          .map((key) => [
            key === 'metric-id'
              ? 'metricId'
              : key === 'task-state'
                ? 'taskState'
                : key === 'task-id'
                  ? 'taskId'
                  : key,
            options[key],
          ]),
      );
      data =
        command === 'resources list'
          ? await readResources(client, input)
          : await client.get('answers', input);
    } else if (command === 'mcp') {
      const { runMcp } = await import('./mcp.mjs');
      const server = await runMcp(client);
      const close = () => {
        void server.close();
      };
      signal?.addEventListener('abort', close, { once: true });
      if (signal?.aborted) {
        close();
      }
      // The stdio server outlives main(). Keep its lease until process exit;
      // replacing files while a host could call a tool is unsafe.
      releaseRuntime = undefined;
      return 0; // stdout belongs exclusively to JSON-RPC.
    }
    emit(data);
    await maybeNotifyUpdate({
      command,
      options,
      isTTY,
      stdout,
      stderr,
      signal,
      fetchImpl: updateFetchImpl,
      cacheDirectory: updateCacheDirectory,
      env: updateEnvironment,
    });
    return 0;
  } catch (error) {
    const safe = safeError(error);
    stderr.write(JSON.stringify({ formatVersion: 1, ok: false, error: safe.toJSON() }) + '\n');
    return exitCode(safe);
  } finally {
    // Cleanup cannot turn a confirmed remote receipt into a reported failure.
    await releaseRuntime?.().catch(() => {});
  }
}
