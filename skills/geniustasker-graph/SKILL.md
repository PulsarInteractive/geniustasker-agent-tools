---
name: geniustasker-graph
description: Explore and maintain typed GeniusTasker Graph nodes and relations, including references across product memories. Use for connected knowledge, identity links, relation edits or refreshing a repository Graph snapshot.
---

# Connected knowledge

Use current identity, grants and capabilities. Select a relevant Graph scope;
do not load every graph at startup. Search nodes, inspect `nodeIndex`, then use
`tasker_graph` around a selected node. Respect `truncated`: an incomplete
neighborhood cannot prove a relation is absent. Read full records before edits.

Each node owns its title, type, notes and optional resource thumbnail. Each edge
has a source, target, typed relation and certainty. Prefer precise relation names
and mark proposed connections as proposals. Preserve existing identities instead
of creating a second node for each appearance in another product.

References contain a Memory scope, page ID and optional block ID. Resolve them
through `tasker_reference` with current access. A missing or revoked target leaves
the node, its own notes and its edges intact. Never copy previously read private
text into a node to bypass revocation. Regrant can restore the reference.

Prepare mutations with the current revision and retain operation IDs for retries.
Edge endpoints must exist in the same Graph; cross-product knowledge is linked
through references. Remove incident edges explicitly before an authorized node
deletion. Node image changes use stable Memory resource IDs and media permissions.

For a configured local mirror, check freshness at least once each working day
before relying on it, and sync after relevant completed changes. Set `graph: true`
on the selected source. Portable chunks preserve own Graph records and relation
certainty without automatically fetching or retaining borrowed Memory bodies.
