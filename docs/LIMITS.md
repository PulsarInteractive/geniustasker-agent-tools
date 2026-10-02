# Usage limits

CLI and MCP share your GeniusTasker account limits. Creating more agent profiles,
opening more terminals or changing devices does not give additional allowance.
The service reports current limits through `geniustasker capabilities --json`.

## Agent requests

| Allowance                     |  Free |            Premium |                Pro |
| ----------------------------- | ----: | -----------------: | -----------------: |
| Requests per 60 seconds       |    30 |                120 |                300 |
| Write requests per 60 seconds |     5 |                 20 |                 60 |
| Monthly request credits       | 5,000 | No monthly ceiling | No monthly ceiling |
| Monthly write requests        |   500 | No monthly ceiling | No monthly ceiling |

Write requests also count toward the request limit. For Free accounts, a read
costs one monthly credit and a write costs five; both monthly limits must have
capacity. Monthly counters reset at the beginning of the next calendar month
in UTC. Premium appears as `Starter` in API responses; Pro appears as `Pro`.

These are the current service settings, not a pricing commitment. Short-window
limits provide traffic protection and can apply approximately by location;
clients must follow the service response. Resource limits for projects, members,
Memory, storage and attachments are separate and still apply. Availability also
requires account approval and an explicitly granted agent connection.

## When a limit is reached

| Response                         | Next step                                                             |
| -------------------------------- | --------------------------------------------------------------------- |
| Temporary rate limit (`429`)     | Wait for the reported retry time; do not loop or open another context |
| Free monthly allowance exhausted | Wait for the reported reset or change plan when available             |
| Resource capacity reached        | Free capacity or change plan before creating more data                |
| Permission refused (`403`)       | Ask the account or resource owner to review access                    |
| Interrupted write                | Keep its operation ID and retry that same operation                   |

The client preserves a write's immutable journal for safe retries. A timeout is
not proof that the write failed. Read the latest record after a revision conflict
before preparing a new operation.

## Keep reads focused

- List one page of spaces or resources at a time and follow its cursor as needed.
- Use Memory search and its page index before downloading document bodies.
- Explore a bounded Graph neighborhood instead of loading every node.
- Reuse checkpoints for change reads; honor `restart_read` when the service asks.
- Local cache hits revalidate access. Revoked permissions never become an offline grant.

See [CLI reference](CLI.md) for commands and [Memory & Graph](MEMORY.md) for examples.
