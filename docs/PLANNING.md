# Projects and planning

Use `geniustasker workflow show --topic planning --json` or `tasker_workflow`
with `topic: planning` for the same guide in CLI, local MCP and ChatGPT.
Inspect `capabilities` and the current record before preparing a command.

## Progress and effort

Use the task's actual progress: `New` means to do, `InProgress` means work has
started, and `Done` means the intended work and acceptance criteria are verified.
Creating a plan, assigning an owner or claiming an agent run does not itself
start or finish the task. Update progress when the work changes. A finished
process, published protocol or completed run is not proof that a task is done.
Never force completion to clear a dependency or make a plan appear finished.

`estimateDays` measures approximate effort in working days: `0.1` is one tenth
of a working day and `1` is one working day. It is not a deadline, elapsed
calendar time, time spent waiting, or an AI execution timer. Do not convert it
to hours without the user's working-day convention. Deadlines and protocol
`dueAfterDays` are separate scheduling choices, never automatic conversions of
estimated effort.

Use `null` when the effort is unknown. Base estimates on the actual scope and
known assumptions; do not manufacture values to fill every task. Preserve an
existing human estimate unless its revision is within the user's request.
When the scope or understanding changes, reassess the effort and explain a
proposed or authorized revision. Do not silently replace another person's
estimate with elapsed agent time or a faster model's runtime.

The unreleased source accepts finite estimates from `0.1` through `60`, including
optional protocol-step estimates. This is not a claim that installed npm
beta.13 or the connected deployment supports those additions. Inspect current
command help and capabilities before sending them. An older deployment can
reject the new field or values below `0.25`; explain the limitation and retain
the intended estimate rather than rounding it or changing transports to bypass
validation. Task create/update help may provide only field names until its
detailed input schema is available.

| Operation         | Commands                                                       | Required access                                                                            |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| New project       | `project.create`                                               | `projects:write`, all-resources consent including future projects, available account quota |
| Project settings  | `project.update`, `project.features`                           | `projects:write`, native project administration                                            |
| Delete project    | `project.delete`                                               | `projects:write`, project ownership                                                        |
| Sprint lifecycle  | `sprint.create/update/start/complete/delete`                   | `tasks:write`, native sprint management                                                    |
| Workflow stages   | `workflow.create/update/delete`                                | `tasks:write`, native project administration                                               |
| Recurring tasks   | `schedule.create/update/delete`                                | `tasks:write`, native schedule rights                                                      |
| Project documents | `document.create/update/delete`, `folder.create/update/delete` | `tasks:write`, native content rights                                                       |
| Memory folders    | `memory.page.create/update/delete` with `directory: true`      | `memory:write`, Memory content rights                                                      |

Existing credentials retain their original permissions. Reconnect and approve
`projects:write` to use project administration. A grant restricted to selected
existing projects cannot create another project. A new project created through
the connector has agent contributions enabled; an existing project's opt-out
remains controlled by a human administrator. Membership and consent changes
are not delegated commands.

## Create and configure a project

Generate a UUID v4 once. Use it as `id` and `epoch`, with scope `project:<id>`
and `expectedRevision: null`. `project.create` accepts a title, optional key,
type and icon; omitted type/icon default to `Details` and `layers`.
Keep the returned revision for subsequent edits. Other commands require the
latest target revision. Never manufacture a revision from a local timestamp.

`project.features` replaces the planning configuration. Read the project first
and map these fields; preserve values unrelated to the user's request:

| Read field           | Command field     |
| -------------------- | ----------------- |
| `backlogEnabled`     | `backlog`         |
| `sprintsEnabled`     | `sprints`         |
| `hierarchyEnabled`   | `hierarchy`       |
| `workflowsEnabled`   | `workflows`       |
| `votesEnabled`       | `votes`           |
| `gitHubEnabled`      | `gitHub`          |
| `useSprintDeadlines` | `sprintDeadlines` |
| `projectTimeZone`    | `timeZone`        |

