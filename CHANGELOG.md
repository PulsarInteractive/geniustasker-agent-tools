# Changelog

## 0.1.0-beta.19

- Inspect one project’s storage, preview a single attachment change and publish an original with resumable uploads. Addition, replacement and removal have separate grants.
- Retire individual notes with a recoverable editorial history. Project and Memory deletion are owner actions.

## 0.1.0-beta.18 — 2026-11-19

- Review verified project changes against the owner's documentation policy and the selected note revision. Offer first notes individually, preserve each section's language and style, and preview optional product, game, music or free-form pages.
- Read selected page outlines, blocks and retained revisions in metered batches of up to five. Inspect revision history, compare changes and restore an explicitly chosen version.
- Query one project's archive by text, dates, status, impact or assignee, then read an archived task and its comments with explicit historical access. Existing grants remain unchanged.

## 0.1.0-beta.17

- Discover support reporting through feedback capabilities, including when ordinary project commands omit it.
- Configure completion alerts independently from task impact. Respect human-owned choices and nominate exceptional subtasks explicitly.
- Read one task’s description and its checklist by task ID. Add steps to a chosen section, including while holding an agent run.

## 0.1.0-beta.16

- Document how an agent starts a New task after claiming its run, verifies InProgress on the task, and explicitly resumes previously paused work.
- Explain which revision a claimed checklist change returns. The checklist guides show how to verify the item and parent totals, and how to recover the original command after an interrupted reply.
- List all bundled topics in `geniustasker workflow show --help`. An omitted or unknown topic now returns a usage error and points to that list.

## 0.1.0-beta.15 — 2026-11-17

- Add explicit task/run pause and resume commands with a useful reason and resumption point. InProgress now means current identifiable execution; silence, stale leases and unfinished code do not establish activity or a pause. Current service capabilities remain authoritative.
- Add explicit task-state v2 reads with pause metadata while preserving v1 and legacy response compatibility. Missing, Unknown or incomplete availability never establishes permission to start or finish work.
- Add bounded per-task checklist reads and typed create, check/uncheck, rename, move and remove commands, including the live-run path. Checkbox progress never completes, resumes or reopens a task, awards XP or requests push. Use separate tickets for independently owned, estimated or scheduled work.
- Validate generated command data schemas before journaling or sending, including description length and effort limits. Preserve exact saved operations after uncertain replies; no silent rewriting or expanded grants.

## 0.1.0-beta.14 — 2026-11-17

- Add generated task create/update help and task/run lock commands without expanding task permissions. Guides distinguish canonical progress from current availability, preserve dependency locks after manual unlock and require the live run path for a claimed task. Availability and deployment remain server-authoritative.
- Read task availability only through explicit `taskState: "v1"` / `--task-state v1` after capability discovery. Legacy reads retain their old response shape. Validate optional task snapshots without treating an absent or incomplete source as available.

- Preserve optional protocol effort in command help and preview, including `0.1` working day and null for unknown. Teach truthful New/InProgress/Done progress, effort distinct from deadlines or AI runtime, and preservation of human estimates. Older deployments remain authoritative.

- Add private feedback to CLI, local MCP and the hosted tool catalogue: immutable bug/suggestion submission, receipts and final decision tracking without chat. Current grants, account plan and deployment activation remain authoritative.
- Add authorized local screenshot preparation, reservation, bounded binary transfer and exact retry. Hosted ChatGPT screenshot import is not implemented. A focused feedback skill requires the user's reporting instruction or agreement before submission.

- Leave default browser/device login scopes to the selected server's consent proposal so a newer CLI can connect to an earlier deployment. Explicit `--scope` remains unchanged; existing connections and profiles are never expanded automatically.
- Add bounded personal focus/defer reads and replacement previews to CLI, local MCP and the hosted tool catalogue. Explicit `intent.change` commands reuse current revisions and the immutable command journal; they do not change shared task dates, status or rewards.
- Document whole-selection replacement, cancellation, target invalidation and the connected owner boundary. Use only when `intent.change` is advertised by the deployment capabilities.

## 0.1.0-beta.13 — 2026-11-16

- Add personal and project custom metrics with scoped discovery, exact aggregation, observation history, corrections and voids.
- Link metrics to lifetime or fixed-window goals with bounded backfill, exact target comparisons and explicit notification/coach choices.
- Provide metric and goal guides, generated command schemas and a dedicated MCP write tool. Read current service capabilities and permissions before use; availability depends on the connected deployment.

## 0.1.0-beta.12 — 2026-11-16

- Add an opt-in host event adapter to CLI/local MCP with stable IDs/times, prepare-only support and the normal immutable journal. Process exit requests review, never task completion; no process/log capture or automatic polling.
- Clarify Memory cooperation, hosted versus local retries and server-owned latest-agent attribution; preserve concurrent contributions after explicit revision conflicts.

- Agent run workflows document explicit claims, real checkpoints, fenced task patches and truthful completion across CLI and MCP.

