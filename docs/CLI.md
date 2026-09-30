# GeniusTasker CLI and MCP reference

Connect your own AI tools to your projects: read progress, work on tickets,
comment, ask questions and keep a useful handoff. Your account and project
permissions remain the limit. GeniusTasker does not run your agent or bill its
external model tokens.

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

**This beta defaults to the development environment.** Your account must be
admitted to the beta; installing the package does not grant access. Production
agent access is closed. Use `--environment production` only when that rollout is
announced. No subscription purchase is performed by the CLI.

For a remote machine, use `geniustasker auth login --flow device --no-browser`.
For Chrome specifically, use `--browser chrome`. `--context work` creates a
separate local session for an independent terminal; it does not grant extra quota.
The browser offers the supported permissions, with read-only access selected by
default. Write permissions require an explicit choice. To narrow the permissions
offered by the browser, pass `--scope`, for example:

```sh
geniustasker auth login --context work --scope 'projects:read tasks:read tasks:write comments:write goals:read goals:write'
```

The browser still requires the human to explicitly grant each permission.
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
      "args": ["-y", "@pulsarinteractive/geniustasker@0.1.0-beta.2", "mcp", "--context", "work"]
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
require `memory:write`. For a new space, choose one UUID for its root ID, scope
suffix and initial epoch, then use the returned epoch/revision for later writes.
All edits use the same local command journal and optimistic revision checks as
project commands. Never copy private source files into this npm package.
