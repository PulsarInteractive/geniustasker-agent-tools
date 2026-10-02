---
name: geniustasker-media
description: Compare, reuse, upload and link GeniusTasker Memory resources with stable asset IDs. Use when maintaining document images, attachments or Graph thumbnails, especially when replacing an existing visual.
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
