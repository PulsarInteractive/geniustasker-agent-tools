# GeniusTasker CLI & MCP

Manage projects, tasks and knowledge from your terminal or AI assistant.
Connect once in your browser, choose what your agent can access, and stay in control.

[Get started](#get-started) · [Agent setup](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/INTEGRATIONS.md) · [Commands](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/CLI.md) · [Usage limits](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/LIMITS.md)

## Get started

Requires **Node.js 22.13+** and an approved GeniusTasker account.

```sh
npm install -g @pulsarinteractive/geniustasker@beta
geniustasker auth login --context work
geniustasker projects list --context work --json
```

Sign in in the browser, select your projects or memories, then approve the requested
permissions. The terminal connects automatically. No token to copy.
Installing the package does not grant application access.

## What you can do

| Area                | Features                                                       |
| ------------------- | -------------------------------------------------------------- |
| Projects & tasks    | Browse work, update tickets, record progress and read comments |
| Agent collaboration | Ask for decisions, track replies and keep useful handoffs      |
| Memory              | Search documents and read the pages you need                   |
| Graph               | Explore connected ideas and resolve links to Memory content    |
| Files               | Upload approved attachments and download selected files        |
| Permissions         | Choose scopes, restrict agent profiles and revoke connections  |

Availability follows your account, the permissions you approve and the service's
current capabilities. [Memory & Graph guide](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/MEMORY.md).

## Connect your AI assistant

For a stdio MCP host, use this after signing in:

```json
{
  "mcpServers": {
    "geniustasker": {
      "command": "npx",
      "args": ["-y", "@pulsarinteractive/geniustasker@0.1.0-beta.5", "mcp", "--context", "work"]
    }
  }
}
```

See [Codex, Claude and skills setup](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/INTEGRATIONS.md).
Your AI assistant uses its own model subscription; this package does not run or
bill the model. The [OpenAI integration guide](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/OPENAI.md)
explains the available local integration and hosted integration status.

## Documentation

| Guide                                                                                                                          | Use it for                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [CLI reference](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/CLI.md)                           | Commands, browser login, remote terminals and troubleshooting |
| [Usage limits](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/LIMITS.md)                         | Plan limits, shared account quotas and safe retries           |
| [Memory & Graph](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/MEMORY.md)                       | Documents, links, attachments and access changes              |
| [Repository documentation](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/docs/DOCUMENTATION_SYNC.md) | Source selection, Markdown snapshots and freshness            |
| [Security](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/SECURITY.md)                                | Credential handling and reporting a vulnerability             |
| [Contributing](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/CONTRIBUTING.md)                        | Local development, tests and contribution guidelines          |
| [Changelog](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/CHANGELOG.md)                              | Changes in each release                                       |

## License

[MIT](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/LICENSE)
for this CLI, MCP server, skills and documentation.
[Third-party notices](https://github.com/PulsarInteractive/geniustasker-agent-tools/blob/main/THIRD_PARTY_NOTICES.md)
cover included components. The GeniusTasker application and backend are separate.
