# Task locks and current availability

These commands and reads are in unreleased source. They are not evidence of an
npm publication, enabled production deployment or app release. Discover the
connected service's capabilities and command help before using them. Keep the
same account, scope and current permission grants.

## Progress is separate from availability

Canonical task progress stays `New`, `InProgress` or `Done`. Follow
[progress and effort guidance](PLANNING.md#progress-and-effort); never send
`status: "Locked"` in `task.update` or `run.patch`.

An unfinished task is effectively Locked while it has a manual reason, an
unfinished live prerequisite, or both. Unlocking manually removes only the
manual reason. It does not delete dependencies, finish a prerequisite or grant
permission to start blocked work. When the last cause disappears, the retained
New/InProgress progress becomes visible. A lock is not progress, a completion,
an agent run's Waiting state or a private focus/defer instruction.
Revealing retained InProgress after unlock does not prove execution resumed;
check the actual worker's current activity. A known interruption needs its
reason and resumption point, not an invented blocker or automatic restart.

Already Done work remains Done when a prerequisite is reopened. Locking a Done
task requires an explicitly intended reopen first. Archived unfinished
prerequisites still block; absence from a page or cache does not establish
deletion. Do not remove prerequisites or force Done to obtain an available task.

## Read the current source

First read capabilities. Only when the `collections` entry with `id: "tasks"`
advertises `taskState: "v1"`, explicitly select `taskState: "v1"` in MCP task
resource/change/watch reads, or `--task-state v1` with CLI `resources list`,
`changes list` and `changes watch`. This signal works with read-only task grants;
permission to lock is not needed for availability reads. Keep the choice on
continuations and bounded watches. The client never adds it automatically.
Omit it on older deployments. Without the option the server returns the legacy
shape with no availability snapshot, preserving published beta.13 compatibility.

Task resource entries and task change `upsert` entries can carry a separate
`taskAvailability` snapshot. It contains `progress`, effective `status`,
`manualReason`, `dependencyCount`, up to 20 `blockingIds`, `blockersTruncated`,
`incomplete` and `source: {epoch, authorizationEpoch, head}`. Removal entries
have no snapshot. Other collections do not expose this task projection.

`Unknown`, `incomplete: true` or an absent snapshot is not proof of availability.
The server bounds dependency resolution to 1000 distinct prerequisites per
page. For a task needing a current decision, request that exact `tasks` ID
through the normal bounded resource read; if its source remains incomplete,
explain the uncertainty. Do not scan the entire project to reconstruct a graph.
A truncated blocker list is not an exhaustive list of reasons.

Use the snapshot's source epoch, authorization epoch and **task-module head**
for freshness. A prerequisite change invalidates older availability even if
the dependent task's row revision does not change and no dependent delta is
sent. The snapshot head can be newer than a change page's historical checkpoint.
Keep those values separate; never rewrite one from the other. Discard older
availability decisions when the source changes and reread the relevant task.
Any advanced task-module head or checkpoint invalidates older availability,
including a delta containing only `remove` with no dependent snapshot. There
is no dependent fanout. Before starting or completing work, reread that exact
task with the advertised opt-in and use its current availability.
The client revalidates cached resource reads with the server; historical output
and a command receipt are not a present permission or availability grant.

## Apply only the authorized manual change

Inspect `commands describe --kind KIND --json` or `tasker_command_help` for the
exact schema, then use the ordinary immutable prepare/execute workflow:

| Command       | Envelope target and revision         | Data                                                                                           |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `task.lock`   | Task ID and current task revision    | `{"reason":"The required test device is unavailable."}`                                        |
| `task.unlock` | Task ID and current task revision    | `{}`                                                                                           |
| `run.lock`    | Live run ID and current run revision | `{"taskRevision":"CURRENT_TASK_REVISION","reason":"The required test device is unavailable."}` |
| `run.unlock`  | Live run ID and current run revision | `{"taskRevision":"CURRENT_TASK_REVISION"}`                                                     |

Reasons are required plain text, 1–500 characters and nonempty after trimming.
Use an observed, useful reason; the example is not a reason to invent a blocker.
The server owns attribution and time. Do not patch `manualLockReason`, include
an internal `action`, or use another field to simulate locking.

The owner of an active agent claim must use **run.lock/run.unlock**, with both
current revisions. Direct task commands are not a workaround for a claim,
expired lease, takeover or revision refusal. Read the run and reconcile current
authority; never switch profiles to evade it. Read both run and task after a
successful run command because their revisions can change.

Preserve operation ID, issuedAt, target, revisions, reason and full body for
uncertain retry. A definitive conflict requires fresh reads and a new operation
only for reconciled intent. A refused start/completion under current lock rules
does not justify automatic retries; explain the cause and continue independent
authorized work where useful. Read availability after unlocking before saying
the task is available. No lock receipt proves completion, XP or push delivery.
