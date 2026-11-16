# Focused knowledge workflows

## Find evidence in a large account

Discover identity, capabilities and the available Memory names and summaries.
Choose relevant sources before reading documents; do not download every space
at startup. Memory access is independent of project membership.

Search for a subject or read a bounded page index, then fetch the selected page
by ID or path. An excerpt is not the complete document. Follow continuation
with the original epoch and checkpoint, including empty pages with a cursor.
An unavailable source is not an empty source. Report the gap without changing
accounts, permissions or the user's sharing settings.

Search is lexical, not a semantic ranking or a corpus-wide reasoning engine.
It matches up to twelve word prefixes together in one Memory and returns one
bounded page. If the result is insufficient, refine the words or make another
targeted call. Each call has normal authorization and usage accounting; do not
simulate an unlimited search with parallel calls over every Memory.

## Explore Graph progressively

Use node search or `nodeIndex` to find a starting node. Call `tasker_graph` with
that `center` and depth 1; expand to depth 2 or 3 only when the question needs it.
A truncated response does not prove that omitted relationships do not exist.
Use typed nodes and relations, keep uncertainty explicit, and read the current
full node before editing it.

Resolve linked content with `tasker_reference` using its target scope, page ID
and optional block ID. Graph access never grants access to a friend's Memory.
When that access disappears, keep the node, its own notes and its relations.
Do not replace missing content with an older private copy. Resolve again when
access returns.

## Maintain a collection incrementally

For ongoing collection work, finish its complete inventory before retaining the
final `changeCursor`. Apply an entire change page before advancing the cursor.
Targeted ID/path reads do not supply collection-wide change coverage. Honor
explicit omissions; a reset requires rebuilding the affected inventory rather
than guessing which rows changed. Use bounded watches only when ongoing work
requires them, and respect rate-limit delays.

## Understand the read cache

The client keeps at most 64 resource responses and 8 MiB in process memory.
Idle entries expire after 15 minutes. Every cache access still contacts the
service to revalidate current authorization and its version; it consumes a read
request. An unchanged reply reuses the validated body and reduces transferred
data. Older servers without validators simply return ordinary responses.

Queries, accounts, origins and credentials are isolated. Context changes,
failed reads and MCP writes invalidate cached responses. There is no disk cache
or offline fallback for private resource reads. Do not repeatedly query only to
exercise the cache; keep the source IDs and revisions needed for the current task.

## Edit and resume safely

Read the full current record before editing. Preserve stable block identifiers
and source provenance. Prepare one immutable command and retain its operation ID;
retry that exact operation after a timeout. A revision conflict requires a new
read and a new operation. Report what changed, what was verified, and what
remains inaccessible or incomplete.

## Cooperate without overwriting another agent

Two agents can read the same revision. A successful edit by one makes the
other's older update stale, even when their intended changes affect different
blocks. There is no automatic document merge and no exclusive Memory run lease.
Use separate profiles for attribution, not to avoid limits or gain access.

1. Read the full page or node and retain its epoch, revision and stable block IDs.
   Identify the requested change separately from the rest of the document.
2. Prepare one immutable operation. After a timeout, establish that operation's
   outcome before sending any replacement; a fresh read alone cannot settle an
   uncertain command.
3. If the service definitively reports `revision_conflict`, read the current
   record again. Keep the other agent's contribution and all unrelated IDs,
   references, source provenance and access fields.
4. If the changes are compatible, apply only the intended edit to the new full
   content and prepare a **new operation ID** using the newly read revision.
   For conflicting claims or incompatible edits, leave the current record intact
   and present the conflict or an explicitly labeled proposal to the user. Do not
   decide that your version is authoritative because it came from an agent.
5. Read back the saved result. Report the source ID/revision and the verified
   change. Refresh relevant documentation mirrors after the source is confirmed.

`sourceId`, `authority`, `provenance` and `metadataJson` describe the content;
they are not verified identity, permission or proof of factual correctness.
Preserve original attribution and distinguish evidence from a new proposal.
The read-only `lastAgentActor`, when available on a page, node or edge, identifies
the server-verified latest agent editor (`ownerId`, `profileId`, `profileName`).
Never send or forge it in an edit. A human edit clears it; an older record without
the field has unknown agent attribution, not proof of human authorship. This
latest-editor snapshot is not a complete audit history or a claim that its
content has been fact-checked.
For local CLI/MCP retain the journal operation ID. For hosted ChatGPT retain the
complete prepared command and retry it with the discovered Memory edit tool;
the host cannot read a local journal or repository filesystem.
