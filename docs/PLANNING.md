# Projects and planning

Use `geniustasker workflow show --topic planning --json` or `tasker_workflow`
with `topic: planning` for the same guide in CLI, local MCP and ChatGPT.
Inspect `capabilities` and the current record before preparing a command.

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
