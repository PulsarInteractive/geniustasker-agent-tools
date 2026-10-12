# Shared project filters

Keep a reusable task selection for a project’s members. Filters are separate
from personal list, table or Kanban layout preferences. Creating a filter does
not change the project’s sprint configuration or install default tags.

Discover `capabilities` before using this guide. The connected service must
advertise `filters` and `filter.create`, `filter.update`, `filter.delete`.
Client support alone does not prove those operations are deployed.

## Read before writing

```sh
geniustasker resources list --scope project:PROJECT_ID --collection filters --json
geniustasker resources list --scope project:PROJECT_ID --collection tags --json
```

Use actual IDs from authorized results. Read members, sprints and tasks when
selecting them. A name is a label, not an identity: renaming a filter preserves
its ID and the views that reference it. Prefer updating an existing filter over
creating duplicates.

| Operation                | Delegated permission | Project role                   |
| ------------------------ | -------------------- | ------------------------------ |
| Read shared definitions  | `tasks:read`         | Authorized member              |
| Create, change or delete | `tasks:write`        | Owner or project administrator |

## Criteria

A create draft uses `kind: "filter.create"`, the actual project `scope` and
`epoch`, a new stable `id`, `expectedRevision: null`, and these data fields:

```json
{
  "name": "Upcoming release",
  "criteria": {
    "formatVersion": 1,
    "query": "",
    "tags": ["ACTUAL_TAG_ID"],
    "allTags": true,
    "assignees": [],
    "statuses": ["New", "InProgress"],
    "priorities": [],
    "sprints": [],
    "epics": [],
    "placement": null,
    "blocked": null
  }
}
```

Categories combine with AND. Values within a category combine with OR; `allTags`
changes tags to AND. Empty arrays leave that category unrestricted. Use
`unassigned` in assignees for tasks without an owner. Statuses are `New`,
`InProgress`, `Done`; priorities `Low`, `Normal`, `High`, `Urgent`; placement is
`Ordinary`, `Backlog`, `Sprint`, or null. `blocked` is true, false or null.

Current bounds: 50 shared filters per project, names of 2–50 characters, query
up to 256 characters, up to 100 distinct references per category and 8 KiB of
criteria. Limits and permissions are enforced by the connected service.

Prepare and execute using the normal [immutable command workflow](CLI.md#prepare-execute-and-recover-writes).
An update requires the latest revision and may change `name`, `criteria`, or
both. Submit a complete criteria object when changing criteria. A delete uses
`filter.delete`, the latest revision and empty `data`.

## Changes and unavailable references

Use incremental reads for `filters` just like tasks. A deleted tag does not
silently remove its condition from an existing filter. New references must be
live and belong to the same project. Renaming the filter can preserve a removed
reference until a person deliberately replaces that condition.

If a selected shared filter is missing, deleted, inaccessible or uses an unknown
format, report it as unavailable. Never treat it as an unrestricted task query.
Removing a shared filter affects other members’ saved views, so review its uses
before deletion and follow the user’s authorized scope.
