# Guides, Skills and Graph

Guides is the space for project documentation. Skills contains reusable procedures, including when to apply them and what they require. These space names appear in both English and French. Existing command names, IDs, permissions and links stay valid.

| App                      | Kind        | Agent workflow                                                              |
| ------------------------ | ----------- | --------------------------------------------------------------------------- |
| Guides (formerly Memory) | `library`   | `memory-reading` for reference pages and their children                     |
| Skills (formerly Guides) | `playbooks` | `space-skills` for published procedures; `space-guides` on older clients    |
| Design                   | `design`    | `space-design` for visual variants and their files at the selected revision |

Dans l’application, **Guides** rassemble les pages de référence d’un projet. Une page peut contenir ses propres sous-pages. **Skills** regroupe les procédures réutilisables. Pour en suivre une, vérifiez son déclencheur et ses prérequis, puis citez la révision publiée dans le ticket. Les espaces existants gardent leurs titres et leurs instructions personnalisées.

Delegated access to Memory documents, history, assets and Graph through the CLI,
local MCP and ChatGPT requires a current Starter or Pro account and explicit
rights to the selected resource. A linked project and a paid space owner confer
no access on another account. Read live capabilities before selecting sections,
history or restore. On `memory_premium_required` or
`memory_graph_premium_required`, end that delegated read. The ordinary app and
account export use their own existing permissions after a downgrade.

Memory stores structured documents independently of projects. Graph connects
nodes and links them to a page or a stable document block. These commands require
the matching deployed service capabilities; check `geniustasker capabilities --json` before using them.

```sh
geniustasker memory search --scope memory:ID --query "release checklist" --json
geniustasker graph explore --scope memory:ID --center NODE_ID --depth 2 --json
geniustasker memory resolve --scope memory:ID --page PAGE_ID --block BLOCK_ID --json
```

The matching MCP tools are `tasker_search`, `tasker_graph` and `tasker_reference`.
Search is paginated; Graph returns a bounded neighborhood and reports truncation.
Use `resources list` for complete selected records and `commands describe` for
contract-derived node/edge write fields. Writes keep the same immutable journal.

References recheck current access. If a friend withdraws access, the content
becomes unavailable while the node and its own text remain intact. A new grant
restores resolution; a link never grants access by itself. The client does not
cache resolved content. Discover capabilities before selecting a workflow.

## Attachments

Discover `mediaUploadAvailable` and `maxUploadBytes` first. Prepare one explicitly
selected file with `media prepare --scope memory:ID --epoch EPOCH --file diagram.png
--content-type image/png`, then `media upload --operation UUID`. Keep that operation
ID after a timeout: retries verify the same bytes and do not create a second file.
Use the returned `assetId` in an image or attachment block. Images, PDF and plain
text are supported up to 15 MB; storage is charged to the Memory owner.

MCP equivalents are `tasker_media_prepare`, `tasker_media_upload`,
`tasker_media_action` and `tasker_media_download`. Downloads require an explicit
new local path and fresh read access. Removal leaves document blocks in place
so people can see and repair the unavailable attachment. No credentials, URLs
with public access tokens or file bytes are embedded in documents.

See the [CLI reference](CLI.md) for document blocks, page roles, node types, images and detailed command examples.

## Maintain a project note after a feature changes

At the start of an actual work session, inspect the project's linked library,
destination and editorial policy. After verifying a lasting change, search for
the existing feature guide and read its relevant section. An implemented fix, a
release and a proposal describe different states. Use the verified state in the
note and keep routine task progress in its ticket. When no suitable note exists,
offer a specific first page for an identified reader and purpose. Respect a
previous decision to defer or decline.

The command `geniustasker workflow show --topic memory-editorial` and MCP tool
`tasker_workflow` publish the same allowed editing procedure. The
`memory-templates` topic provides optional product, game, music and free-form
pages with English and French starting headings. Preview the selected page,
adapt the wording to the destination and populate it from authorized evidence.

## Read several notes

Save one JSON selection, then run `geniustasker memory read-pages --file selection.json`.
The local MCP and ChatGPT use the same JSON in `tasker_memory_read_pages`.

```json
{
  "scope": "memory:example",
  "pages": [
    { "pageId": "release-guide", "mode": "outline" },
    { "pageId": "offline-workouts", "mode": "blocks", "blockIds": ["starting-offline"] }
  ]
}
```

Use IDs returned by the authorized index and outline. Each selected page
uses one ordinary account read. A batch accepts five pages and runs at most two
reads at once. The logical response is limited to 64 KiB of UTF-8 JSON.
`complete` counts fully consumed selectors, including unchanged selectors.
A complete outline covers headings and previews only. Each partial page returns
its revision and a `nextCursor`. Reuse the original selector, supply that cursor
as `cursor`, and include the returned revision, scope epoch and checkpoint on
the next call. Use the stable block ID and UTF-16 offset to reassemble split text.
After a quota interruption save the unread IDs, wait for the reported reset,
and resume from the last verified page. No background reads are scheduled.

Compare ten chosen notes in two groups of five when each fits. Search and read
matching sections for a focused question about a 500-page library. For an
explicit full review, enumerate authorized IDs and revisions into a resumable
manifest, count complete and outstanding pages, then process selected blocks in
bounded batches. An expired checkpoint requires a new inventory and fresh
permission checks. A missing or forbidden page stays unavailable.

## Read and restore revisions

