# Use Tack from Codex

The local Tack MCP server connects Codex to a Tack instance through a user-owned API key. The companion Tack skill guides board selection, card workflows, and recovery. Node.js **24.9+** is the only server runtime requirement; the release package includes the SDK and validation dependencies. Codex is the first supported client.

## Install the server

From a Tack checkout:

```sh
pnpm install --frozen-lockfile
pnpm mcp:pack
```

Transfer `artifacts/p2dev-tack-mcp-1.1.0.tgz` to the agent machine. It contains the server, skill, license, and dependency notices. Install to a directory you choose:

```sh
npm install --prefix /path/to/tack-agent --offline --ignore-scripts \
  /path/to/p2dev-tack-mcp-1.1.0.tgz
```

An empty npm cache works: the artifact has no external runtime dependencies or install scripts. This command does not publish a package or configure Codex. The executable is:

```text
/path/to/tack-agent/node_modules/@p2dev/tack-mcp/dist/tack-mcp.cjs
```

Use `node /path/to/entry.cjs --help` to inspect the commands. Installation/launch can use paths with spaces; quote shell arguments normally. Keep the installed server outside a disposable project worktree.

## Create the connection

In Tack, open **Options → API keys** and create a key named for this Codex installation. Start with read-only access and selected boards. Enable card updates, archive/restore, or transfers only when those workflows are wanted. A `projects:sync` key is for Cloud project provisioning and cannot connect to this card server.

For terminal clients, supply `TACK_BASE_URL` and `TACK_API_KEY` through the process environment. For desktop launch, an explicit private file is often more reliable than relying on shell environment inheritance. Create a file outside Git and use a private editor to enter only:

```dotenv
TACK_BASE_URL=https://tack.example.internal
TACK_API_KEY=YOUR_ONE_TIME_KEY
```

On Unix, restrict the file with `chmod 600 /private/path/tack.env`; on Windows, restrict its ACL to the intended user. Use the actual Tack origin. `http://localhost:3000` is allowed for local review; LAN addresses require HTTPS with certificate validation. The file accepts only the two connection variables and is never executed as shell code. The server never loads Tack’s application `.env` implicitly. Explicit environment values override file values, including empty values.

For a private CA, set `NODE_EXTRA_CA_CERTS` to its PEM certificate file **before Node starts**, through the client’s environment. Do not put it in the credential file or disable certificate verification. A key grants API access, not browser login.

Check the connection before registering it:

```sh
node /path/to/entry.cjs --env-file /private/path/tack.env --check
```

This only reads access and permitted boards. Success prints the origin, scopes, and board information; failure returns a nonzero exit code and a redacted diagnosis. It creates no cards. Run this as a separate command: diagnostics output does not belong in an MCP protocol session.

## Register in Codex

Use the **MCP servers** settings or the CLI. First check whether a `tack` entry already exists so you can preserve an existing connection:

```sh
codex mcp list
codex mcp add tack -- /absolute/path/to/node \
  /absolute/path/to/entry.cjs --env-file /private/path/tack.env
```

Use an absolute Node executable path for predictable desktop launches. Do not place the actual secret in CLI arguments, committed settings, or this guide. The private-file path is configuration, not the credential itself. A direct TOML equivalent is:

```toml
[mcp_servers.tack]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/entry.cjs", "--env-file", "/private/path/tack.env"]
startup_timeout_sec = 20
tool_timeout_sec = 30
```

For an environment-only connection, omit the `--env-file` arguments and forward these names:

```toml
env_vars = ["TACK_BASE_URL", "TACK_API_KEY", "NODE_EXTRA_CA_CERTS"]
```

If using a private CA with a file-based connection, forward `NODE_EXTRA_CA_CERTS` or supply that non-secret path through the client’s startup environment. Node reads it at startup. The app/CLI/IDE share MCP configuration on the same Codex host; project configuration is loaded only in trusted projects. See [official Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) for configuration locations and optional tool policies. The API scope always enforces access regardless of client approval settings.

Restart the configured server/client as needed and inspect its connection state. A visible configuration entry is not evidence that authentication succeeds.

