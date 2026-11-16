# Link a goal to measured evidence

Use this workflow only for a requested goal and when live capabilities advertise
`metric.goal.create`, `metric.goal.update` and `metric.goal.delete`. A definition
or observation command never creates a goal implicitly. Read the
[definition](metrics.md) and [observation](metrics-observations.md) workflows first.
Existing recurring task goals and YouTube/Spotify goals remain separate.

## Read and explain the source

Use `metrics:read` / `metrics:write`; task and ordinary goal grants do not include
these permissions. Configuration also requires current project owner/admin
rights or the connected personal owner. Use `actor.ownerId` from identity for
`personal:<owner>`, never another account or a profile ID. The source definition
must exist in the **same scope**, be unarchived, and express the intended unit
and aggregation. `metricId` cannot change on an existing goal.

```sh
geniustasker metrics list --scope project:PROJECT --id METRIC_UUID --json
geniustasker metrics list --scope project:PROJECT --collection metricGoals --json
geniustasker metrics list --scope personal:OWNER --collection personalMetricGoals --id GOAL_UUID --json
geniustasker commands describe --kind metric.goal.create --json
geniustasker workflow show --topic metrics --json
```

In MCP use `tasker_read_metrics` and `tasker_edit_metrics`. Read one bounded page
at a time; preserve the returned epoch, checkpoint and continuation. Goal
collections accept an exact goal `id`; `metricId` filtering is reserved for
observation/correction history. Do not scan all history to recompute progress.

## Choose the target and period

`target` is a decimal **string** in the source metric's unit, with a dot and at
most its configured precision. No exponent, thousands separator, percentage
symbol or JSON number. For a Ratio with `ratioScale:100`, target `"75"` means
75 percent; for scale 1 use `"0.75"` if the precision supports it. Preserve exact
decimal arithmetic instead of converting the threshold through floating point.
`AtLeast` means greater than or equal; `AtMost` means less than or equal.

`window:null` uses the recorded lifetime. A fixed window has explicit
timezone-qualified `start` and `end`, with start **included** and end **excluded**.
Choose boundaries in the user's intended timezone, then retain those instants.
It is not a recurring or rolling period. A goal called “This week” does not
advance itself next week. Date membership uses the observation's `observedAt`,
including late arrivals, corrections and voids, not its ingestion time.

Choose `OnReach` for completion as soon as a complete eligible result satisfies
the target. Choose `AtEnd` to wait for the fixed window's end; it requires a
non-null window. An upper-bound budget often needs `AtEnd`, since being below
the limit early does not establish the final result. Later evidence can still
correct a window's result after its end.

## Persist explicit configuration

This `data` example assumes a EUR Counter/Sum source with precision 2. The UUID
is illustrative: use the actual definition ID and the agreed dates and target.
Notification and coach options are off because the example does not request
either. Titles and explanations may use the user's language; API names and enum
values stay unchanged.

```json
{
  "configuration": {
    "metricId": "00000000-0000-4000-8000-000000000001",
    "title": "Budget de novembre",
    "description": "Dépenses vérifiées en euros sur novembre, clôture au terme de la période.",
    "target": "500.00",
    "comparison": "AtMost",
    "window": {
      "start": "2026-11-01T00:00:00+01:00",
      "end": "2026-12-01T00:00:00+01:00"
    },
    "completion": "AtEnd",
    "notifyCompleted": false,
    "coachSignal": false,
    "paused": false,
    "archived": false
  }
}
```

Create with a new stable goal UUID, the scope's current epoch and
`expectedRevision:null`. For update, reread the goal and use its current revision
with the complete configuration, preserving unchanged choices. `metric.goal.delete`
takes empty `data` and a current revision; it does not delete the source metric
or its evidence. Never send the internal action, progress, scan cursor,
generation, attribution or completion fields.

Keep configuration concise: the current service limits it to 2,048 UTF-8 bytes
and admits at most 12 goals per metric, 128 per scope. These bounds apply in
addition to individual field limits. A refusal is not a reason to clone the
metric, split the same goal or rotate an agent profile.

Use the normal immutable command journal: prepare, then execute/retry the exact
operation. A lost acknowledgment is not a reason to create a second goal.
Revision conflicts require rereading before a new intentional edit. Hosted MCP
does not retain a local journal, so preserve the prepared request yourself.
Each read/write uses normal permissions and budgets; no bulk loop is implied.

## Report trustworthy progress

- `phase:"Pending"` means historical evaluation is incomplete. A bounded server
  scan may already expose partial summary data; do not present it as the final
  total, failure or success. Do not busy-poll or try to advance `scanAfter` yourself.
- `phase:"Ready"` means the summary is complete for the recorded evidence.
  Use the server's `reached` result; comparison uses exact unrounded arithmetic.
  `summary.value` is a nullable, rounded display string and can appear equal to
  a threshold that the exact result has not reached. Summary integer fields
  follow the [same scaling rules](metrics-observations.md#read-the-consolidated-result)
  as the source; a goal's summary is restricted to its configured window.
- No active evidence yields `summary.value:null`, not a measured zero, even for
  an `AtMost` target. Ready does not itself prove recent or complete external
  data: inspect `latest.observedAt` and the definition's freshness configuration.
- `completedAt` records the first verified eligible completion. It is retained
  through corrections, edits and retries. The current `reached` value can later
  become false without erasing that historical fact. Do not recreate a goal to
  repeat a reward, or confuse a completion record with confirmed push delivery.

`paused:true` retains progress tracking while suppressing automatic completion
reactions. `archived:true` stops tracking; restoration rebuilds progress before
reacting. Neither option discards evidence or clears prior completion.

`notifyCompleted` and `coachSignal` are explicit opt-ins; leave them false unless
requested, and preserve existing choices on update. They describe eligibility,
not evidence that a message was delivered or XP awarded. Recipient preferences
and the live service still apply. `coachSignal` does not issue an LLM request,
invoke an external agent, execute code or install a collector. Report saved
configuration, calculated progress and observed delivery as separate facts.
