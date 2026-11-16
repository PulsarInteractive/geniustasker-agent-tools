# GeniusTasker CLI and MCP reference

Connect your own AI tools to your projects: read progress, work on tickets,
comment, ask questions and keep a useful handoff. Your account and project
permissions remain the limit. GeniusTasker does not run your agent or bill its
external model tokens.

## Custom metric definitions

For custom measurement definitions, use `metrics list --scope project:ID --json`
or `metrics list --scope personal:OWNER --json` (`OWNER` is identity's
`actor.ownerId`). Current capabilities must advertise the feature and the
separate `metrics:read` / `metrics:write` grants. `metric.create`,
`metric.update`, `metric.delete`, `metric.record`, `metric.correct` and
`metric.void`, plus the discoverable `metric.goal.create/update/delete` commands,
use the standard `commands prepare/execute/retry` journal.
MCP exposes `tasker_read_metrics` and `tasker_edit_metrics`.
Read the [metric configuration guide](../skills/geniustasker/references/metrics.md)
or `workflow show --topic metrics --json` before choosing the measurement meaning.
For observations or previous correction snapshots, choose `--collection`
explicitly; definitions remain the default. Read the
[observation guide](../skills/geniustasker/references/metrics-observations.md)
before recording or correcting evidence. For linked goals, select `metricGoals`
or `personalMetricGoals` and read the [metric goal guide](../skills/geniustasker/references/metric-goals.md).
A goal is a separate explicit command; definitions and observations never create
one implicitly. Goal thresholds are decimal strings, fixed windows use source
observation time, and `Pending` progress is not final. None of these commands
starts an automatic collector or executes an external agent.

## Task protocols

Discover `taskTemplates`, `protocolInstances` and the `protocol.*` commands in
capabilities before using this workflow. Protocols are versioned procedures for
Details projects, with stable task keys, dependencies and acceptance criteria.

```sh
geniustasker workflow show --topic protocols --json
geniustasker protocols preview --file protocol-preview.json --context work --json
```

The file contains `scope`, `protocolVersionId` and `bindings` with `instanceId`,
matching `scope`, current `epoch`, a timezone-qualified `anchor` and primitive
`values`. Preview performs one read-only POST with `tasks:read`, returns at most
20 steps and never creates tasks. For another page, preserve these fields and
add `after: nextAfter` plus the returned `digest`. Each call consumes the normal
read budget. There is no automatic pagination or apply loop.

Use `protocol.publish/start/apply/cancel` through the existing `commands prepare`
and `commands retry` workflow only for requested changes. `protocol.apply` takes
`digest`, `from` and `count` (1–20) with the current instance revision. `Applied`
means the tasks exist, not that their work is done. Cancellation preserves tasks
already created. Follow the [protocol guide](../skills/geniustasker/references/protocols.md)
for binding, importance, permissions, recovery and hosted MCP equivalents.

## Install and connect

Requires Node.js 22.13 or newer. Install the beta:

```sh
npm install -g @pulsarinteractive/geniustasker@beta
geniustasker auth login
geniustasker whoami --json
geniustasker projects list --json
```

Login opens your browser. Sign in to GeniusTasker, choose projects, independent memories and
permissions, then approve the connection. The CLI receives a one-use code with
PKCE; it never asks for your password. The consent page does not load the app tutorial. Decline there or use Ctrl-C to stop.
If the browser cannot open, use the link printed in your terminal.

**This beta defaults to the development environment.** Production agent access
is enabled for admitted accounts; installation alone does not grant access in
either environment. Account admission, project membership, subscription and
browser consent still apply. No subscription purchase is performed by the CLI.

TestFlight uses production. To work on that same application's data, choose a
separate context and pass `--environment production` at login **and on every
subsequent CLI or local MCP invocation**:

```sh
geniustasker auth login --environment production --context tasker-beta --browser chrome
geniustasker whoami --environment production --context tasker-beta --json
geniustasker projects list --environment production --context tasker-beta --json
geniustasker mcp --environment production --context tasker-beta
```

