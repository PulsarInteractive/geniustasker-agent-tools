# GeniusTasker agent tools

Keep project progress, collaborators and your own AI agents in one place.
This repository contains the public **CLI, local MCP server and agent skills**.
The GeniusTasker application and service implementation are separate.
Canonical repository: [PulsarInteractive/geniustasker-agent-tools](https://github.com/PulsarInteractive/geniustasker-agent-tools).

[Install](#install-and-connect) · [Codex and Claude](docs/INTEGRATIONS.md) ·
[CLI reference](docs/CLI.md) · [OpenAI plugin](docs/OPENAI.md) · [Releases](CHANGELOG.md)

## Install and connect

Requires **Node.js 22.13+** and an account admitted to the development beta.
Installing the client does not enable access to the service.

```sh
npm install -g @pulsarinteractive/geniustasker@beta
geniustasker auth login --context work
geniustasker projects list --context work --json
```

A browser opens: sign in, select projects and independent memories, choose
permissions, then approve. The terminal finishes automatically. No token to copy.
For Chrome use `--browser chrome`; remote shells can use `--flow device --no-browser`.
Production agent access is not open in this beta.

## Connect an agent

After logging in with the `work` context:

```sh
codex mcp add geniustasker -- npx -y @pulsarinteractive/geniustasker@0.1.0-beta.3 mcp --context work
```

Other stdio MCP hosts can use [examples/mcp.json](examples/mcp.json).
The MCP exposes 16 tools for identity, capabilities, projects, memories, bounded
reads, profiles and journaled changes. It uses the session you explicitly approved.
GeniusTasker records work; your agent chooses and executes its own workflow.

## Skills

- [GeniusTasker](skills/geniustasker/SKILL.md): project work, tickets and useful handoffs.
- [GeniusTasker Memory](skills/geniustasker-memory/SKILL.md): independent knowledge,
  focused reads, stable blocks and resumable imports.

Install the skill folders in your agent's supported skill directory, or use the
plugin bundle described in [Integrations](docs/INTEGRATIONS.md). npm installation
alone does not register skills or MCP servers in your agent host.

## Plugin readiness

`plugin.json`, `mcp.json`, `skills/` and the local marketplace catalog form a
portable **local plugin bundle**. This is not an approved public ChatGPT-directory
plugin. The hosted HTTPS MCP/OAuth integration remains a separate milestone in
[OpenAI integration](docs/OPENAI.md).

## Development

```sh
npm ci
npm run verify
```

Tests use synthetic fixtures and local mock servers. CI has no production credentials.
`npm run check` checks the public file boundary, package contents and plugin schema.
See [Contributing](CONTRIBUTING.md), [Architecture](docs/ARCHITECTURE.md),
[Testing](docs/TESTING.md) and [Release process](docs/RELEASING.md).

## Privacy and source boundary

No application source, backend, account exports, infrastructure credentials or
private product documents belong here. Only the agent client and its public
interface contract are included. Credentials stay in the user's private local
store; never paste them into an issue. See [Security](SECURITY.md).

## License

The CLI, MCP server, skills and documentation are available under the
[MIT license](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for
vendor components. The separately hosted GeniusTasker application and backend
are not part of this repository.
