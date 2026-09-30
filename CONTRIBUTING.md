# Contributing

Use Node.js 22.13+ and `npm ci`. Run `npm test` and `npm run check` before a change.
Tests run with synthetic data. Never add real account records or credentials.

Keep authentication, scope boundaries, immutable journals, bounded reads and
structured errors intact. Feature availability comes from live capabilities;
no CLI command may bypass service admission or permissions.

`src/command-catalog.mjs` is a reviewed public contract snapshot. It is generated
upstream, not hand edited here. Contract changes arrive as a bounded client-facing
snapshot; no private backend, configuration or internal generator belongs in this
repository. Runtime, packaging and skill changes are maintained here.

Do not add install/postinstall hooks, credential collection, telemetry, background
polling or automatic public publishing as part of an unrelated contribution.
See [Releasing](docs/RELEASING.md) for the explicit release workflow.