A context name does not select an environment. Existing development sessions do
not become production sessions, and changing an environment does not migrate
records or expand consent. Keep the chosen environment/context in the host's
MCP arguments too. Inspect identity before making changes; an empty project
list is not a reason to switch accounts or environments automatically. Use the
same flags for logout when revoking that connection.

For a remote machine, use `geniustasker auth login --flow device --no-browser`.
For Chrome specifically, use `--browser chrome`. `--context work` creates a
separate local session for an independent terminal; it does not grant extra quota.
For the official CLI, the browser preselects all current and future resources
and every requested permission, including writes. Review the visible selection
and approve it, or uncheck “All” to choose individual projects and memories and
remove any permissions you do not need. Opening the page grants nothing, and
existing connections keep their approved permissions.

To narrow the permissions offered by the browser, pass `--scope`, for example:

```sh
geniustasker auth login --context work --scope 'projects:read tasks:read tasks:write comments:write goals:read goals:write'
```

The browser still requires you to confirm the selected access.
Revoke a session using `geniustasker auth logout --context work` or Account →
Agent connections in the app. Do not put tokens in commands or MCP configuration.

## Local MCP

Authenticate with `geniustasker auth login --context work` outside the MCP process first. Configure a client capable of
launching stdio servers with this entry (adjust environment/context as needed):

```json
{
  "mcpServers": {
    "geniustasker": {
      "command": "npx",
      "args": ["-y", "@pulsarinteractive/geniustasker@0.1.0-beta.13", "mcp", "--context", "work"]
    }
  }
}
```

No token belongs in that configuration. The server uses the official MCP SDK
and offers `tasker_identity`, `tasker_capabilities`, `tasker_projects` and
`tasker_memories`, `tasker_resources`, plus `tasker_prepare_command`, `tasker_execute_command`,
`tasker_retry_command` and `tasker_inspect_operation`. Profile tools are
`tasker_profiles`, `tasker_create_profile`, `tasker_restrict_profile` and
`tasker_select_profile`. `tasker_question_answers` reads human responses.
`tasker_changes` and `tasker_watch` support resumable changes and bounded waits.
Only MCP JSON-RPC is written to stdout. This is a local
stdio integration, not a hosted MCP service or a marketplace-approved plugin.
The bundled `skills/geniustasker/` folder can be copied into the skill directory
supported by your chosen agent. Specific clients may use a different config
format; their integration guides and release validation remain separate work.

## Paging and failures

Commands read one bounded page. Continue with `--after` when `nextAfter` is
non-null, even for an empty filtered project page. Resource continuation also
requires `--epoch` and `--checkpoint` from the first page. A context change
requires restarting the read. `omittedIds` means oversized legacy records were
excluded. Tasks support `--archive active|archived|all`.

`--json` gives one versioned result on stdout. Login displays readable progress
by default; with `--json`, its progress uses versioned envelopes on stderr.
Error envelopes also use stderr and do not contain credentials. Exit codes: 2 usage, 3 authentication,
4 permission, 5 conflict, 6 rate limit, 7 temporary failure, 1 other failure.
Honor `retryAfterSeconds`; there is no hidden retry loop or subscription upgrade.

### Incremental reads and bounded waits

Complete a resource inventory first. Its final page supplies `changeCursor`;
intermediate pages supply null. Keep this cursor with the same account, scope,
collection and archive view. For example, with the actual returned cursor:

```sh
geniustasker changes list --environment development --context work --scope project:ID --collection tasks --cursor CURSOR --json
geniustasker changes watch --environment development --context work --scope project:ID --collection tasks --cursor CURSOR --wait-seconds 30 --json
```

Apply all items and removal markers before retaining `nextCursor`. Follow
`hasMore` even if items is empty. These are current projections of changed IDs,
not a historical snapshot; duplicate IDs are possible and record revisions can
be newer than the page checkpoint. Apply newer/equal revisions idempotently and
never replace a newer cached row with an older one. Omissions remain incomplete
evidence. On `restart_read`, replace the collection from a fresh inventory.
Retained-history deletion also demands a full read to protect private audit IDs.

