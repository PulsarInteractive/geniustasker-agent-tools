# Memory and Graph

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
