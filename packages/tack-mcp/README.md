# Tack MCP

A self-contained local stdio server for Tack, with the Tack workflow skill for Codex. Node.js 24.9+ is the only runtime dependency. The built package includes its MCP SDK/validation dependencies and third-party notices; it needs no Tack checkout, app build, or database access.

Build/package from the Tack repository with `pnpm mcp:pack`. Install the resulting tarball into a chosen directory using `npm install --prefix /path/to/tack-agent --offline --ignore-scripts /path/to/p2dev-tack-mcp-1.1.0.tgz`. Nothing is published to npm by these commands.

The entry is `/path/to/tack-agent/node_modules/@p2dev/tack-mcp/dist/tack-mcp.cjs`.

```sh
node /path/to/entry.cjs --help
node /path/to/entry.cjs --env-file /private/path/tack.env --check
node /path/to/entry.cjs --install-skill /path/to/.agents/skills/tack
```

The private file may contain only `TACK_BASE_URL` and `TACK_API_KEY`. Create it with private permissions (Unix: `chmod 600`). Explicit environment values override the file, and no `.env` is loaded automatically. Supply `NODE_EXTRA_CA_CERTS` before launching Node when the Tack origin uses a private CA. HTTP is allowed only for loopback development.

Run without `--check` to serve MCP; stdout then contains protocol messages only. Diagnostics are a separate read-only mode. `--install-skill` refuses an existing destination.

See the maintained [Codex setup guide](https://github.com/P2Dev/tack/blob/main/docs/agent-access/CODEX.md) for configuration, key permissions, rotation, and acceptance steps. All 11 existing tools keep their names/inputs; results add `_transport` metadata and `structuredContent`. Key secrets never belong in tool arguments or committed settings.