- Protocol command help now includes filtered, generated nested schemas, nullability and limits in the CLI and local MCP, with an explicit publish example.

- Add task protocol preview to CLI/local MCP and the hosted tool catalogue, with a read-only POST, digest-bound pagination, explicit 20-step apply commands and a shared protocol workflow.

- Explain impact-based task importance, short reasons for agent-classified Important/Critical work, preservation of human choices and the same workflow across CLI/local MCP/hosted guides. Field availability is discovered from the service; this is not a claim of Flutter notification-threshold delivery.
- Discover updates at most once per UTC day and installed version in interactive terminals, with bounded anonymous npm checks and an opt-out. JSON, MCP, CI and local-only commands do not check automatically.
- Add `update check` and explicit `update install` with beta/stable channel selection. Global npm installation is verified before and after the update; local/npx/managed copies receive manual guidance.
- Keep simultaneous CLI commands and long-lived MCP servers protected from installation through per-process activity leases. Credentials and immutable operation journals are unchanged.

## 0.1.0-beta.11 — 2026-10-26

- Update the transitive URI parser to its patched 3.1.9 release.

- Preserve sessions and immutable command journals on temporary edge refusals. Respect numeric and HTTP-date Retry-After deadlines across CLI restarts, with positive jitter and no automatic replay. Recognized API permission refusals keep their existing behavior.

- Correct CLI help to describe the official login's requested-permission defaults.

## 0.1.0-beta.10

- Add project creation/settings/deletion with the distinct `projects:write` permission. Existing grants do not expand automatically.
- Expose native sprint, workflow, recurring-task and project-document commands through CLI, local MCP and hosted discovery.
- Document planning invariants and Memory folder structure, with bounded permission-specific tools and unchanged account quotas.

## 0.1.0-beta.9 — 2026-10-23

- Add on-demand workflow guides to hosted and local MCP and `workflow show` to the CLI.
- Correct hosted archive filters to the API values `active`, `archived` and `all`.
- Explain remote immutable-command recovery separately from the local operation journal.
- Expand connection, permissions, product workflows and live application update documentation.

## 0.1.0-beta.8

- Explain shared account quotas across CLI, local MCP and ChatGPT.
- Guide assistants to use the user’s language and preserve existing record text.
- Clarify ambiguous planning dates and consent-language behavior.

## 0.1.0-beta.7

- Add the remote ChatGPT tool catalogue and OAuth connection guide.
- Document the separate official directory submission process.
- Upgrade the MCP server SDK to 2.3.1 with published security fixes.

## 0.1.0-beta.6 — 2026-10-14

- Shared project filter commands and criteria guide, gated by advertised service capabilities.
- Project tag create, update and delete commands, with project permissions and
  immutable operation retries. Requires the connected service to advertise `tag.*`.
- Guidance for reusing tag IDs and preserving project-specific workflows.
- Updated the development MCP client to 2.3.1; local stdio compatibility is tested.

## 0.1.0-beta.5 — 2026-10-02

- Incremental repository documentation from selected Memory folders and Graphs,
  with generated Markdown provenance and optional digest-verified local media.
- Safe staged exports, local-edit detection, access revalidation, revocation
  cleanup and account isolation; large Graphs use bounded portable chunks.
- Tree and Markdown read tools, documentation sync/status and media comparison.
- Focused documentation, resource and Graph skills with daily/post-work refresh.

Requires the service's `documentationSync` and `protectedMemoryAssets`
capabilities as appropriate.

## 0.1.0-beta.4 — 2026-10-02

- Short npm overview, focused Memory guide and account usage tables.
- Explain the UUID v4 identity required for Memory creation before sending an invalid request.
- Private Memory attachments through resumable MCP/CLI uploads, bounded binary transport and explicit downloads.
- Memory full-text search, bounded Graph neighborhoods and permission-aware references.
- Graph node/edge commands and richer document metadata from the API contract.
- Seven additional MCP tools and matching CLI commands; independent node content survives unavailable references.
- Shared request size bounds for rich documents, with immutable write retries preserved.

These additions require the corresponding service capabilities.

## 0.1.0-beta.3 — 2026-09-30

- MIT license for the client, skills and documentation; third-party license notices.
- Consistent source formatting, ESLint checks and pinned CI actions.
- Architecture, testing and contribution guides.
- Canonical Pulsar Interactive repository links.

## 0.1.0-beta.2 — 2026-09-30

- Public standalone repository, synthetic tests and CI.
- Portable plugin/MCP manifests and local marketplace catalog.
- Focused project and independent-memory skills with OpenAI display metadata.
- Installation guides, public source boundaries and hosted OpenAI integration milestone.
- Corrected outdated local-preview wording in `doctor`.

## 0.1.0-beta.1 — 2026-09-30

- Browser PKCE consent, named contexts and delegated sessions.
- Local stdio MCP with 16 tools; independent account memories and project work.
- Shared-context refresh locking, journaled writes and resumable bounded reads.
- Published archive installed from npm and exercised through real read-only MCP.
