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