Client approvals are separate from API capabilities. In the verified CLI, `auto`
requested approval for the archive tool because it carries a destructive hint.
An unattended run with approval policy `never` consequently stopped before the
archive reached Tack. For an operator-authorized unattended workflow, Codex
supports an explicit tool policy, for example:

```toml
[mcp_servers.tack.tools.tack_archive_card]
approval_mode = "approve"
```

Choose this deliberately for the intended workflow and use a key restricted to
the intended boards and capabilities. Keep interactive approval if preferred.
The skill reports a policy block without silently changing client settings.
See [Codex tool policies](https://learn.chatgpt.com/docs/extend/mcp).

## Install the skill

Install the bundled skill into the client’s supported skill directory. Current Codex documentation lists `~/.agents/skills` for user discovery and `.agents/skills` for repository discovery:

```sh
node /path/to/entry.cjs --install-skill "$HOME/.agents/skills/tack"
```

The command refuses an existing destination. Review an existing skill before updating it; do not overwrite unrelated instructions. Start a new Codex session and verify Tack appears in skill discovery. If your supported client uses a different configured discovery location, supply that directory instead. [Official skill discovery guidance](https://developers.openai.com/codex/skills).

Example prompts:

- “Use $tack to summarize active work on ENG.”
- “Use $tack to create a Backlog card on ENG titled Improve setup documentation.”
- “Use $tack to update ENG-42 with these acceptance notes.”
- “Use $tack to move ENG-42 to Ready.”
- “Use $tack to transfer ENG-42 to OPS and return its new link.”

Read-only prompts work with a read-only key; writes need the relevant selected capabilities. The skill is usable automatically for matching Tack requests as well as explicitly. It never grants permission by itself.

## Results, recovery, and rotation

The existing 11 tool names and input fields are unchanged. Card/list fields remain available in the text JSON and `structuredContent`. `_transport` includes:

| Field | Meaning |
| --- | --- |
| `httpStatus` | HTTP code, separate from a card’s workflow `status`; null before a response |
| `operationId` | The write’s caller-supplied `requestId`, retained for retries |
| `serverRequestId` | HTTP `X-Request-Id` for operational diagnosis |
| `replayed` | Whether Tack returned a saved idempotent result |
| `retryAfterSeconds` | Retry delay from seconds or an HTTP-date; null when absent |
| `outcome` | `confirmed` for parsed responses below HTTP 500; `unconfirmed` for uncertain transport/response failures or 5xx |

`confirmed` does not mean successful: `isError` and the error code still matter. A parsed permission/conflict denial is confirmed as a denial. A 5xx or lost response can follow a committed write. Retry uncertain writes with identical arguments and the same operation ID within 24 hours; inspect the card before retrying after that window. Revision conflicts require a new read and reconsideration, not blind replacement. The [API reference](README.md) and [skill recovery reference](../../skills/tack/references/recovery.md) contain the details.

Rotate through Tack: create a replacement with the intended scopes/boards, update the private file or process environment, restart the MCP server, run the read-only check, then revoke the old key. The adapter reads credentials once at startup. Confirm the old credential is rejected and the replacement works. Changing expiry/scopes requires a replacement key, not editing the credential record. Revocation cannot undo previously committed work.

## Updates and acceptance

Install a reviewed newer package to the chosen directory; restart the MCP server and rerun `--check`. Update the skill deliberately after reviewing the packaged instructions. Keep one connection entry per intended Tack instance and avoid duplicate installations of the same skill.

For acceptance, use a disposable board with a scoped key: discover tools, summarize, create, replay a creation without duplication, edit alongside a simulated competing edit, move, transfer, resolve the old key, archive/restore, rotate, and revoke. Verify the resulting card in Tack. Check permission denial with a read-only/restricted key and make sure instruction-like card text does not alter the agent’s task.

A real LAN deployment additionally requires a separate-machine check using the intended DNS and trusted certificate. A local protocol test or skill installation does not prove that connectivity. See [delivery evidence](MCP_SKILL_DELIVERY.md) for actual verified client/platform scope and remaining acceptance.
