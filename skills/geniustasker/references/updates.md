# CLI updates

Use `geniustasker update check --json` when checking package freshness. It reads
the official npm registry anonymously and does not read an account or consume its
API quota. The installed release selects beta or stable automatically; use
`--channel beta` or `--channel stable` only when that channel change is intended.
An older registry version is not a downgrade instruction.

When the user has requested an update, stop the local MCP server and let active
CLI commands finish, then run `geniustasker update install --json` in a terminal.
It updates only the current global npm installation. If the host uses an npx
version pin, a project dependency, a source checkout or another package manager,
update that installation through its own workflow instead; do not replace an
unrelated global package or change the host configuration without authorization.
Restart the MCP host after installation. This is not a hosted connector update.

The updater preserves credentials and immutable journals. An uncertain operation
stays uncertain: inspect it and retry the same operation only when the underlying
task calls for it. Do not reset authentication, remove journals or automatically
retry domain commands because a package was updated.

`update_runtime_busy` means another CLI/MCP process or an installer still owns
the installation. Wait or close it; never kill another task to install an update.
A crashed installer may leave an `install.lock` directory. Recover it only after
confirming that the installer and all clients have stopped, using the procedure
in [CLI updates](../../../docs/CLI.md#updates). `update_install_unconfirmed` needs
inspection of the installed version before retrying; it is not a success receipt.

Automatic discovery never runs from MCP or JSON calls. For terminal sessions,
`GENIUSTASKER_NO_UPDATE_CHECK=1` disables it. A registry outage must not interrupt
the user's actual work or trigger repeated checks.
