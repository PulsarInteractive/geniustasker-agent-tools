# Pause and resume known work

Pause commands and task-state v2 are implemented in local source. They are not
yet evidence of a published client or deployed service; installed beta.14 does
not expose these additions. Discover the connected service's commands and
collection versions before use. An unavailable transition is a limitation to
report, not permission to guess a command or reset started work to New.

## Record the actual work state

New means work has not started. InProgress requires current identifiable
execution, not partial implementation or an undelivered lot. Paused records a
known interruption of started work, with its reason and concrete resumption
point. Done requires verified intended completion. Multiple InProgress tasks
require actual parallel activity with attributable workers.

When work you control is knowingly interrupted or you switch away from it,
preserve its description, comments and verified results and use the discovered
pause operation. Never infer a pause from silence, an absent heartbeat or an
expired lease. Do not pause somebody else's task merely because its reports
are old. Until the transition is available, retain a factual authorized note
and explain the missing capability.

Paused is progress; Locked is a separate obstacle. A paused task can also be
Locked by a manual reason or unfinished prerequisites. Removing a lock does
not resume it, and pausing/resuming does not remove dependencies or manual
reasons. Read both `progress` and effective `status`, not one badge alone.
Unknown/incomplete availability never proves that resuming is allowed.

## Use the explicit command

Inspect `commands describe --kind KIND --json` or `tasker_command_help` and use
the ordinary immutable prepare/execute workflow:

| Command       | Envelope target and revision         | Data                              |
| ------------- | ------------------------------------ | --------------------------------- |
| `task.pause`  | Task ID and current task revision    | `{reason,nextSteps}`              |
| `task.resume` | Task ID and current task revision    | `{}`                              |
| `run.pause`   | Live run ID and current run revision | `{taskRevision,reason,nextSteps}` |
| `run.resume`  | Live run ID and current run revision | `{taskRevision}`                  |

`reason` is required text of 1–500 characters; `nextSteps` is required text of
1–2000 characters. Both must be nonempty after trimming. Give an observed reason
and the next concrete action needed to resume, without replacing the task's
existing description or past comments. For example: reason "Switching to the
requested incident investigation" and nextSteps "Resume the pending migration
verification from the saved test results" only when those facts are true.

Pause applies to InProgress or an already Paused task; repeating it can update
the reason and next steps while retaining the original pause time. It is not
a way to label never-started, Done or archived work. Resume applies to Paused
and requests InProgress: use it only when actual execution is resuming. Current
locks, dependencies, revisions and permissions can refuse that request. Reread
the current task and availability before resuming; a receipt is not an automatic
start signal or proof that an external worker is running.

Never enter or leave Paused through `task.update`, `run.patch`, a workflow move
or a fabricated status. `pauseReason`, `pauseNextSteps` and `pausedAt` are
server-owned read fields. A Working report is not a substitute for resumption.

Under an active agent claim, its owner must use **run.pause/run.resume**, with
both current run and task revisions. The pause records the run as Waiting and
the resume records Working; these commands retain the claim and do not extend
its lease. Read both records after success. A standalone Waiting checkpoint
does not itself pause the task. Expiry, cancellation or takeover cannot be
bypassed with direct task commands, profile switching or a guessed fresh lease.

Preserve the operation ID, issuedAt, target, revisions, reason, next steps and
full body after an uncertain reply. Retry that same operation. A definitive
conflict needs fresh reads and a newly prepared reconciled intent. Do not
convert a known refusal into automatic retries or claim XP/push delivery.

## Discover and read v2 explicitly

Read capabilities. In the `collections` entry with `id: "tasks"`, choose
`taskState: "v2"` only when `taskStateVersions` includes `"v2"`. For CLI use
`--task-state v2` on `resources list`, `changes list` or `changes watch`; for MCP
pass `taskState: "v2"`. Keep the version unchanged across continuations and
bounded watches. No hidden discovery or automatic opt-in occurs.

V2 snapshots retain the existing source and dependency fields and require
`pauseReason`, `pauseNextSteps` and `pausedAt`, each nullable. `progress` can be
Paused while effective `status` is Paused, Locked or Unknown. A null pause field
does not make an incomplete source complete or authorize resumption.

Older support is advertised by `taskState: "v1"`; choose v1 only when that
signal is present. V1 deliberately omits the entire availability snapshot for
Paused tasks, and it never contains the three new fields. Without either
advertisement omit the option. Missing snapshots remain unknown, never New or
available. Follow [source freshness and bounded reads](TASK_LOCKS.md#read-the-current-source)
before any start, resumption or completion, including after a remove-only delta.
