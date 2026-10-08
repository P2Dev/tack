# Security

## Report a vulnerability privately

Use [GitHub’s private vulnerability reporting](https://github.com/P2Dev/tack/security/advisories/new)
for this repository. Include reproduction steps, affected commit/configuration,
and the impact. Do not publish usable keys, passwords, team data, or an exploit
containing those values in a public issue. There is no guaranteed response SLA.

## Supported boundary

Report against the current `main` branch. Tack is a self-hosted single shared
workspace: all active human members can access all boards. Board restrictions
apply to delegated API keys, not separate human board memberships.

Deploy non-local access over HTTPS, retain a local recovery administrator, and
restrict database/network access. Keep secrets and backups private. Configure
provider provisioning deliberately; allowing sign-up admits verified members
accepted by that provider to the shared workspace.

API keys are hashed, expire, and belong to active accounts. They authorize only
the versioned agent API; they cannot manage accounts, mint keys, or export the
workspace. The local MCP adapter uses an environment key and a fixed HTTPS origin.
See [configuration](docs/CONFIGURATION.md), [operations](docs/DEPLOYMENT.md), and
[agent access](docs/agent-access/README.md).
