# Contributing

Thanks for helping improve GeniusTasker's agent integrations. This repository
contains the CLI, local MCP server, skills and integration documentation.

## Development setup

Use Node.js 22.13 or newer and npm:

```sh
npm ci
npm run verify
```

Local tests need no GeniusTasker account. They use temporary files, synthetic
identities, loopback servers and the official MCP client SDK.

## Code conventions

- Use ECMAScript modules and explicit `node:` imports for Node built-ins.
- Format with `npm run format`; ESLint enforces recommended checks, strict
  equality, unused-variable detection and braces on control statements.
- Choose names that explain the operation. Keep parsing, authentication, HTTP
  transport, persistence and MCP presentation in their respective modules.
- Document exported entry points and invariants. Explain why a failure needs
  special treatment; comments should not repeat the next line of code.
- Inject clocks, network calls and cancellation signals where behavior needs
  deterministic tests. Avoid new global state, background daemons or polling.
- Prefer a focused helper when it clarifies responsibility. Avoid abstraction
  that hides credential ownership, lock lifetime or retry decisions.

The [architecture guide](docs/ARCHITECTURE.md) describes module responsibilities
and the authentication, write and change-feed lifecycles.

## Behavioral compatibility

CLI JSON output, exit codes, MCP tool names and command envelopes are public
interfaces. Changes must preserve existing callers or be documented as a breaking
change. Keep stdout reserved for protocol output; diagnostics belong on stderr.

Validate input at the boundary. Surface errors through `AgentError` with a stable
code and useful remediation. Never relay raw provider exceptions or credentials.
A command must preserve origin, account, profile and operation identity. An
uncertain write may only retry its saved immutable request; a revision conflict
requires rereading the resource. Access and quotas remain server-enforced.

`src/command-catalog.mjs` is a generated interface snapshot. Submit contract
updates with their generation provenance and review the client-facing diff;
do not hand-edit generated schemas. Third-party schemas also remain unchanged.

## Tests and documentation

Add regression coverage for observable changes, including relevant failures and
cancellation. Use synthetic data; live account exports do not belong in fixtures.
Read [Testing](docs/TESTING.md) for the suite boundaries and focused commands.

Update command help, examples, skills and relevant guides when behavior changes.
Examples must run against documented capabilities, with placeholders for resource
IDs and without access tokens. Keep project and Memory permissions independent.

## Pull requests

Describe the user-visible problem, the behavior after the change and the checks
performed. Keep unrelated changes separate. Run `npm run verify` and review the
archive inventory before proposing distribution changes. Security reports belong
in the repository's private reporting channel, as described in [Security](SECURITY.md).

## Licensing

Contributions to the client, skills and documentation are accepted under the
[MIT license](LICENSE). Third-party material retains its original license and
must have clear provenance and notices. See [Third-party notices](THIRD_PARTY_NOTICES.md).
