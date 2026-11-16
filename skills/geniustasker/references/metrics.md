# Custom metric definitions

Use this workflow to define a measurement for the connected person or one
GeniusTasker project. Discover live capabilities first: `metrics:read` and
`metrics:write` are independent permissions. Existing task/goal grants do not
include them. Project configuration also requires the owner or administrator
and agent contributions enabled. A refusal is not permission to use private APIs.

Definition creation does not itself record a value. When capabilities advertise
`metric.record`, `metric.correct` and `metric.void`, use the
[observation workflow](metrics-observations.md) to record real evidence and retain
its corrections. These operations do not start a collector, link a goal or
install a trigger. Existing YouTube/Spotify metrics are separate. Feature
activation and package installation are separate: use only what the current
server advertises.

## Read the right scope

Get `actor.ownerId` from current identity, never from a profile ID, name or old
session. For a personal definition use `personal:<actor.ownerId>`; for a project
definition use its discovered `project:<id>` scope. Consent to personal metrics
is a separate resource choice; it does not expose other personal account data.

```sh
geniustasker metrics list --scope personal:OWNER --json
geniustasker metrics list --scope project:PROJECT --json
geniustasker metrics list --scope project:PROJECT --id METRIC_UUID --json
geniustasker metrics list --scope project:PROJECT --collection metricObservations --json
geniustasker metrics list --scope personal:OWNER --collection personalMetricCorrections --json
geniustasker commands describe --kind metric.create --json
geniustasker workflow show --topic metrics --json
```

Use the chosen environment/context consistently, including
`--environment production` for production data. `resources list` also supports
`metrics` in project scopes and `personalMetrics` in the connected personal
scope. In MCP prefer `tasker_read_metrics` with that same collection and scope.
Select `metricObservations` / `personalMetricObservations` for the current
observations, or `metricCorrections` / `personalMetricCorrections` for previous
snapshots. The default CLI collection remains definitions for compatibility.
Read one page at a time; carry `after`, `epoch` and `checkpoint` unchanged for
continuation. Take the epoch from the returned page, including an empty one.
Use an exact ID read before editing and preserve unmodified configuration.
For observation/correction collections, `--metric-id METRIC_UUID` (MCP
`metricId`) selects one exact definition. Preserve that filter on every page;
filtered results have `changeCursor:null` and cannot start a filtered change
stream. Date-window and compound query filters are not exposed. Do not invent
query parameters or load every page implicitly; request further bounded pages
only when needed and state when a result is partial.

## Choose a useful meaning

For an existing metric's consolidated result, first read the definition's
`summary` with `metrics` or `personalMetrics`. This avoids scanning observations
just to obtain a total. The server updates it atomically with each accepted
record, correction or void. It covers the metric's **entire recorded lifetime**,
not a week, month or rolling window, even if the title mentions a period.
For exact numeric fields, missing values and freshness, read
[the summary rules](metrics-observations.md#read-the-consolidated-result).

| Meaning                                         | Configuration      | Avoid                                            |
| ----------------------------------------------- | ------------------ | ------------------------------------------------ |
| Current level, such as audience size            | `Gauge` + `Latest` | Summing repeated cumulative totals               |
| Average of comparable samples                   | `Gauge` + `Mean`   | Averaging unlike units or unequal weighted rates |
| Additive contributions, such as completed units | `Counter` + `Sum`  | Overlapping periods and repeated contributions   |
| Numerator/denominator measure                   | `Ratio` + `Ratio`  | Unweighted averages of percentages               |

Explain the unit, data source, interval and interpretation in the description.
Ask only for an ambiguity that changes the meaning. Never invent values or
claim an approximation is an observed result. The machine key stays stable;
write title and description naturally in the user's language. Do not translate
keys, IDs, API property names or enum values.

`precision` is 0–6. `ratioScale` is 1 or 100 for a Ratio, and 1 otherwise.
`freshnessSeconds` is null or 60–31536000; it describes expected freshness and
does not schedule collection. `writers` is empty for a personal definition.
Project writers are current approved member user IDs, not agent profile IDs;
they do not grant project administration or additional API permissions.

## Prepare and persist

`metric.create` and `metric.update` take this complete `data` shape (example in
French). Inspect command help for the current limits; do not send the internal
`action` field or server-owned creator, count, version or attribution fields.

```json
{
  "configuration": {
    "key": "weekly_revenue",
    "title": "Chiffre d’affaires hebdomadaire",
    "description": "Montant total pour une semaine complète, en euros. La source et la période seront précisées lors de la collecte.",
    "kind": "Gauge",
    "aggregation": "Latest",
    "unit": "EUR",
    "precision": 2,
    "ratioScale": 1,
    "freshnessSeconds": 604800,
    "writers": [],
    "paused": false,
    "archived": false
  }
}
```

For creation choose and retain one lowercase UUID as `id`, the scope's current
`epoch`, `expectedRevision:null`, and `kind:"metric.create"`. For update read the
existing UUID/revision and send `kind:"metric.update"` with the complete updated
configuration. The key cannot change. A duplicate key is a reason to reread and
reuse the intended definition, not to create several nearly identical entries.

Local CLI: `commands prepare --file draft.json --json`, then
`commands retry --operation OPERATION_UUID --json`. Local MCP: prepare with
`tasker_prepare_command`, then retry the returned operation or execute the
immutable request with `tasker_edit_metrics`. The dedicated tool uses the same
journal and normal server admission. Hosted MCP has no local journal: retain the
exact command returned by preparation and pass it to `tasker_edit_metrics`.

After uncertainty retain the exact operation ID, time and body. Respect retry
delays. After a revision conflict, reread and decide whether a new edit is still
appropriate. Do not automatically replace the user's configuration or broaden
access. A definition receipt proves configuration persistence, not collection or
progress toward a goal.

## Preserve existing meaning

Changing kind, aggregation, unit, precision or ratio scale changes the meaning
of samples. The server refuses it when observations exist. Do not silently
convert a definition to another unit or manufacture a zero observation count.
Descriptive changes do not increment measurement semantics.

Archive through `configuration.archived:true` with a current revision when the
definition should be retained. `metric.delete` takes empty `data` and a current
revision; it is refused when observations exist. No bulk ingestion, history
deletion or custom-goal operation is implied by these definition commands.
