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

Use `tasker_storage_tickets` and `tasker_storage_files` with a project scope, state and size threshold. Follow the continuation with unchanged filters. On partial coverage, `tasker_storage_analyze` processes one bounded slice. Keep its cursor and report the coverage. Use `tasker_storage_selection` with exactly one ticket ID or attachment ID. If a ticket spans multiple slices, keep the same selection and cursor, add only the returned slice totals, then report the final estimate. Shared and protected bytes can remain charged. Account-wide cleanup and bulk operations belong to the owner's application.

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

### Project photos

Use the specific project the user chose. Read its root with collection `project` and its own ID to obtain the current scope epoch and the existing icon. The connection needs `projects:read` for that read and `projects:write` with project management access for the change.

- With a local file, call `tasker_media_prepare` or `geniustasker media prepare --scope project:ID --purpose projectPhoto --epoch EPOCH --content-type image/png --file logo.png`, then transfer using `tasker_media_upload` or `geniustasker media upload --operation UUID`. Retain the operation ID across retries.
- With a file selected in ChatGPT, call `tasker_project_photo_prepare_host_file` and `tasker_project_photo_upload_host_file` with the same selected image and prepared metadata. An expired file selection can be renewed with identical bytes. Keep its asset ID on a retry. JPEG, PNG, WebP, GIF and AVIF are supported up to 15,000,000 bytes.
- Publication stages the image. Reread collection `project` for the exact project after publication. Prepare and execute `project.setPhoto` with that record’s ID, scope, epoch and current revision, supplying only `{"assetId":"PUBLISHED_UUID"}` as data. Reread the root and verify its `icon` references the published asset. Compare against the existing icon before linking. If someone has already changed the photo, ask whether to replace their choice. Use the exact prepared command through `tasker_edit_projects` in ChatGPT or `tasker_execute_command` in local MCP. Project photos, ticket attachments and Memory covers have separate scopes and lifecycles.
