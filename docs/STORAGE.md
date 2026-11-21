# Files on tickets

Use the `storage` workflow for one selected project. Read capabilities and verify the project, task and intended action with the user. A new grant applies only to the resources chosen in the consent screen.

| Operation                                               | Required project permissions                    |
| ------------------------------------------------------- | ----------------------------------------------- |
| Read active tickets and their attachment metadata       | `tasks:read` and `storage:read`                 |
| Include archived tickets or inspect project-wide totals | Add `history:read`                              |
| Preview and add one file                                | `tasks:read` and `attachments:add`              |
| Preview and replace one file                            | `tasks:read` and `attachments:replace`          |
| Preview and remove one file                             | `tasks:read` and `attachments:remove`           |
| Delete one expressly selected task                      | `tasks:delete` with the task’s current revision |

Operations on an archived ticket also need historical access. A Memory asset grant does not authorize ticket files. A missing permission requires a new user-approved delegation.

## Find the right item

Use `tasker_storage_tickets` and `tasker_storage_files` with a project scope, state and size threshold. Follow the continuation with unchanged filters. On partial coverage, `tasker_storage_analyze` processes one bounded slice. Keep its cursor and report the coverage. Use `tasker_storage_selection` with exactly one ticket ID or attachment ID. If a ticket spans multiple slices, keep the same selection and cursor, add only the returned slice totals, then report the final estimate. Shared and protected bytes can remain charged. The owner can review account-wide storage in the application. Use the scoped cleanup workflow below to preview a batch within one authorized space.

## Transfer an original

1. Call `tasker_attachment_preview` with the project scope, task ID, attachment ID and action. For an addition choose a fresh attachment UUID. For a replacement keep the original attachment ID and revision.
2. In the local CLI, run `geniustasker attachment prepare-upload --file destination.json`. The JSON includes `scope`, `taskId`, `attachmentId`, the preview's `epoch`, selected local `file` and `contentType`. A replacement also includes `replaceRevision`. Resume with `geniustasker attachment upload --operation UUID`. Stdio MCP exposes the same local-file operations. Use a regular file the user selected.
3. In ChatGPT choose the attached conversation file. Discover `tasker_attachment_prepare_host_file` and `tasker_attachment_upload_host_file` with file support enabled. Keep the prepared metadata and original file selection on every continuation. The remote server transfers at most two missing parts per call. Use the local CLI for a large file whose temporary host cannot serve byte ranges, or select the file again if the URL expired.
4. Once the original is published, explicitly run `tasker_attachment_add` or `tasker_attachment_replace` with the preview's `epoch` and `expectedRevision`, the published `assetId`, and a fresh `operationId` and millisecond `issuedAt`. Retain both identifiers for a retry. If another editor changed the attachment, show the new preview before applying a different operation.
5. To remove an attachment, preview `remove`, confirm the chosen item, then use `tasker_attachment_remove` without an asset ID. Report the returned revision, released bytes and pending release. A successful transfer alone does not change the task.

For replacement, the prior original stays attached until the revision-checked change succeeds. The server enforces the original's type and byte size and applies storage quota. Images and other files have separate decimal MB caps. Free supports 5 MB images and 25 MB other originals, Starter 15 MB and 100 MB, Pro 25 MB and 200 MB. Originals on active tasks have no archival timer.

## Archiving a ticket

Before archiving, call `tasker_storage_files` for the selected task and offer an export of any originals the user wants to keep. The server returns `expiresIfArchivedNow` for an active ticket original and `expiresAt` for an archived one. These optional UTC timestamps are the earliest applicable eligibility dates. Older servers, unknown entitlements or an unstarted retention clock can leave them empty. Read the next page when present. An inline description image has neither date.

Free normally allows 30 days for an archived original and Starter/Pro 90. A later original addition or the activation of cleanup can delay eligibility. Replacement preserves the original addition date. A Free ticket can itself expire after 90 days. Restore a ticket before expiry to preserve its remaining originals while active. Restoring cannot recreate bytes already removed. Pasting a link in Memory does not make an independent copy. A recognized reference in the source project can keep the underlying bytes in storage even after the ticket’s own attachment expires. Export the original or make a separately authorized upload to retain a copy under the destination’s quota and access rules.

## Notes and project ownership

An agent may update a single Memory note or use `memory.page.delete` to retire it from the active tree and search. Include a concise `changeReason`, retain the page ID and read its version history to recover earlier content. The selected earlier revision can be restored with the current revision. The retained page and history still count toward quota. The owner manages deletion of an entire project or Memory in the application. Never simulate bulk cleanup by deleting its children.

## Clean up files inside one space

Read `tasker_workflow` topic `storage-cleanup`. The CLI accepts one JSON input file for each command.

| CLI command               | Project tool                       | Memory tool                       |
| ------------------------- | ---------------------------------- | --------------------------------- |
| `storage resources`       | `tasker_project_storage_resources` | `tasker_memory_storage_resources` |
| `storage cleanup-preview` | `tasker_project_cleanup_preview`   | `tasker_memory_cleanup_preview`   |
| `storage cleanup-status`  | `tasker_project_cleanup_status`    | `tasker_memory_cleanup_status`    |
| `storage cleanup-apply`   | `tasker_project_cleanup_apply`     | `tasker_memory_cleanup_apply`     |

For example, `geniustasker storage resources --file query.json` accepts `{"scope":"project:example","type":"video","state":"archived","limit":10}`. Continue with the same filters and the returned cursor. Present the space, file names, protection reasons and recoverable bytes. Files can be shared across references.

To preview a selection, send `scope`, `mode` (`light` or `deep`) and 1–16 distinct `assetIds` from the listing. Show the preview's exact effect before asking for explicit approval. Keep its `operationId`. Applying accepts only `scope`, that `operationId`, and `confirmed: true`. Status uses the same ID without the confirmation field. A timeout or delayed release calls for reading status. Report the receipt's actual recovered bytes.

For listing, preview and status, the connection needs `storage:read`, `history:read`, plus the applicable resource rights: `tasks:read` for projects, both `memory:read` and `media:read` for Memory, or `media:read` for personal files. Applying additionally needs `storage:clean` and either `attachments:remove` in the project or `media:write` in the Memory or personal space. A declined preview expires with files intact. For old conversation files use the connected user’s exact `personal:<userId>` scope with `category: conversation`. Personal MCP tools use `tasker_personal_storage_resources`, `tasker_personal_cleanup_preview`, `tasker_personal_cleanup_status` and `tasker_personal_cleanup_apply`. The CLI picks the matching domain from the scope. An agent cannot enumerate the owner’s other spaces through this selection.
