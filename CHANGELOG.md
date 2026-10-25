# Changelog

## Unreleased

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
