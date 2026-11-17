# Incremental reads

For task availability, first follow the capability opt-in in
[Task locks](../../../docs/TASK_LOCKS.md). An advanced task-module head or
checkpoint invalidates older availability decisions even when the delta is
only a `remove` and contains no snapshot for the dependent task. Dependents do
not receive synthetic deltas. Before starting or completing a task, reread its
exact ID with explicitly selected `taskState: "v2"` when the tasks collection's
`taskStateVersions` advertises v2, otherwise v1 only when `taskState` advertises
v1, and check the current snapshot. V1 omits snapshots for Paused tasks; absence
or incomplete/Unknown is not permission to proceed. Keep
snapshot source heads separate from historical change-window checkpoints.

After a complete resource read, retain its final `changeCursor`. Use
`changes list --scope … --collection … --cursor …` / `tasker_changes` to resume,
or `changes watch --wait-seconds 30` / `tasker_watch` for one bounded wait (60
seconds maximum). Every poll uses the normal account budget and rechecks access;
do not install an unrequested continuous polling loop. A timeout is not proof
of an empty project and may contain no completed page.

Apply a whole page before saving `nextCursor`; follow `hasMore` even when empty.
These are current projections, not historical events. Apply per-record revisions
monotonically and remove records marked `remove`; duplicate IDs are harmless.
On reset or expired history, rebuild the collection from resources. Never reuse
a cursor for another account, scope, collection or archive filter, or substitute
the resource checkpoint for it. Preserve explicit omissions and respect quota
reset instructions. Revocation is a stop, not a reason to switch credentials.