Watch returns `reason: changes|timeout`, a page (possibly null on timeout), the
number of completed polls and a continuation. It waits at most 60 seconds,
polling no faster than five seconds. Every poll uses the account's normal quota
and live permissions. Ctrl-C or MCP cancellation interrupts it; errors stop it
without blind retries. There is no daemon or automatic background agent. A
Free monthly budget refusal preserves `retryable: false` and its `resetAt` time.

## Account rate limits

Identity and capabilities expose the current server `rateLimits`. All CLI/MCP
contexts and agent profiles on the same account share them. Free allows 30
requests per 60 seconds, Starter 120, Pro 300; within those totals, write requests
are limited to 5, 20 and 60 respectively. These native Cloudflare limits are
approximate and location-local, not billing meters. A command can change several
entities; the rate unit is a request, not an entity or a physical SQL write.

Starter/Pro have no monthly agent credit/write-request cutoff. Free has 5,000
monthly credits (read request 1, write request 5) and 500 write requests, resetting
at the next UTC month. Every poll/replay consumes the applicable request limits.
On a temporary 429, honor `retryAfterSeconds` (currently a conservative 60 seconds)
before resuming. The CLI reports the error without automatically retrying writes;
keep the same journaled operation ID, issuedAt and content. Do not switch tokens,
profiles or contexts to evade the account limit. A write-only throttle leaves
reads available within their request/Free-credit budget.

## Credential storage and recovery

Credentials live in `~/.geniustasker/<context>.json`, outside repositories.
On POSIX systems the directory is 0700 and files are 0600, with file ownership,
symlink and hard-link checks. This protects against other OS users; it is not a
keychain and does not isolate processes running as you. Windows ACL and native
keychain integration have not been validated in this preview.

Refresh is serialized across processes and writes are atomic. An uncertainty
marker is saved before rotation: after a lost response, run logout then login
instead of replaying a one-use refresh token. Logout revokes the session family
on the server before removing credentials; on failure it keeps them for retry.
The account's Agents page can revoke a session or whole connection at any time.

A killed process can leave an empty `<context>.json.lock` directory. Stop every
CLI/MCP process using that context before removing only that empty lock
directory. Never remove a live client's lock. Then run logout/login if renewal
was interrupted. `doctor` exposes no credential values.

For an isolated local backend, `--origin http://127.0.0.1:PORT --allow-local`
explicitly enables loopback HTTP. Hosted credentials are origin-bound and cannot
be sent there. Redirects on credential-bearing API requests are refused.

