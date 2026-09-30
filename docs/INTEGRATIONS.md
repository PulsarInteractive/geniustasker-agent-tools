# Connect your agent

Choose either direct MCP configuration or the plugin bundle, to avoid registering
the same server twice. Authenticate once per chosen local context. Permissions
are selected in the browser and enforced by the service on every request.

## Codex: direct MCP

```sh
npx -y @pulsarinteractive/geniustasker@0.1.0-beta.4 auth login --context work
codex mcp add geniustasker -- npx -y @pulsarinteractive/geniustasker@0.1.0-beta.4 mcp --context work
```

Restart the host as needed, then inspect its MCP list. Ask the agent to read its
GeniusTasker identity and list available projects. Configure a different context
when a separate terminal needs an independent session.

## Claude and other stdio hosts

Merge the `mcpServers.geniustasker` entry from [the example](../examples/mcp.json)
into the host's documented configuration. Don't replace unrelated servers.
No token, API key or password belongs in that configuration. Host-specific paths
and plugin formats vary; use the host's current documentation.

## Install skills separately

Clone this repository into a location you control. For a Codex user-level install,
copy the `geniustasker` and `geniustasker-memory` folders from `skills/` into
`~/.agents/skills/`, keeping each `SKILL.md`, references and metadata together.
For Claude use its supported `.claude/skills/` location. Inspect an existing folder
before replacing it. Restart the agent and invoke `$geniustasker` or
`$geniustasker-memory` where the host supports named invocation.

Skills guide workflows; the MCP provides executable tools. The CLI remains useful
without skills, and skills can use the CLI when an MCP host is not configured.

## Portable plugin bundle

The root `plugin.json` and `mcp.json` follow Agent Plugins 1.0.0. The bundled MCP
runs locally over stdio and pins a published npm version. Node and npm must be
available in the execution environment. Authenticate the `work` context first.

The repository also has `.agents/plugins/marketplace.json` for local distribution:

```sh
codex plugin marketplace add PulsarInteractive/geniustasker-agent-tools
```

Use the host's Plugins interface to select and enable GeniusTasker. This local
marketplace is distinct from OpenAI's public directory. Packaging/schema checks
and SDK transport tests are automated; real host installation is recorded
separately in the release notes and must not be inferred from those tests.

## Revoke

```sh
geniustasker auth logout --context work
```

This revokes the server session before removing its credentials. A failed revoke
keeps local evidence so it can be retried. Uninstalling a package alone does not
revoke a remote session.
