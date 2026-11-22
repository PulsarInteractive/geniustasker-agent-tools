# Connect GeniusTasker to ChatGPT

Use the hosted MCP connector to work with GeniusTasker from ChatGPT. Your computer does not need to run the CLI. Access still requires an admitted GeniusTasker account.

The URL below targets production, where agent access is enabled for admitted
accounts. This is the same environment used by TestFlight. Sign in with the
intended account and review its resource permissions. The beta CLI's development
default does not change this hosted connector's environment, and connecting a
custom server does not imply approval in OpenAI's public directory.

For a first mission ask: “Show which GeniusTasker account and project you can read, what you can change there, and help me choose one ticket. Wait for my choice before starting.” The [walkthrough](FIRST_MISSION.md) includes interruption, evidence and read-only connections.

## Connect your account

1. In ChatGPT on the web, open **Plugins → Add → Add custom MCP server**.
2. Name it **GeniusTasker** and enter this server URL:

   ```text
   https://api-geniustasker.pulsarinteractive.cloud/api/agents/mcp
   ```

3. Select **OAuth**. In **Advanced OAuth settings**, choose a registered/provided client and enter **`geniustasker-chatgpt`**. The token endpoint authentication method is **none**: this is a public client protected by PKCE; there is no client secret to paste.
4. Review the warning, create the plugin, and sign in to GeniusTasker on its own consent page. Choose the permissions and resources you intend to share, then approve.
5. Install/select the resulting plugin in ChatGPT. Start a conversation and select it with **@GeniusTasker**.

The authorization server is discovered at `https://api-geniustasker.pulsarinteractive.cloud/api/agents/chatgpt`. If your ChatGPT interface requests explicit endpoints, use `/api/agents/oauth/authorize` and `/api/agents/oauth/token` on that same API host. The registered callback is exactly `https://chatgpt.com/connector_platform_oauth_redirect`; issuer identification protects the return. Do not substitute another callback or disable authentication.

## Working with your data

Read current records before changing them. ChatGPT can discover allowed actions, prepare a change, and execute the approved command. Keep the exact command when retrying an uncertain response: a repeated operation ID recovers the original result instead of applying the same edit twice. After a revision conflict, reread the record and confirm the replacement intent.

Use **read-only permissions** if you only want summaries. Write access does not grant administration, billing, permission management or access to another person's private data. Existing account limits apply to ChatGPT and the CLI together; connecting another tool does not create a fresh quota.

When the connected server advertises `tasker_changes`, it can read one bounded
change page per call using the normal shared read budget. Start with the
`changeCursor` returned by the final eligible resource page; filtered checklist
or metric inventories have no change cursor. Preserve the cursor exactly for
the same scope, collection, archive selection and access context. Apply items
and removals before saving `nextCursor`. Follow it while `hasMore` is true;
otherwise respect `pollAfterSeconds` without starting an unbounded polling loop.
A reset-required refusal means restarting the bounded inventory, not inventing
a cursor or adding filters.

For task availability, explicitly select the capability-advertised `taskState`
version: v2 only when `taskStateVersions` includes it, otherwise v1 when
advertised. Omission preserves the legacy response. Absent, Unknown or incomplete
availability never means a task is available. Any advanced task checkpoint,
including a removal without a dependent snapshot, invalidates old availability;
reread the relevant task before starting or completing it.

Disconnecting the plugin in ChatGPT removes its use there. Also revoke its dedicated connection from GeniusTasker's agent settings to invalidate its delegated sessions. Reconnecting requires consent again. This connector never needs your OpenAI API key.

## Language and shared limits

Ask in your preferred language. The assistant should explain results and errors in that language while preserving existing record text, IDs and API field values. The consent screen supports French and English; ChatGPT’s supported locale hint selects the screen language, with the browser language as fallback. Confirm dates and timezones when they are ambiguous.

CLI, local MCP and hosted ChatGPT use the verified account’s current subscription and shared request/write counters. New connections, profiles or refreshed tokens do not grant a new budget. Protocol discovery and command preparation also count as requests; a tool operation can involve more than one request. Resource capacity and Coach access remain enforced by the same domain commands. A rate-limit response includes retry guidance: wait rather than switching tools or starting an automatic retry loop.

## Examples

