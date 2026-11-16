# Record, correct or void a metric observation

First read the [definition workflow](metrics.md), current identity, capabilities
and the exact definition. Use `metrics:read` to inspect it and `metrics:write`
for the requested mutation. The server also checks current native rights:
personal data belongs to the connected owner, while project observations use
the definition's writer policy. A grant never bypasses project opt-in or
membership. Do not add yourself to `writers` to work around a refusal.

## Choose the actual evidence

| Definition kind | `measurement` meaning                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `Gauge`         | `value` is the absolute level; `numerator` and `denominator` are null.              |
| `Counter`       | `value` is a signed contribution, not a running total; other fields are null.       |
| `Ratio`         | `value` is null; `numerator` is nonnegative and `denominator` is strictly positive. |

For example, a cumulative provider counter increasing from 100 to 103 is a
Gauge value of 103 **or**, for an explicitly defined increment metric with a
verified previous baseline, a Counter contribution of 3. It is never a Counter
contribution of 103. A negative Counter contribution can represent a real
reversal; correcting a wrong entry instead uses `metric.correct` so its cause
and previous value remain visible. Missing data is not a measured zero.

A Ratio's result uses the configured scale and sums of numerator and denominator.
Do not submit a percentage as `value`, or average rates with unequal denominators.
Do not calculate a global result from a partial history page. Corrections are
previous snapshots and must never be added to the observations; voided
observations must not be treated as active evidence.

Keep numbers in the definition's unit and precision. Magnitudes are bounded by
the current schema (currently 1,000,000,000); nonfinite numbers and invalid
denominators are not observations. Do not silently round or convert ambiguous
source units. Ask or clarify the definition when the source does not fit it.

## Record once

`metric.record` creates a new observation UUID with `expectedRevision:null`.
Its `data` contains `metricId`, the definition's current `measurementVersion`,
`sourceKey`, `sourceLabel`, `observedAt` and all three `measurement` fields.
The envelope ID is the **observation ID**, not the definition ID.

`sourceKey` is the stable event identity within that metric, for example a
provider record ID or a specific period's identifier. Preserve the observation
UUID and key in the producer's own mapping. Do not derive either from retry time
or translated text. Labels may be localized; identifiers must stay unchanged.
Neither field should contain credentials, signed download URLs or raw private
logs. A later independent observation gets its own event identity.

`observedAt` is the source observation time with an explicit timezone, not
arrival time. A late observation retains its real date. Do not substitute now
to evade freshness checks; the server bounds future skew. Never guess a missing
measurement, timestamp or source period.

Example `data` for a Gauge observation:

```json
{
  "metricId": "00000000-0000-4000-8000-000000000001",
  "measurementVersion": 1,
  "sourceKey": "finance:week-2026-46",
  "sourceLabel": "Weekly sales export",
  "observedAt": "2026-11-15T23:00:00Z",
  "measurement": { "value": 1250.5, "numerator": null, "denominator": null }
}
```

Example `data` for a different definition configured as Ratio:

```json
{
  "metricId": "00000000-0000-4000-8000-000000000002",
  "measurementVersion": 1,
  "sourceKey": "support:week-2026-46",
  "sourceLabel": "Reviewed support outcomes",
  "observedAt": "2026-11-15T23:00:00Z",
  "measurement": { "value": null, "numerator": 18, "denominator": 20 }
}
```

Do not send a batch hidden in one field. Each observation is one normal command,
using the shared account request and storage quotas. Preparing a local command
persists its immutable journal before sending; hosted preparation returns the
exact command to retain. On an uncertain response, retry that same operation ID,
`issuedAt` and body under the same identity. This is separate from source-event
deduplication: creating a new operation or UUID does not make an already used
`sourceKey` a new observation. On duplicate-source refusal, reconcile the saved
mapping and current record; do not alter the key to get around it.

## Correct or void with a reason

Read the current observation by ID, along with its definition. `metric.correct`
targets that observation UUID and its current revision, never the definition's
revision. Supply a complete replacement measurement and observedAt, plus a
concrete reason. It cannot change metricId, sourceKey or sourceLabel. The server
retains the previous snapshot and attributes the change to the real caller.

```json
{
  "observedAt": "2026-11-15T23:00:00Z",
  "measurement": { "value": 1200.5, "numerator": null, "denominator": null },
  "reason": "The verified export excluded a refunded sale that the initial amount included."
}
```

Use `metric.void` when the evidence must be invalidated, with the current
observation revision and a reason:

```json
{ "reason": "This source export was generated from the wrong reporting period." }
```

Void does not delete the observation or its audit trail. Do not clear source
keys, forge `voided` or write directly to correction collections. A conflict
means reread and decide again; do not overwrite a concurrent correction. If a
paused/archived definition or current writer policy refuses an operation, report
the refusal rather than changing settings implicitly.

## Bounded reads and truthful completion

```sh
geniustasker commands describe --kind metric.record --json
geniustasker commands describe --kind metric.correct --json
geniustasker metrics list --scope project:PROJECT --collection metricObservations --id OBSERVATION_UUID --json
geniustasker metrics list --scope project:PROJECT --collection metricObservations --metric-id METRIC_UUID --json
geniustasker metrics list --scope project:PROJECT --collection metricCorrections --metric-id METRIC_UUID --json
```

Use the personal-prefixed collections for the connected personal scope. Every
page uses normal read admission; carry epoch/checkpoint/after and the exact
`metricId` filter unchanged. The equality filter applies only to observations
and corrections. Filtered reads return `changeCursor:null`; do not start a
filtered change stream. Only an unfiltered completed inventory supplies a
collection change cursor. There is no implicit full export or complex search.
A correction row includes `observationId`,
`previousRevision` and replacement attribution; it describes previous evidence,
not another event to count. Report the saved observation/correction and its
receipt. Do not claim goal progress, a trigger or a running collector unless
that separate capability is available and its result has actually been verified.
