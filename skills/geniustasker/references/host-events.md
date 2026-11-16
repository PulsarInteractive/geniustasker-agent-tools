# Connect explicit host lifecycle events

Use this adapter only when the user has enabled reporting for an actual task and
your host can explicitly invoke the CLI or local MCP at known work events. It
does not install a hook into Codex, Claude or another agent host, observe an
unmodified process, launch commands, capture logs or run a background timer.

Before enabling it, discover the four `run.*` commands and read the project/task.
Ordinary account permissions, project agent contributions, quotas, leases and
run/task revisions still apply. The host must retain the current run identity and
confirmed revision; each event is one normal command, not a batch or bypass.

## Map facts to the right event

| Actual host event                                       | Event `type`     | Command and state              |
| ------------------------------------------------------- | ---------------- | ------------------------------ |
| Authorized work starts on a current open task           | `started`        | `run.claim` → Working          |
| A factual progress checkpoint is available              | `checkpoint`     | `run.checkpoint` → Working     |
| The agent explicitly needs an input or dependency       | `waiting`        | `run.checkpoint` → Waiting     |
| A concrete result awaits review                         | `review`         | `run.checkpoint` → NeedsReview |
| Only the process exit is known                          | `process_exited` | `run.checkpoint` → NeedsReview |
| The agent explicitly reports its verified work finished | `finished`       | `run.finish` → Completed       |
| The agent explicitly reports failure                    | `failed`         | `run.finish` → Failed          |
| The agent actually stopped the work after cancellation  | `cancelled`      | `run.finish` → Cancelled       |

`waiting`, `review` and `process_exited` require actionable `nextSteps`. An exit
code, silence or elapsed time cannot prove acceptance, failure or task completion.
No hook edits the task or awards XP. A `finished` run still does not mark its task
Done. A cancelled/replaced/expired lease may refuse a checkpoint; keep the real
event and report that refusal rather than starting an unauthorized replacement.

## Save the event before sending

For each actual event, the host persists one UUID `eventId` and its original
millisecond `occurredAt`. They become the command's `operationId` and `issuedAt`.
Save the complete event before invoking the adapter and reuse it unchanged on
retry. Do not create a new UUID/timestamp each time a shell hook is restarted.

The following fixtures show the file shape. Replace their IDs, timestamp and
revision with actual observations before saving your event; do not send the
example as claimed progress. `runId` is one UUID for the run, distinct from each
event's UUID. Starting uses a null run revision and the current task revision.

```json
{
  "eventId": "11111111-1111-4111-8111-111111111111",
  "occurredAt": 1794823200000,
  "type": "started",
  "scope": "project:PROJECT_ID_FROM_CURRENT_READ",
  "epoch": "EPOCH_FROM_CURRENT_READ",
  "runId": "22222222-2222-4222-8222-222222222222",
  "expectedRevision": null,
  "task": "TASK_ID_FROM_CURRENT_READ",
  "taskRevision": "7",
  "summary": "Starting the authorized recovery check.",
  "leaseSeconds": 300
}
```

```sh
geniustasker runs event --file started.json --prepare --context work --json
geniustasker runs event --file started.json --context work --json
geniustasker commands inspect --operation EVENT_UUID --context work --json
geniustasker commands retry --operation EVENT_UUID --context work --json
```

`--prepare` persists the exact command locally and sends no API request. Repeating
preparation preserves any existing uncertainty, cooldown or receipt. Sending the
same event uses the normal immutable journal; it cannot replace a different
request under that ID. A local receipt replay is explicitly labeled
`local_receipt`, not a fresh server observation.

A later event uses the same run ID but its latest revision from a confirmed
receipt/read and a distinct event ID. For example, if the host only knows its
process stopped:

```json
{
  "eventId": "33333333-3333-4333-8333-333333333333",
  "occurredAt": 1794823220000,
  "type": "process_exited",
  "scope": "project:PROJECT_ID_FROM_CURRENT_READ",
  "epoch": "EPOCH_FROM_CURRENT_READ",
  "runId": "22222222-2222-4222-8222-222222222222",
  "expectedRevision": "8",
  "summary": "The host process exited; acceptance has not been checked.",
  "nextSteps": "Inspect the produced changes and run the agreed checks."
}
```

## Host integration and recovery

For a Codex or Claude host integration you control, configure an **opt-in**
callback to invoke `geniustasker runs event --file` on the host's saved, sanitized
event. If no supported callback exists, have the agent explicitly call the local
MCP tool at meaningful checkpoints. Do not claim that installing this skill or
adding an MCP connection automatically instruments that host.

Local MCP exposes `tasker_run_event` with `{ "event": EVENT_OBJECT,
"prepareOnly": true }` to prepare, or `{ "event": EVENT_OBJECT }` to send. It
uses the same journal as `tasker_retry_command`. Hosted ChatGPT uses the existing
prepared `run.*` command and task edit tool; it has no local event adapter or
filesystem access.

Only send the allowed structured fields. `summary` is bounded to 2,000 characters,
`nextSteps` to 4,000 and evidence to eight labeled HTTPS links. Do not send raw
stdout/stderr, environment, arguments, prompts, transcripts, credentials or
signed private links. Unknown fields are refused rather than forwarded.

Serialize events for a run and keep confirmed revisions. An uncertain result
requires replay of the original operation before conflicting follow-up work.
Respect `retryAfterSeconds` and the saved cooldown; the adapter never retries or
polls automatically. On a definitive revision conflict, read the run/task and
reconcile first. A new corrected event is an explicit decision with a new ID,
not a silent revision rewrite of an old event. Do not change profiles, clear the
journal, force a takeover or relabel a conflict as successful work.
