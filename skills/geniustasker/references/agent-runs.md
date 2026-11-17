# Coordinate an agent run

Use a run for an actual agent working on a tracked task, especially when another
agent or person may work on it too. A run is a temporary collaboration claim and
an attributed record of real checkpoints. It neither starts an agent nor proves
that an external process is alive. Tasker does not monitor an uninstrumented
agent; silence is unknown activity.

## Read before claiming

1. Read identity, capabilities, the relevant Details project and its current task.
   Discover `agentRuns` and `run.claim`, `run.checkpoint`, `run.patch`, `run.finish`.
   They require the usual project access and task permissions; delegated writes
   require `tasks:write` and project agent contributions to be enabled.
2. Inspect a relevant existing run with a bounded `resources` read. Preserve its
   epoch/revision. An active claim is not permission to take over another agent.
   Current grant/profile restrictions apply even when the task belongs to you.
3. Read `tasker_command_help` for the chosen command, or
   `geniustasker commands describe --kind run.claim --json`. The local help is
   offline schema guidance, not evidence that the account has access.
4. Claim only work the user authorized. Keep one new UUID as the run's command
   target, the current task ID and task revision, and the current project epoch.
   A create command uses `expectedRevision: null`.

Example **data** for `run.claim` (replace task identity and revision from reads):

```json
{
  "task": "TASK_ID_FROM_CURRENT_READ",
  "taskRevision": "7",
  "summary": "Check the requested behavior and its acceptance criteria.",
  "leaseSeconds": 300
}
```

Use the normal immutable command prepare/execute workflow. A confirmed claim
returns the run's revision; read `agentRuns` to obtain its current lease and
attribution. Another actor may win the claim between your read and write. On a
claim conflict, inspect the current run and choose independent authorized work;
never change profiles, overwrite the claim or infer human approval.

## Report actual work and keep the fence

`run.checkpoint` targets the run UUID and its current revision. Use `Working`,
`Waiting` or `NeedsReview`, a factual summary and the useful next steps. Waiting
and review checkpoints need an actionable `nextSteps`. Evidence links must be
labeled HTTPS URLs without credentials or private signed links. Do not upload
full conversations, terminal output or secret-bearing diagnostics.

```json
{
  "state": "Working",
  "summary": "The regression is reproduced; the targeted correction is under test.",
  "nextSteps": "Verify the correction and the unchanged neighboring behavior.",
  "evidence": [],
  "leaseSeconds": 300
}
```

Adapt this text to observations; do not copy it as invented progress. A checkpoint
may renew a live lease. Schedule bounded updates around real work and respect
retry times, not a polling loop that invents movement. The saved lease is the
server authority; a local timer alone never authorizes another write.

Only the creating user/profile may report on the run. A new profile is a new
identity, not a way to resume an uncertain write. Original immutable operations
retain their original connection/session identity for retries.

For task changes while holding a claim, use `run.patch` with the current **run**
revision in the envelope and current **task** revision in `data.taskRevision`:

```json
{
  "taskRevision": "8",
  "patch": { "description": "Updated with the verified acceptance criteria." }
}
```

The patch accepts only fields supported by `task.update`. It preserves ordinary
permissions, human-owned importance, dependencies and task lifecycle rules.
Do not send internal fields, arbitrary mutations or a stale task snapshot.
A human edit changes the revision; reread and reconcile instead of overwriting.

For an authorized manual blocker under your claim, use `run.lock` with
`data: {taskRevision, reason}` or `run.unlock` with `data: {taskRevision}`.
The envelope targets the run and its revision; taskRevision comes from a fresh
task read. Read both records after success. Discover these unreleased commands
before use and follow [task locks](../../../docs/TASK_LOCKS.md). Never fall back
to task.lock/unlock, patch a manual lock field or set status Locked to evade the
claim. Removing a manual reason does not remove unfinished prerequisites or
establish that unknown availability is free.

## Distinguish silence, waiting and completion

- `Waiting` is an explicit agent report requiring information or another action.
- `NeedsReview` is an explicit request to inspect a real result.
- An expired `leaseUntil` means the signal is stale. It does not prove failure,
  blockage, cancellation or task completion. Do not generate a failure report
  just because a heartbeat was absent.
- `cancelRequestedAt` asks the agent to stop. Stop new task changes and safely
  finish as `Cancelled` when still authorized. Human cancellation/takeover is an
  app control, not a command agents may impersonate or bypass.
- `TakenOver` or `Superseded` means the prior run cannot continue writing. Reread
  the task and current authority; do not silently recreate a claim to defeat a
  person's decision.

After lease expiry, do not forge the clock or renew an expired command under a
fresh ID. Read the task/run again. A fresh claim is a new explicit operation for
still-authorized open work, not a replay of the old run. Preserve any uncertain
operation and establish its outcome before issuing a conflicting new command.

`run.finish` records `Completed`, `Failed` or `Cancelled`, with an honest summary,
next steps when needed and actual evidence. Finishing the run does **not** mark
the task Done. If the requested work is verified and task completion is intended,
apply that task transition through the live run first, then finish the run.
Do not award yourself progress, XP or successful delivery from an exit code alone.
Task New/to do and InProgress describe actual work, independently of the run's
claim or checkpoints. Follow [task progress and effort](../../../docs/PLANNING.md#progress-and-effort)
when updating the task. Never convert the run's elapsed time into `estimateDays`
or force Done because the process stopped or another task depends on it.

If the lease expired while you were disconnected, a final result may still close
the unchanged claim under its original user/profile. This does not renew the
lease or permit another task patch. A superseding claim or human takeover blocks
that late result. If the task was deleted, only `Failed` or `Cancelled` can close
the run, under current project permissions; never restore it to report success.

Finishing a run or human takeover changes the task's server revision without
changing its content. Reread both task and run before any later task edit;
an earlier task revision is deliberately stale, regardless of your local clock.

`Expired` is a server-ended abandoned run; it does not certify that the external
work failed. Run checkpoint history is bounded. `checkpointCount` can exceed the number of
retained checkpoints; absence of an older detail is not evidence it never
occurred. Read the confirmed task and run before reporting a final outcome.
Use `changes` or a bounded `watch` for a known cursor if needed. A successful API
response does not certify that another device has already displayed it.

## CLI and hosted recovery

```sh
geniustasker workflow show --topic runs --json
geniustasker commands describe --kind run.claim --json
geniustasker commands prepare --file claim-draft.json --context work --json
geniustasker commands execute --file prepared-command.json --context work --json
geniustasker resources list --scope project:PROJECT_ID --collection agentRuns --id RUN_ID --context work --json
```

These are individually requested calls. For a host that can explicitly report
real lifecycle events, use the [opt-in host event adapter](host-events.md). It
does not observe an uninstrumented process or run a background daemon.
Local preparation saves a private operation journal; retry
an uncertain operation unchanged with `commands retry --operation ID`.
Hosted ChatGPT preparation returns an immutable object instead; retain it for
the exact same retry using the authorized edit tool. Both use the same server
permissions, quota and concurrency rules. Never clear the journal to suppress
an uncertain result or create an untracked replacement operation.