`memory history --scope memory:ID --page PAGE` lists retained revisions.
Repeat with `--before-revision` from `nextBeforeRevision` for older entries.
`memory diff --scope memory:ID --page PAGE --from REV --to REV` compares
retained revisions. To read retained content, include its revision as `atRevision` on the original outline or block selector. Reuse the same historical selector when continuing. Current membership and page rights always apply. The corresponding tools are `tasker_memory_history` and
`tasker_memory_diff`. When explicitly authorized, prepare the chosen
`scope`, `pageId`, `revision`, current `expectedRevision`, `epoch`,
new UUID `operationId` and millisecond `issuedAt` once. Submit the exact object
to `tasker_memory_restore` or `memory restore --file restore.json`. Preserve it
for retries and inspect the resulting note and revision after success.

Use `geniustasker memory template --family game --language fr` to list
independent game pages. Add `--page mechanic` to preview that page in French.
The preview contains possible headings and performs no write. The connector
offers the same selections through `tasker_memory_template`.

For a verified milestone, `memory review --file review.json` or
`tasker_memory_review` reads the project's current policy and checks the selected
candidate revision. Supply an editorial domain, the type of change, references
to reviewed evidence and candidates from a scoped search. The result explains
whether to leave the information in the task, clarify it, suggest a note or prepare
a small update. A read-only review cannot execute or authorize that update.

```json
{
  "scope": "project:example",
  "domain": "usage",
  "change": "feature",
  "sources": [{ "kind": "tested-release", "reference": "reviewed-release-42" }],
  "candidates": [{ "pageId": "offline-workouts", "revision": "21" }]
}
```

## Tracked decisions

A team can assign a reviewer to a decision in the app. The ordinary index
lists notes compactly. Reading a single `pageIndex` record by ID includes its
`data.decisionReview` and current revision. The reviewer can record a
verification date even if the wording remains accurate.

For example, a tested release changes the offline-workout rule documented in
a tracked decision. Use the review input above. When it returns
`prepare_proposal`, read the affected block at the returned revision and
compare the source with the text. If the published section is French, keep
the proposed change in French. A proposal's command data might be:

```json
{
  "blockId": "starting-offline",
  "original": "Une connexion est nécessaire pour démarrer la séance.",
  "replacement": "Une séance déjà enregistrée sur cet appareil peut démarrer hors ligne.",
  "evidenceKind": "tested-release",
  "evidenceRef": "reviewed-release-42"
}
```

Use the actual block ID, source reference and a verbatim excerpt occurring
exactly once in the current block. Include only changed wording, up to 2,000
characters per excerpt, and use a verifiable reference of up to 256 characters.
Accepted evidence kinds are `tested-release`, `verified-behavior`,
`approved-decision` and `verified-procedure`. A completed ticket alone
does not establish a change to the decision.
`tasker_command_help` describes `memory.page.proposeRevision`.
Prepare that command for the review’s Memory scope, page ID, epoch and current
revision. If `needsUserApprovalToSubmit` is true, wait for approval to submit.
Otherwise follow the project’s granted workflow. Read back the pending proposal
and report it as awaiting review. Only acceptance by its reviewer or an
administrator changes the published wording.

If a proposal is pending, let the reviewer resolve it. Respect a deferred or
dismissed suggestion. Automatic review skips evidence already used on that page
when its input identifies no new block. For an explicitly requested change in a
different block based on the same source, check the exact block, evidence kind
and reference against the page’s handled entries. An already-reviewed
combination ends the request. The exact index carries the 32 most recent handled
entries. The service also checks older handled proposals when a command is
submitted. If it returns `memory_decision_already_reviewed`, stop and leave the
reviewer’s inbox untouched. Preserve the original reference across retries.
If the excerpt changed, reread the section and check whether the change is still
needed. Missing delegation or an unavailable proposal command leaves the draft
with the human reviewer.

## Live components in Guides

A Guide can refer to another Guide, a Design page, a Skill or a project task. The same destination may appear twice with different presentations. Read the source page outline to find the IDs of the occurrences. A batch selects 1–16 particular block IDs from a single page.

```json
{
  "scope": "memory:field-guide",
  "pageId": "release",
  "blockIds": ["acceptance", "mobile-visual"]
}
```

Pass this file to `geniustasker guides components --file selection.json` or call `tasker_guide_components` with its contents. Each available result contains the selected presentation, destination and revision. The current permissions of the source and destination are checked for this read. An unavailable element contains its block ID and status. Re-read after an access change. A preview returns metadata and fetches no image originals.

To author a component, read the current source and select the authorized destination. For an unrelated edit, omit `blocks` or preserve the opaque occurrence from the read response (its ID, `kind: component`, empty text and `componentStamp` whenever supplied). The stamp identifies changes to the occurrence and must be copied without interpreting it. To change that occurrence, explicitly supply its new destination and presentation. Link and card presentations work across destinations. Tasks can also show status or their checklist summary. For a removal, include its occurrence ID in `componentRemovalIds`. Use `tasker_workflow` topic `guide-components` for the full sequence.

## Image reviews in Design

`geniustasker design grid --file filters.json` and `tasker_design_grid` browse the same gallery. Start with only the Design space scope for all formats or choose filters for one group, page, viewport, track, pair, criterion or verdict. An image is identified by its variant and block. Keep the filters unchanged on continuation. Ask the image tool for the exact revision to inspect its pixels.

An enabled space rubric applies to its track. A screen can add its own criteria. Child screens use their own local criteria. Each cell carries the current decision ID. To record requested evidence, `geniustasker design review --file decision.json` and `tasker_design_grid_decisions` take one criterion, one verdict and 1–16 explicit targets. A target contains `variantId`, `blockId`, `revision` and `expectedDecisionId`. Use `null` when no prior decision exists. Send a stable operation ID and timestamp. Read the individual receipts before reporting completion. The `design-image-review` workflow covers optional observations, explicit pairing, evidence selection and conflicts.