- “Use GeniusTasker to show my current project tasks, then propose priorities.”
- “Move this task to next week after showing me the exact change.”
- “Find the release notes in Guides and the related Graph references.”
- « Cherche les critères de livraison dans Guides et donne-moi la page où ils sont définis. »
- “Find the published skill for preparing a release in Skills and cite its revision.”
- « Dans Skills, retrouve la procédure de livraison publiée et vérifie que ses prérequis sont réunis. »

## Scope and troubleshooting

- If access is denied, check the account's admission, selected permissions, resource membership and subscription. The connector cannot bypass these checks.
- If a quota is reached, respect the returned retry time. Do not loop or create extra connections to evade limits.
- If a record changed, read the new revision instead of overwriting it blindly.
- Local file comparison, uploads from your computer and repository documentation mirroring remain CLI workflows.
- The public tool catalogue is in [`remote/tool-catalog.json`](../remote/tool-catalog.json). Tools are described separately from private backend implementation.

A custom connection is separate from an OpenAI directory listing. See [official publication](OPENAI_PUBLICATION.md). The CLI and local MCP remain supported independently.

## If the connection only allows reading

1. Open this app’s settings in ChatGPT and choose **Refresh tools** when available.
2. Choose **Reconnect** for the connected account. Check that the correct account
   appears on the product consent screen.
3. The requested permissions are selected by default. Keep the ones you want,
   including editing, then authorize. Explicitly restricted connections stay
   restricted; old grants are never silently expanded.
4. Ask the assistant to read its **identity** and **capabilities** again. Confirm
   that the required permissions and write commands appear before requesting an edit.

A new conversation may be needed after the tool catalogue changes. A CLI login
is a separate connection and does not update ChatGPT’s permissions.

## Guides available to the assistant

The connector includes a `tasker_workflow` tool. Ask it for the relevant guide
before an unfamiliar operation. These are reviewed instructions served directly
by the connector; custom ChatGPT connections do not automatically install the
skill files from this repository.

See [supported workflows](WORKFLOWS.md) for examples and boundaries, and
[CLI setup](CLI.md) for a terminal or local MCP connection. The local CLI can also
show a guide without downloading account data:

```sh
geniustasker workflow show --topic mutations --json
```

## See changes in the application

An accepted connector command changes the same data used by the application.
The open application’s normal realtime subscription receives a version hint and
loads the canonical change. When reconnecting after a network interruption, the
application catches up through its existing sync system. A server receipt and a
screen update are different observations: the assistant should verify the changed
record, and should not claim to have seen your screen unless it actually did.

## If ChatGPT cannot find bug reports or feature requests

Select **@GeniusTasker** and ask whether this connection can report a bug or suggest a
feature. The live check is `tasker_feedback_capabilities`. Product feedback
uses dedicated tools outside the list of project or training commands.

1. If that tool is missing, open **Plugins → GeniusTasker → Settings → Manage app → Refresh tools**, then select the plugin in a new chat.
2. If the tool returns `canReportBug: false`, review the selected account and its personal `feedback:write` grant. Reconnect in ChatGPT if you want to authorize that access.
3. If `canReportBug` is true and `canRequestFeature` is false, this account can report bugs. Feature requests require a paid plan.
4. Ask to prepare a report. Review its contents and selected attachments, then approve sending. The returned receipt identifies the submission.

When a verified feature changes, ask the connector to check the linked project's
editorial policy and its existing Memory. The `memory-editorial` workflow
describes when it may edit, offer a draft or leave the result in its ticket.
For comparing notes, use `tasker_memory_read_pages` with specific authorized
page and block IDs. The `memory-reading`, `memory-history` and
`memory-templates` workflows apply directly in hosted ChatGPT.

## Guide cards, Design reviews and selected files

For a question such as “Which steps remain on this release page?”, read its Guide outline and pass the selected component IDs to `tasker_guide_components`. The tool checks access to each live destination in the connected account. For “Montre-moi la maquette mobile et sa revue”, narrow `tasker_design_grid` to the appropriate space and viewport. Open only the selected media at its saved revision using `tasker_memory_view_image`. For a requested review use the `design-image-review` workflow.

If the host advertises `tasker_space_prepare_host_file` and `tasker_space_upload_host_file`, select a file in the conversation, choose its space and prepare it. Transfer the same file with the returned metadata. Select `pageCover` for a Guide header or `designVisual` for a gallery image. Both use server-side WebP compression. To keep a ZIP, HTML source or image as an original attachment, omit the purpose. Use the returned asset ID in a separately authorized page edit. A host without file transfer can use already published assets or the installed CLI.
