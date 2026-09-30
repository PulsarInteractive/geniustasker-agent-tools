# OpenAI integration

## Available in this repository

The CLI authenticates through browser consent and exposes a local stdio MCP.
Two skills and portable plugin/MCP manifests are packaged together. Direct
Codex MCP configuration is documented in [Integrations](INTEGRATIONS.md).
Nothing here is an OpenAI directory approval or a hosted remote MCP endpoint.

## Hosted plugin milestone

| Work | Acceptance |
| --- | --- |
| HTTPS Streamable HTTP MCP adapter | Real initialize, tools/list and tool calls; reuse existing product commands and quotas |
| MCP OAuth compatibility | Protected-resource and authorization discovery, audience/resource binding, supported client registration, allowed callbacks, PKCE, expiry and revocation |
| Host authentication | Real browser consent, resource-limited reads, denied access and reauthentication |
| Writes | Explicit grants, correctly annotated tools, immutable retries and conflicts; no blanket approval |
| Optional company-knowledge search | Authorized search/fetch with user-openable citations and bounded results |
| Plugin review | Accurate install copy, privacy/terms links, domain verification, real test account, honest limitations |

The current CLI OAuth flow is a foundation; it is not proof that every hosted
MCP client's registration and resource-discovery requirements are implemented.
A hosted manifest requires a deployed and tested MCP server and a registered
application identifier. Embedded UI is optional.

The remotely hosted backend can remain private. A public source repository is a
client distribution and review surface, not an access grant to user data.

## Official references

Checked 30 September 2026:

- [MCP in Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [MCP hosting](https://developers.openai.com/plugins/build/mcp-server)
- [Authentication](https://developers.openai.com/plugins/build/auth)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
