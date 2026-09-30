# Testing

## Run the quality checks

```sh
npm ci
npm run verify
```

`verify` runs formatting, ESLint, tests, package inventory, public-file checks and
plugin/schema validation. CI runs the same command on Linux and macOS with Node
22, followed by a dependency vulnerability audit. It has read-only repository
permissions and no live service credentials.

## Focused checks

```sh
npm run format:check
npm run lint
node --test test/login.test.mjs
node --test test/process.test.mjs
npm run check
npm audit
```

`npm run format` applies formatting. The generated command catalog and vendored
schemas are excluded from formatting so their provenance remains stable.

## What the suites cover

| Suite           | Observable guarantees                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Login           | Consent URL validation, PKCE state/callback handling, denial, cancellation, device-flow deadlines and slow-down |
| Client/store    | Private file checks, origin binding, serialized renewal and uncertain-token recovery                            |
| Commands        | Immutable requests, concurrent writes, identity binding, uncertain receipts and conflicts                       |
| Profiles        | Grant validation, narrowed selection, revision conflicts and rotation uncertainty                               |
| Changes         | Cursor validation, bounded waits, cancellation and no blind retries after quota or permission failures          |
| Process         | Real stdio MCP discovery/calls and coordination between separate OS processes                                   |
| Public boundary | Rejection of excluded files, credentials, symlinks and escaping imports                                         |

Tests create and clean up their own temporary directories and loopback servers.
They do not require browser sign-in or real project data. Use meaningful scenario
names, assert behavior at public boundaries and include the failure that motivates
a regression test. Avoid sleeps as synchronization when an explicit signal works.

## What local tests do not establish

They do not prove admission to the hosted beta, production availability, browser
provider compatibility on every device or acceptance by each agent host. Release
verification separately installs the published archive with a fresh cache,
compares registry integrity and exercises a deliberately authorized test account.
Record those checks without publishing account data.
