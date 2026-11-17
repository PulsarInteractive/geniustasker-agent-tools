# Reuse a task protocol

Use this workflow when the user wants a reusable procedure with several tasks,
dependencies, acceptance criteria and deliberately selected importance. A
protocol creates tracked work; it does not execute the work or run an agent.
For a few unrelated tasks, ordinary task commands remain sufficient.

## Find the right version

Read identity, capabilities, the selected project and its relevant configuration.
Discover `taskTemplates`, `protocolInstances` and `protocol.*` commands before
using them. Protocols target Details projects. A legacy template containing only
a name and description is not a published protocol. Existing project agent
contributions, current membership and the appropriate grants must permit writes.

Read the selected `taskTemplates` version, its `protocolDefinition`, family,
version and digest. Preserve its step keys; they determine task identities.
Check project features, dependencies, members and the user's intended outcome.
Do not infer that an administrative role or a task assignment authorizes an
unrelated external action.

Publishing requires project administration and `tasks:write`. Use
`protocol.publish` with a new UUID, null revision and
`data: {definition, previousVersionId}`. Null starts a family; otherwise use the
latest immutable version ID. Never patch a published version in place or
silently convert an older template. Read command help for the current schema.

## Inspect the exact data schema

Use `geniustasker commands describe --kind protocol.publish --json` or local /
hosted `tasker_command_help` with `{"kind":"protocol.publish"}` before preparing
it. The four protocol commands expose nested field schemas and required fields.
Local help is offline; it does not claim the account has access. The server still
checks semantic rules such as valid members, actual dates and dependency cycles.
Never send the internal `action` field.

A minimal `protocol.publish` **data** object (the immutable command envelope also
needs the selected project, current epoch, a new version UUID and null revision):

```json
{
  "definition": {
    "formatVersion": 1,
    "name": "Verify a small delivery",
    "description": "A reusable verification task.",
    "variables": [],
    "steps": [
      {
        "key": "verify",
        "title": "Verify the requested behavior",
        "description": "Check the agreed acceptance criteria.",
        "kind": "Ticket",
        "parent": null,
        "dependencies": [],
        "importance": "Normal",
        "importanceReason": "",
        "delivery": { "push": "silent", "recap": true, "animation": "silent" },
        "acceptance": ["The requested behavior has been verified."],
        "ownerVariable": null,
        "dueAfterDays": null,
        "estimateDays": null
      }
    ]
  },
  "previousVersionId": null
}
```

Adapt the work to the request; this is a schema example, not a prescribed workflow.
An `ownerVariable` references a declared user variable; null assigns the creator.
Parent/dependency values reference other step keys, never newly guessed task IDs.
A child kind and its parent must form a supported Epic → Ticket → Subtask chain.

The optional step `estimateDays` is in the unreleased source contract; installed
npm beta.13 and older deployments may not expose it. Send it only when current
command help supports it. Use a finite working-day effort from `0.1` through `60`,
or null for unknown. When authoring a new or explicitly revised protocol,
actively check each step's effort and supply an estimate if its scope is known,
preserving human choices. If unknown, keep null, explain the missing assumption
in the plan and reassess after clarification; never manufacture a value merely
to fill the field. See [effort guidance](../../../docs/PLANNING.md#progress-and-effort).
The example does not prescribe an estimate.
For a legacy version whose steps omit this field, preserve omission in the
saved definition and preview: adding null changes the immutable content and can
change its digest. Publish an explicitly requested new version for changed
estimates; never patch an existing version or substitute a new payload on retry.

## Bind and preview

Choose one lowercase UUID for `instanceId` and retain it. Bind only declared
variables: text, number, boolean, current user/member ID or date. Missing required
values need relevant user information. Preserve `false` and `0`; neither means
missing. Values are literal data, not expressions or agent instructions.

Capture an explicit timezone-qualified `anchor` once. `dueAfterDays` means elapsed
24-hour days from that anchor, not a local calendar or recurring schedule. Reuse
the same anchor on every preview page and in the eventual start command.

`tasker_protocol_preview` and `protocols preview --file` take:

```json
{
  "scope": "project:PROJECT_ID",
  "protocolVersionId": "11111111-1111-4111-8111-111111111111",
  "bindings": {
    "instanceId": "22222222-2222-4222-8222-222222222222",
    "scope": "project:PROJECT_ID",
    "epoch": "EPOCH_FROM_CURRENT_READ",
    "anchor": "2026-11-16T09:00:00+01:00",
    "values": {}
  }
}
```

Replace all example identifiers and the date with the actual project, version,
epoch and intended timing. Populate `values` from the chosen definition.

Preview requires `tasks:read`; it creates neither an instance nor tasks. Each
call consumes the normal read budget and returns at most 20 steps. When needed,
continue with `after: nextAfter` and the original returned `digest`, keeping the
version and every binding unchanged. Stop at `nextAfter: null`. Never claim
unread pages were inspected; changed context or lost access needs reconciliation.

Review the outcome, owners, dates, effort when present, acceptance criteria,
dependency structure and importance. [Importance](importance.md) measures impact, independently of urgency
and hierarchy. Important/Critical need a concrete reason. Delivery preferences
request or suppress attention; a request cannot bypass recipient settings.

## Materialize only the requested work

If the user asked to create this work, use the normal immutable command workflow.
Otherwise show the relevant preview and await that decision. No preview grants
write access or authorizes a later changed plan.

1. Prepare `protocol.start` with `id: bindings.instanceId`, `expectedRevision:
null`, the same scope/epoch, and `data: {protocolVersionId, bindings}`.
2. Execute that exact prepared operation, then read the resulting
   `protocolInstances` record for its current revision, digest and `appliedCount`.
3. Prepare `protocol.apply` against that instance and revision with
   `data: {digest, from: appliedCount, count: 20}` or a smaller intended batch.
   One call creates at most 20 steps through ordinary authority and quota checks.
4. Read the confirmed result before preparing another batch. Continue only
   within the requested work; there is no automatic apply loop in the client.

An uncertain reply requires replaying the same operation, not incrementing the
cursor or creating a fresh ID. After a definitive conflict, reread and reconcile.
Do not bypass expired/revoked access, identity binding, an ID collision or a
human-owned importance decision by using another transport or recreating tasks.
The creating user or a current project administrator may continue or cancel an
instance. The same user may continue under another profile only within that
profile's current grants; each new command rechecks access. An uncertain operation
remains bound to its original command identity and cannot be moved to another
profile or session. Resolve its outcome before preparing a new batch.

`Applied` means the tasks were materialized. It says nothing about completed
work, earned XP or delivered notifications. `protocol.cancel` with the current
revision stops remaining materialization; it preserves already created tasks.
Do not delete them as an implicit rollback. Instance counters, state and
provenance are server-owned.

CLI example for inspection, without creation:

```sh
geniustasker workflow show --topic protocols --json
geniustasker protocols preview --file protocol-preview.json --context work --json
geniustasker commands describe --json
```

CLI/local MCP preparation saves a private journal. Hosted ChatGPT preparation
returns the immutable command object; retain it and pass it to `tasker_edit_tasks`.
Both share the same account budget, membership and project permissions.
