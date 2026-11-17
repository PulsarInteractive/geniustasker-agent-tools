# Private feedback

Feedback reports a problem or suggestion about GeniusTasker itself. It does not
create a project ticket. Availability depends on the connected deployment,
account admission, plan and current consent. Installing this source does not
activate the backend or expand an existing connection.

Free accounts can report bugs and recover delivery receipts with `feedback:write`.
Starter/Pro can also suggest features and read their feedback with `feedback:read`.
Capabilities reflect both the plan and the current connection/profile grants.
Start with `feedback capabilities`; do not infer rights from an old receipt.
If a new grant is needed, the human reconnects in the relevant host. CLI consent
does not change a ChatGPT connection. Login without `--scope` leaves the proposed
permissions to that server; an explicit `--scope` remains strict.

## Prepare and submit

Use the same context and environment throughout. These examples target an
already connected production context; production remains limited to admitted
accounts. Supply the title and observed description in a local JSON draft:

```json
{
  "type": "BugReport",
  "category": "sync",
  "title": "The task title stayed unchanged on the other device",
  "description": "The web page showed the saved title. The phone still showed its previous title after reopening the project.",
  "attachments": []
}
```

```sh
geniustasker feedback capabilities --environment production --context work --json
geniustasker feedback prepare --file draft.json --environment production --context work --json
geniustasker feedback submit --file command.json --environment production --context work --json
```

Save the exact `data.command` returned by prepare as `command.json`. Preparation
reads the current epoch if omitted and saves a private local journal; it does not
submit. The command contains `commandId`, `issuedAt`, `draftId`, `expectedEpoch`
and the complete report. Show the content and selected attachments, then submit
after agreement. A direct instruction to report already authorizes that report.
Never silently send every tool error or attach private context automatically.

After an uncertain response, use `feedback receipt --id COMMAND_ID` or
`commands retry --operation COMMAND_ID` with the same context and environment.
`commands inspect --operation COMMAND_ID` reads the local journal. Retry reuses
the exact saved body and original connection/profile/session. A confirmed local
receipt avoids another request; it does not prove current status. Never edit
the command or generate a fresh ID to retry.

## Screenshots

Choose one draft UUID and current epoch first. Before submitting, prepare a
selected local file with `feedback media-prepare --draft-id DRAFT_UUID --epoch
CURRENT_EPOCH --file screenshot.png`. Save the returned metadata, then use
`feedback media-open --file upload.json`. Reserve only user-authorized images;
this step consumes storage admission. Upload with `feedback media-upload
--operation UPLOAD_UUID --file screenshot.png` and retain the same bytes and ID
after uncertainty. Confirmed upload replay does not reread the file.

Put ready asset IDs in `attachments` and use the same `draftId` when preparing
the final report. Up to three static PNG/JPEG/WebP images can accompany the
initial request. Source bytes are capped at 4,000,000; the server normalizes to
WebP, at most 1080 px on the longest side and 1,000,000 stored bytes. Feedback and
global account storage quotas both apply. Local source inspection does not
replace server validation. Text-only reporting remains available if image
storage is refused. Existing reports cannot receive additional images.

`feedback media-download --id ASSET_ID --file new-image.webp` downloads an
authorized image without overwriting a local file. `feedback media-remove --id
ASSET_ID` removes only an explicitly selected image at the user's request. Both
accept the usual context/environment options. Retrying removal uses the same ID.

## Decision tracking and MCP

`feedback list` accepts `--status`, `--type` and a returned `--after` cursor.
`feedback show --id REQUEST_ID` reads an exact decision. Read only requested
pages; do not poll. `feedback mark-read --file read.json` accepts
`{"id":"REQUEST_UUID","request":{"expectedEpoch":"CURRENT_EPOCH","revision":"VIEWED_REVISION"}}`
and requires `feedback:write` in addition to plan eligibility.

The team records a status, resolution and optional final message. There is no
conversation or reply command; the `messages` array has at most one final team
message. “Saved for later” does not promise delivery. A closure can send a push
according to the user's notification settings; intermediate changes do not.
Private administrative notes and duplicate targets are not exposed.

Local MCP exposes `tasker_feedback_*` tools for the same workflow, plus local
image preparation/upload/download. Hosted MCP exposes capabilities, prepare,
submit, list, detail, receipt, mark-read and image removal. Hosted preparation
returns an immutable object without a local journal: retain and resubmit the
exact object after uncertainty. It never accepts arbitrary URLs or filesystem
paths. Hosted ChatGPT attachment import is not implemented; a visible chat
attachment is not an uploaded feedback image. Use text-only feedback there
unless an authorized ready asset already exists.
