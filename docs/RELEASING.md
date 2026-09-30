# Release process

1. Update package, lockfile, MCP server version, plugin version and example pins together.
2. Review public contract/skill changes and run `npm ci`, `npm run verify` and `npm audit`.
3. Inspect `git diff` and the complete `npm pack --dry-run --json` list. No private repository history or product files may enter this repo.
4. Pack and inspect the actual archive. `npm publish <archive> --access public --tag beta` requires the maintainer's npm authentication.
5. Confirm registry version/tag/integrity, install using a fresh cache and exercise real MCP through an explicitly authorized beta account. Keep private results outside this repository.
6. Tag the corresponding commit and publish accurate release notes. Record host-specific acceptance separately.

CI runs tests and package/privacy checks. It never publishes npm or deploys the
service. Future trusted publishing should use a reviewed OIDC setup rather than
committing an npm token; it is not configured by this repository.

Published npm versions are immutable. Use a new version for package changes.

Canonical repository: https://github.com/PulsarInteractive/geniustasker-agent-tools
