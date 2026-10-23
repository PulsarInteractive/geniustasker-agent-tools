# GeniusTasker and OpenAI tools

Use [the hosted ChatGPT connection guide](CHATGPT.md) for a remote OAuth MCP connection. It uses a dedicated GeniusTasker grant and requires no local process or OpenAI API key.

For terminal-based agents, the existing local MCP configuration and skills remain available; see [integrations](INTEGRATIONS.md). Local filesystem features remain local.

Public directory publication is a separate review: [submission checklist](OPENAI_PUBLICATION.md). A custom plugin is not a directory approval or an OpenAI endorsement.

### Reconnecting with edit permissions

The remote catalogue exposes permission-specific read and edit tools. This lets
ChatGPT request the permissions needed for tasks, planning and other supported
actions when linking or reconnecting an account. Consent remains editable;
selecting fewer permissions keeps the connection restricted. Coach tools also
require the Coach subscription and explicit access to the athlete's program.

Older linked accounts may have only read permissions. Refresh the plugin tools
and reconnect if editing permissions are missing; verify the connected account
and capabilities before working. Reconnection never bypasses account quotas.
The generic read/execute entry points remain for existing clients; new workflows
should prefer the permission-specific tools after preparing an immutable command.
