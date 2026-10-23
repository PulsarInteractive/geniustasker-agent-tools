# Connect GeniusTasker to ChatGPT

Use the hosted MCP connector to work with GeniusTasker from ChatGPT. Your computer does not need to run the CLI. Access still requires an admitted GeniusTasker account.

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

Disconnecting the plugin in ChatGPT removes its use there. Also revoke its dedicated connection from GeniusTasker's agent settings to invalidate its delegated sessions. Reconnecting requires consent again. This connector never needs your OpenAI API key.

## Examples

- “Use GeniusTasker to show my current project tasks, then propose priorities.”
- “Move this task to next week after showing me the exact change.”
- “Find the release notes in Memory and the related Graph references.”

## Scope and troubleshooting

- If access is denied, check the account's admission, selected permissions, resource membership and subscription. The connector cannot bypass these checks.
- If a quota is reached, respect the returned retry time. Do not loop or create extra connections to evade limits.
- If a record changed, read the new revision instead of overwriting it blindly.
- Local file comparison, uploads from your computer and repository documentation mirroring remain CLI workflows.
- The public tool catalogue is in [`remote/tool-catalog.json`](../remote/tool-catalog.json). Tools are described separately from private backend implementation.

A custom connection is separate from an OpenAI directory listing. See [official publication](OPENAI_PUBLICATION.md). The CLI and local MCP remain supported independently.