Protocol references: [OAuth device authorization](https://www.rfc-editor.org/rfc/rfc8628),
[OAuth token revocation](https://www.rfc-editor.org/rfc/rfc7009),
[OAuth metadata](https://www.rfc-editor.org/rfc/rfc8414), and the
[official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Prepare, execute and recover writes

Request the relevant permissions when connecting, for example:

```sh
geniustasker auth login --context work --environment development --scope 'projects:read tasks:read tasks:write comments:write goals:read goals:write' --browser chrome
```

The person chooses the effective grant. A project administrator must also enable
agent contributions. Discover capabilities and read the project instructions.
`commands describe --json` describes fields and the draft/request JSON schemas
from the product contract. It does not grant access or prove server activation.

Save a draft in a private JSON file (replace IDs/epoch with current reads):

```json
{
  "scope": "project:PROJECT_ID",
  "epoch": "EPOCH_FROM_READ",
  "id": "NEW_RECORD_UUID",
  "expectedRevision": null,
  "kind": "task.create",
  "data": { "title": "Prepare the next release" }
}
```

Then use the same context/environment for the whole workflow:

```sh
geniustasker commands prepare --file draft.json --context work --environment development --json
geniustasker commands retry --operation OPERATION_ID --context work --environment development --json
geniustasker commands inspect --operation OPERATION_ID --context work --environment development --json
```

Prepare saves a stable UUID/timestamp and sends nothing. Retry executes that
saved operation, whether still prepared or uncertain. Alternatively,
`commands execute --file request.json` accepts a complete request containing
`operationId` and `issuedAt` and journals it before sending. Never regenerate
those values to recover a timeout. Execution errors retain the operation ID.

The journal lives in `~/.geniustasker/operations/<context>/` with private file
permissions. It contains project text and receipts, never credentials. It is
bound to the original connection, profile, session and API environment. A new
login cannot silently replay an old session's operation. Inspection is local
evidence, not a live permission check. A confirmed retry is labeled
`local_receipt`; a newly obtained receipt is labeled `server`.

After a revision conflict, reread the affected records and prepare a new edit.
A pending or lost result requires an identical retry. No write is automatically
retried. Journal locks serialize different processes. If a process is killed,
stop all clients before removing that operation's empty `.json.lock` directory.
Keep its JSON request and retry it; do not erase uncertain operations. Journal
retention/cleanup automation remains pending. Logout removes credentials but
retains these records so the outcome can still be inspected.

Commands cover tasks, dependencies, archive/restore, ticket creation/planning,
comments and goals. `ticket.plan` uses the project ID/root revision and per-task
numeric `expectedVersion`; `ticket.create` requires a UUID record ID. Comments
use a text string and mentions array. An agent can edit/delete only comments
authored by its profile. Server receipts expose changed IDs/revisions, not
record bodies; read them separately if your grant permits it.

Local validation includes separate processes sharing one write, immutable retry
after lost responses, strict inputs, receipt validation and an official MCP
client communicating through stdio to actual Worker/SQLite domain services.
Compatibility with each agent host requires its own connection test.

## Custom project tags

Tags belong to one project and have stable IDs. Discover `tags` through
capabilities, then read that collection before creating or assigning a label.
Names and colours are project choices; there are no mandatory release labels.

When advertised by the connected service, `tag.create`, `tag.update` and
`tag.delete` use the same prepared-command journal as task edits. Creating a tag
requires a new ID and `expectedRevision: null`. Updates/deletion require its
current revision. Editable fields are `name` (2–14 characters), `textColor` and
`backgroundColor` (integer colours). The connection needs `tasks:write` and its
account must administer the target project. Delegation never grants that role.

Assign tag **IDs**, not names, through the task's `tags` field. When adding a tag,
preserve the task's other selected IDs. Renaming a tag preserves those links.
Deleting a label does not delete its tasks: historical IDs may remain on them,
while newly assigned IDs must refer to live tags in the same project. A filter
that depends on a missing tag must not silently become an unfiltered task view.

## Agent profiles and terminal identity

The initial profile works without configuration. Use independent named contexts
for independent terminals or accounts; a context shared by two processes is one
session, so selecting its profile affects both. Profile names are for attribution,
not extra memberships, API budgets or permission grants.

```sh
geniustasker profiles list --context work --environment development --json
geniustasker profiles create --file profile.json --context work --environment development --json
geniustasker profiles select --profile PROFILE_ID --context work --environment development --json
geniustasker whoami --context work --environment development --json
```

`profile.json` contains `id` (one UUID chosen once and retained), `name`, and
`grant` with `allResources`, `resourceIds`, `permissions`, following `whoami`'s
grant shape. Use actual project scopes from the API. Creation never switches the
terminal automatically. The new grant must fit both the current profile and the
connection. After a lost creation reply, list profiles and reconcile that UUID;
retrying it cannot allocate a second profile. Do not replace its UUID blindly.

`profiles restrict --file restriction.json` changes only the current profile.
The file must include its `profileId`, current `expectedRevision`, `name`, and
narrower/equal `grant`. It cannot undo a previous restriction or edit another
profile. After a lost reply, read `whoami` to see the saved revision and grant
before preparing another edit. The explicit profile ID prevents a saved draft
from editing another profile when a process changed the shared context.

Selection lists only eligible profiles in the same connection, then checks the
source and destination revisions while atomically rotating both credentials.
It never extends the session's absolute lifetime. The previous access token stops
working, so a request in flight cannot silently become the selected profile.
A restricted profile cannot switch back to the broader Default profile. Broader
rights need a human decision in the app or a fresh human-approved connection.
Saved task-operation journals stay bound to their original profile and cannot be
adopted by a different one. Reconcile pending work before selecting another.

A definite `profile_selection_conflict` or `profile_selection_denied` preserves
the previous usable credentials; read the profile list again. An unknown rotation
outcome requires logout/login, just like an unknown refresh. Credentials never
appear in selection results, CLI output, MCP tool results or package artifacts.

## Ask a human on a ticket

Request `questions:write` explicitly when connecting; an existing comments grant
alone cannot publish a question. Questions reuse the project's vote feature and
its human access rules. Agent contributions and project votes must both be enabled.
The contract offers fourteen write commands and thirteen MCP tools in this preview.

Prepare `question.create` with a new retained question UUID, current scope epoch,
null expected revision and this `data` shape (replace IDs and deadline):

```json
{
  "task": "TICKET_ID",
  "question": "Which checks should I run before the release review?",
  "description": "I have finished the implementation and need your acceptance criteria.",
  "answerKind": "Text",
  "eligibleUsers": ["HUMAN_USER_ID"],
  "closesAt": "2026-10-05T16:00:00Z"
}
```

An explicit audience and future deadline are required for agent questions. `Text`
accepts named answers of up to 2,000 UTF-16 code units and at most 50 recipients.
`YesNo` provides the two canonical options. `Choices` requires 2–12 distinct
options, with `selection: "Single"` or `"Multiple"`; choices can be anonymous.
An agent cannot submit a human ballot. A reply does not expand API permissions
or grant authority for unrelated external actions.

Use the usual prepare/retry journal for creating and closing questions. Read
`resources list --scope project:ID --collection questions --json` to find their
current revisions, then:

```sh
geniustasker questions answers --scope project:ID --question QUESTION_ID --context work --environment development --json
```

MCP provides `tasker_question_answers`. Follow `nextAfter` with the original
`epoch` and `checkpoint`; restart after a changed snapshot. Named answers are
paged ten at a time. Anonymous questions expose no respondents or running totals;
after closing they expose only totals. A changing private ballot does not alter
an open anonymous question's public checkpoint.

`question.close` takes the question's current revision and empty `data`. A
profile can close only questions it created. It cannot answer on behalf of its
owner, impersonate another profile, or use a poll result as new authorization.

## Work updates and handoffs

Prepare `task.report` through the normal command journal with the current task
revision and `tasks:write`. `phase` is `Working`, `NeedsInformation` or
`NeedsReview`; `summary` is required, `nextSteps` is required for both waiting
phases, and `evidence` is an array of up to eight `{label, url}` HTTPS links.
`mentions` is optional. The ticket must be open, unarchived and agent-enabled.

The result is one task transition and one attributed, immutable discussion
receipt. Read `workPhase`/`lastWorkReport` on the task and `workReport` on its
comment. Completing/reopening a ticket clears its current phase. A report is
progress information, not approval or proof independently verified by Tasker.
Correct published reports with a new report; never rewrite an older receipt.

## Ask for approval of one precise action

Connect with `approvals:write` explicitly, alongside the read grants needed to
review the task and its discussion. Discover the commands through capabilities.
Prepare `approval.request` with a retained request UUID, expectedRevision null and:

```json
{
  "task": "TASK_ID",
  "taskRevision": "CURRENT_TASK_REVISION",
  "title": "Publish the reviewed preview",
  "summary": "Publish build one to the private preview environment.",
  "actionJson": "{\"build\":\"one\",\"environment\":\"preview\"}",
  "approver": "HUMAN_MEMBER_ID",
  "expiresAt": "A_FUTURE_ISO_TIMESTAMP"
}
```

The deadline is one minute to seven days ahead. The approver must be a current
human member with ticket editing rights; the requesting account needs those
rights too. Read `comments` for the request's `approval` object and revision.
The designated human reviews the request in the app. No CLI or MCP command can
approve on their behalf. A question answer, comment or work report is not an
approval. Do not store credentials in the action JSON or summary.

When Approved, prepare `approval.consume` on that comment with its current
expectedRevision and data `{ "requestVersion": "ORIGINAL_REQUEST_REVISION",
"actionJson": "THE_EXACT_REVIEWED_ACTION_JSON" }`. Only its original profile can
consume; the task and access must still match. Reuse prepare/retry/inspect for
network uncertainty. A terminal request cannot authorize a second operation.
`approval.cancel` uses current expectedRevision and `{ "requestVersion": "..." }`
when the request is no longer needed, including stale or expired requests.

Tasker records authorization and never runs the external action. Use the request
ID as an idempotency key where the external system supports it. After a crash or
an uncertain external result, inspect that system before acting again. Replaying
a successful consumption receipt does not authorize repeating its side effect.

## Package boundary

Only the CLI/MCP source, its generated public command catalog, bundled agent skill
and the selected guide/plugin files are distributed. Application source, infrastructure configuration,
private product documents, test identities and credentials are excluded. No
installation script runs and no background daemon or telemetry is installed.
The standalone client and skills are distributed under the MIT license.
Third-party components retain their original licenses.

## Independent memories

A memory is an account resource (`memory:ID`), not a project attachment. The agent
chooses which project and memory to use independently, within the user's grants.
Use a small index first, then fetch only the page you need:

```sh
geniustasker memories list --json
geniustasker resources list --scope memory:ID --collection pageIndex --json
geniustasker resources list --scope memory:ID --collection pages --path brand/identity --json
```

Memory pages contain Markdown blocks with stable IDs, a path, tags and optional
source provenance. Preserve IDs when editing; do not relabel a proposal as a
verified fact. `pages --id ID` also reads one page. A targeted read has no change
cursor; obtain one from a complete collection inventory when watching updates.
Commands `memory.create/update/delete` and `memory.page.create/update/delete`
require `memory:write`. For a new space, choose one UUID v4 for its root ID, scope
suffix and initial epoch, then use the returned epoch/revision for later writes.
All edits use the same local command journal and optimistic revision checks as
project commands. Never copy private source files into this npm package.

## Page access and visual Graph levels

A memory can define `contentRoles` (stable IDs and display names). Membership
assignments are managed in the application. Page `visibility` is `inherit`,
`restricted`, or `private`; `readRoles` selects defined roles for a restricted
page. Restrictions apply through parent folders and to attached files. Content
roles never grant editing rights. Only memory administrators can change page
restrictions or move existing pages between parents. Never change sharing as a
workaround for denied reads.

Resources, search, references and media reads enforce current page access.
After permission changes, discard cached results and restart incremental reads
when `reset_required` is returned. An offline copy cannot establish current
access. Keep Graph nodes and their own notes when a linked page is unavailable.

Nodes accept `imageAssetId` for an image uploaded to the same memory and
`detailLevel`: `auto`, `overview`, `identity`, or `detail`. The node `kind` is its content type. Overview shows products, projects and brands;
Identities shows characters, people and entities (never places or scenes). Details
shows every type and supports type/status filters. Prefer `auto`; an explicit
`overview` can highlight another type there. Display level is not authorization.
Upload only approved imagery. Attaching a private image to a shared Graph makes
it visible to that Graph's readers and requires the user's authorization.
Read the full current record before editing and preserve its revision.

For project-owned reusable task selections, see [Shared project filters](PROJECT_FILTERS.md).

## Updates

```sh
geniustasker update check --json
geniustasker update check --channel stable --json
# Close local MCP servers and let other CLI commands finish before installing.
geniustasker update install --json
```

The default channel follows the installed version: a `-beta.N` release checks
`beta`; a stable release checks `latest` and rejects prereleases on that tag.
`--channel beta|stable` selects a channel for that invocation. The updater pins the
checked version and never downgrades. Switching from beta to stable therefore
waits for a stable version newer than the installed beta. The returned
`installedVersion`, `availableVersion`, `channel` and `updateAvailable` explain
that comparison.

After a successful interactive command, automatic discovery makes at most one
anonymous registry attempt per UTC day and installed version, even across
concurrent terminals or a failed check. Its deadline is 900 ms. The notice goes
to stderr; the command result is unchanged. MCP, `--json`, redirected output,
CI, help and local-only inspection/preparation commands never check automatically.
Set `GENIUSTASKER_NO_UPDATE_CHECK=1` to disable terminal discovery. Explicit checks
remain available and have a 1.5-second deadline. No account credentials are sent
to npm, and no GeniusTasker API quota is used.

`update install` supports only the active global npm installation. It checks
`npm root --global` against the actual package path; source checkouts, npm links,
project dependencies, npx copies and other managed installations require their
own update workflow. An npx pin in an MCP configuration does not change when a
global installation is updated. The installer fixes both npm registry settings to
`https://registry.npmjs.org`, disables lifecycle scripts, enforces Node engines,
and verifies the installed package name/version. It never elevates privileges.
The npm log is not copied into CLI output.

An installation barrier prevents replacement while another command or local MCP
process from this installation is active. Ordinary commands still run in
parallel. A running MCP process must be closed, even if currently idle; restart
it after the update. Stop older clients that predate this activity guard as well.
Credentials and pending immutable command journals are neither read nor modified
by the updater. An update does not replay any saved operation.

The small disposable discovery markers live in
`~/.cache/geniustasker/cli-updates`; normal checks retain only the current and
previous UTC day, inspecting at most 64 entries per pass. Runtime activity lives
separately under `~/.cache/geniustasker/cli-runtime/<installation-hash>/active`.
Only records belonging to positively dead processes are reclaimed during an
installation. Unknown files and possibly reused PIDs conservatively block it.
Do not clear runtime activity while clients are running.

If an installer is interrupted, its empty `install.lock` directory in that same
installation-specific runtime directory remains. First confirm that every local
GeniusTasker client and npm installer has stopped, then remove only that empty
lock directory with `rmdir`. Do not delete credentials, journals, or active-process
records. After `update_install_unconfirmed`, inspect the global installed version
and package integrity before retrying; an interrupted npm operation may already
have changed files. A successful result uses `state: installed`; an already
current or newer installation uses `state: up_to_date`.

Protocol command schemas are available offline with
`geniustasker commands describe --kind protocol.publish --json` (also
`protocol.start`, `protocol.apply`, `protocol.cancel`). `tasker_command_help`
provides the same local MCP guidance. Use the required fields and nested limits;
current authorization and semantic validation remain server-side.

## Agent runs

Discover the `agentRuns` collection and `run.claim`, `run.checkpoint`, `run.patch`,
`run.finish` commands before using them. Inspect each schema with
`geniustasker commands describe --kind run.claim --json`, then use the normal
immutable command journal. [The run workflow](../skills/geniustasker/references/agent-runs.md)
explains separate run/task revisions, real checkpoints, stale leases, human
takeover and recovery. Finishing a run does not mark its task Done; no background
agent execution or monitoring is implied.

For an explicitly instrumented host, `geniustasker runs event --file event.json
--context work --json` maps one saved real event to those same run commands.
Add `--prepare` to journal it without sending. Keep its stable `eventId` and
`occurredAt`; retries use the normal command journal. Local MCP exposes
`tasker_run_event`. A `process_exited` event only requests review, with explicit
next steps. See [host event fields, examples and recovery](../skills/geniustasker/references/host-events.md)
before connecting a host callback; no host hook is installed automatically.

### Personal focus and temporary deferral

`intents read --scope project:ID` returns the connected owner's bounded
instructions. `intents preview --file selection.json` checks exact tasks, time
window and overlapping instructions without writing. Follow
[the planning guide](PLANNING.md#temporary-personal-focus-and-deferral) and
`workflow show --topic intents`, then use the ordinary immutable
`intent.change` command flow. Availability is determined by service capabilities.