The seven switches are required booleans. Use an IANA time zone, such as
`Europe/Brussels`. Enabling workflows creates the initial stages if none exist.
Sprints require a Details project. Active sprints prevent disabling sprints.

## Sprint and workflow rules

Sprint creation/editing uses `name`, `goal`, `start` and `end`; dates are ISO
instants with an offset and end must follow start by at most 180 days. Only one
sprint can be active. Completing a sprint preserves its history and carries
unfinished work to `carryToSprint`, or to backlog when that value is null.
Completed sprints are immutable; deletion is limited to planned sprints.

Workflow creation/editing uses `name`, `category` (`New`, `InProgress`, `Done`)
and integer `order`. Deleting an occupied stage requires `replacement`, the ID
of another stage. The final stage of each category cannot be deleted. Task
status changes caused by stage edits are part of the same server transaction.

## Recurrences and documents

Recurring tasks use `period`, `interval`, `startTime`, `weekDay`, `timeZoneId`
and optional assignee, deadline, notification and dependency fields. Inspect
command help for the exact field list. Resolve ambiguous dates/time zones with
the user. Do not write scheduler state (`disabled`, `nextCheck`, `lastCreation`).
Deleting a recurrence preserves previously generated tasks.

Project folders use `name` and `parent`; project documents use `title`, `content`
and `folder`. They are separate from Memory pages. Memory folders use the
existing page command with `directory: true`, `path` and `parentId`; documents
keep stable page and block IDs. Folder cycles are rejected by the server.

Prepare then execute one immutable operation. Retain its ID, timestamp and body
for uncertain retries. Read back affected collections after success. Open apps
receive the same realtime changes as edits made in the native UI.

## Temporary personal focus and deferral

Read workflow `intents` before using this capability. It is available only when
`intent.change` appears in the connected deployment's capabilities. It needs
`tasks:read` for reads/previews, `tasks:write` for commands and the project's
existing human-controlled agent opt-in.

```sh
geniustasker workflow show --topic intents --json
geniustasker intents read --scope project:PROJECT_ID --json
geniustasker intents preview --file preview.json --json
geniustasker commands describe --kind intent.change --json
```

A preview file contains `scope` and `selection`: kind `focus` or `defer`, its
objective, 1–20 exact open `taskIds`, `startsAt` (null means commit time), and an
explicit `endsAt`. Duration and advance scheduling are each bounded to 14 days.
Focus objectives are `finish`, `unblock`, `consistency`; defer uses `pause`.
Resolve a user's local timezone before selecting dates. No recursive selector
implicitly includes descendants.

Local MCP exposes `tasker_intents` and `tasker_intent_preview`; the hosted
connector has the same tools. A preview makes no changes. Review its full
replacement list: overlap with part of an earlier group retires that whole
instruction, not just the overlapping task. Ask for clarification when that
would exceed the requested change.

The command's outer `id` is the **connected human's ID** from identity. Its
`expectedRevision` is the preview's `intentRevision`, including null only for
an initially absent instruction aggregate. The separate `data.id` is a new
instruction UUID. Copy `expectedIntentRevision`, `selection`, `sourceVersion`
and `replaces` exactly from the preview and use `decision: set`. The server
owns attribution; never include internal action or author fields.

For `decision: cancel`, use the existing instruction's UUID, the latest
aggregate revision in both revision fields, `selection: null`,
`sourceVersion: null`, and `replaces: []`. It never revives a superseded focus.
Use the ordinary immutable command journal on CLI/local MCP or the exact
prepared command with `tasker_edit_tasks` in the hosted connector. Retry the
same operation after uncertainty. A definitive conflict requires a fresh read
and preview, not a forced overwrite.

Read back through `tasker_intents`; private command receipts deliberately have
no public changed items. These instructions do not change shared deadlines,
status, importance, XP or agent execution claims. Reassignment, deletion and
access changes make affected instructions stale. They belong only to the
connected owner; another collaborator's instructions are not exposed.
