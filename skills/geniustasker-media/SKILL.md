---
name: geniustasker-media
description: Manage GeniusTasker project photos, ticket originals and Memory resources. Use for project logos, file upload, replacement, removal, storage diagnostics, document images or Graph thumbnails.
---

# Memory resources

Discover `mediaUploadAvailable`, the current scope and the necessary media
permissions. Work only with explicitly selected files and destinations.

Before replacing an existing resource, call `tasker_media_compare` with the
local file, scope and asset ID. Equal bytes should reuse that ID without an upload
or new document revision. When bytes differ, inspect the old and new image or
media: a different checksum does not establish a visual improvement. Explain the
actual change before describing it as improved.

Prepare authorized uploads with `tasker_media_prepare`; retain the operation ID
and use `tasker_media_upload`. Retry uncertain transfers with that same ID.
Link the returned asset ID from document blocks or node thumbnails; never embed
base64 or public bucket URLs. One asset can have many uses without duplicate
storage. Asset bytes belong to the owning Memory’s quota.

Changing an image means publishing a new immutable resource and updating the
intended references with their current revisions. Reuse the old resource for any
pages that should keep it. When `protectedMemoryAssets` is advertised, removal
of an in-use resource returns `memory_asset_in_use`, including hidden uses.
Do not probe private page names or remove other users’ links to bypass the guard.
After the last authorized use is removed, normal resource removal can proceed.

After relevant edits, sync any configured repository documentation. Its optional
local media are derived snapshots; do not hand-edit them and claim the source was
updated. Report actual IDs, changed references and verification, without exposing
unrelated private source content.

## Storage and deletion

Read workflow `storage` for one ticket attachment or a project storage review.
An agent can edit or retire a single versioned note with its current revision and a change reason. Keep the note ID for history and restoration. Refer the owner to
the app for deleting a project or an entire Memory. Never approximate that
action with a sequence of child deletions.

For a ticket file, preview the selected attachment, transfer its original, then link the published asset using the current revision. Preserve the upload ID through interruptions. The [file workflow](../../docs/STORAGE.md) lists the exact calls for a conversation file and a local file.

Before archiving a ticket, read its file list and offer an export of any originals the user wants to keep. Show the server’s `expiresIfArchivedNow` before archiving and `expiresAt` after archiving. Explain when a date is unavailable. A link in Memory points to the source file. Restoring preserves originals that still exist while the ticket stays active.

## Project photos

For a project logo, follow the [project photo workflow](../../docs/STORAGE.md#project-photos). Prepare one selected image for the exact project, transfer it, reread the project root and apply `project.setPhoto` against its current revision. Confirm the saved icon by rereading that root. ChatGPT uses its selected-file prepare/upload tools, while local MCP/CLI uses the media journal with purpose `projectPhoto`. Keep the published asset ID when resuming. Check for a conflicting photo change before replacing it.
