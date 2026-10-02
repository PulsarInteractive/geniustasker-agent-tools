# Keep product documentation beside your code

Choose the Memory libraries and Graphs relevant to a repository. GeniusTasker is
the editable source; the CLI produces a dated Markdown snapshot in your chosen
directory. Memory remains independent of projects.

This workflow requires `documentationSync: true` in `geniustasker capabilities`
and the `docs sync` command in your installed client. All reads use your current
account, connection, profile and page permissions.

## Configure a repository

Create a small configuration file, for example `geniustasker-docs.json`:

```json
{
  "formatVersion": 1,
  "sources": [
    { "scope": "memory:PRODUCT_ID", "pages": true, "graph": true },
    { "scope": "memory:DESIGN_ID", "parentId": "VISUALS_FOLDER_ID", "pages": true }
  ],
  "media": "local"
}
```

Use IDs discovered through your own account. Omit `parentId` for a whole library.
`graph` includes that scope’s Graph, independently of its document subtree.
`media: "references"` keeps resource IDs without downloading bytes; `local`
downloads only media used by the selected pages and Graph thumbnails and needs
`media:read`. Choose up to 50 scopes, with one subtree per scope.

```sh
geniustasker docs sync --context work --directory docs/geniustasker --file geniustasker-docs.json --json
geniustasker docs status --directory docs/geniustasker --json
geniustasker docs sync --context work --directory docs/geniustasker --json
```

The first call saves the selection. Later calls reuse it; supplying another
configuration explicitly changes the selection. The recommended destination is
`docs/geniustasker/`, but choose a path that fits your repository. Exporting private
knowledge does not publish it or authorize committing it to a public repository.

## What appears locally

All generated files live in the destination’s **`content/`** subdirectory.
Keep handwritten files alongside `content/`, rather than inside it.

```text
docs/geniustasker/
  content/
    .geniustasker-manifest.json
    memory-PRODUCT_ID/
      index.md
      pages/
        overview--stable-suffix/index.md
        visuals--stable-suffix/
          interface--stable-suffix/index.md
      resources/RESOURCE_ID.png
      graph.md
      graph.json
      graph/nodes-0000.md
      graph/nodes-0000.json
      graph/edges-0000.md
      graph/edges-0000.json
```

Pages keep Markdown headings, tables, lists, code and Mermaid blocks. Each starts
with an automatic-generation notice and ends with source ID, revision, edit time,
creator/editor and source epoch. Older imported records can have an unknown
editor; the exporter does not invent one. View diagrams in a Mermaid-capable
Markdown reader.

Shared resources have one local file per asset ID within the selected Memory.
The server’s verified SHA-256 is checked when available; unchanged immutable
assets reuse the previously verified local bytes. Generated files contain no
bearer tokens or signed download URLs.

Graph JSON is split into chunks of at most 100 records, with a small `graph.json`
index. The Markdown companions preserve node notes and qualified relations.
References to another Memory remain source identities: access to a Graph does
not grant access to linked content, and a missing reference does not erase nodes.

## Efficient updates

The exporter checks current access and folder versions first. It skips unchanged
branches, retrieves changed Markdown pages individually, and uses Graph change
cursors after the first inventory. Moves, non-latest-child deletions and restored
sources are detected. A continuation cannot silently mix source revisions.

An interrupted first export keeps completed downloads in a private cache beside
the CLI credentials, outside the repository. The next attempt checks access and
the current tree again before reusing a page with the same revision. Graph and
media downloads also resume when their source checkpoint still matches. A quota
reset therefore does not require downloading the same first pages repeatedly.
Changed or inaccessible entries are discarded. The temporary cache is bounded
to twice the selected byte budget and is removed after a successful sync.

Use `memory tree --scope memory:ID` to inspect a bounded folder. Continue with
`--after`, `--epoch` and `--checkpoint`. Use `memory markdown --scope memory:ID
--page PAGE_ID` for one page, optionally with its expected `--revision`.

There is no background polling. For a repository using generated knowledge:

1. At the beginning of a working day, check `docs status`; sync before relying on
   a snapshot whose freshness has not been checked that day.
2. Read local files for the task. Fetch only missing source details through MCP.
3. Apply relevant documentation changes to GeniusTasker using MCP, preserving
   IDs, hierarchy, source authority and expected revisions.
4. Sync again after finishing work that changes the documented product or Graph.

An offline or refused check never advances the successful check time. Local
files remain dated snapshots, not evidence of present authorization.

## Failure and recovery

| Situation                               | Result and next step                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Network error or interrupted download   | The previous complete snapshot remains. Rerun sync; completed downloads resume after fresh authorization and version checks.             |
| Source changed during export            | No mixed snapshot is installed. Reread and rerun.                                                                                        |
| Confirmed scope denial                  | Its managed snapshot is removed and marked unavailable. Regrant permits a fresh export. This cannot retract Git history or other copies. |
| Local edits/additions inside `content/` | Sync stops without overwriting them. Apply edits through MCP and preserve handwritten files outside the managed directory.               |
| Account/environment changed             | Use a separate destination; the exporter refuses to merge identities.                                                                    |
| Another exporter is running             | Wait for it. A crashed process can be released with `docs unlock --directory ...`; a living or foreign-host process is never unlocked.   |
| Interrupted directory replacement       | The next sync restores the previous snapshot when necessary, then revalidates. It does not publish unchecked staged data.                |
| Quota or rate limit                     | Follow the returned reset/retry guidance. Do not create profiles to bypass account limits.                                               |

Symlink destinations, path traversal and conflicting generated paths are refused.
The default budget is 20,000 files and 256 MiB. Explicit `--max-files` (up to
100,000) and `--max-bytes` (up to 4 GiB) can raise it for a reviewed selection;
individual files remain bounded. These local budgets do not increase server
quotas. Narrow the selection if exporting everything is unnecessary.

## Agent tools

| Tool                     | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `tasker_memory_tree`     | Inspect a folder and descendant versions without loading bodies |
| `tasker_memory_markdown` | Fetch one source page with provenance                           |
| `tasker_docs_status`     | Inspect the saved date and selections locally                   |
| `tasker_docs_sync`       | Refresh the explicit selection in a local directory             |
| `tasker_media_compare`   | Compare a local file with an existing resource before upload    |

The documentation, media and Graph skills describe the corresponding workflows.
They do not authorize account changes or publication outside the user’s task.
