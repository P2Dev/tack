# Tack MCP package and Codex skill delivery

October 11, 2026

## Delivered

The local stdio MCP server is now an installable, self-contained Node package, `@p2dev/tack-mcp` 1.1.0. The package contains the executable, Tack workflow skill, MIT license, and bundled dependency notices. It needs Node 24.9+ and a user-owned Tack API key; it needs no Tack checkout, application dependencies, database, or install-time network access.

The existing 11 tool names and input contracts are preserved. `pnpm mcp` remains a compatibility launch command using the same implementation. Transport metadata separates HTTP codes, operation IDs, server request IDs, replay indicators, retry delays, and uncertain outcomes from card data. Initialization instructions and the companion skill cover board selection, pagination, stable IDs, revisions, idempotent retries, transfer aliases, and bounded recovery.

The executable supports an explicit private credential file, a read-only `--check`, and a non-overwriting `--install-skill`. It never automatically loads Tack's application `.env`; environment values override file values. Credential files are parsed as data and restricted to the two connection variables. HTTPS is required beyond loopback, redirects are rejected, and certificate verification cannot be disabled. Credentials are not printed in startup or response errors.

## Install and use

Follow the [Codex guide](CODEX.md). Build with `pnpm mcp:pack`; transfer `artifacts/p2dev-tack-mcp-1.1.0.tgz` to the agent host. Successful CI verification also uploads the package as `tack-mcp-package`. No npm registry or marketplace publication was performed.

Install the package, create a named user API key with the intended boards/capabilities, supply it privately, run the read-only check, register one MCP connection, and install the bundled skill. Start a fresh client session. A read-only key is appropriate for board summaries; requested mutations require the corresponding capabilities.

## Verification

All writes used disposable synthetic schemas in a dedicated PostgreSQL container. The ordinary review copy and its cards were not modified.

| Check | Evidence |
| --- | --- |
| Artifact portability | Offline installation with an empty npm cache, no runtime dependency downloads, paths containing spaces, launch from an unrelated directory, discovery of all 11 tools, and protocol round trip |
| Configuration and results | Six focused Node tests covering explicit-file loading, precedence, private mode, secure origins, redaction, retry/replay metadata, distinct IDs, response limits, and uncertainty |
| API and persistence | 98 integration tests passed on the current branch, including existing authorization, revisions, idempotency, board restrictions, key lifecycle, and Cloud projection tests |
| Browser and built MCP artifact | Five focused checks passed; one intentional duplicate viewport case skipped. Real SDK calls verified card creation/replay, editing, stale revision denial, status movement, archive/restore, transfer/new key, old-key lookup, revocation, and browser visibility |
| Code and application | Typecheck, lint, and the production application build passed |
| Skill format | Codex skill validator passed; metadata includes explicit `$tack` usage |

## Actual Codex client acceptance

Verified on macOS with Node 24.18.0 and Codex CLI **0.162.0-alpha.17.2**, using
an offline-installed artifact and the bundled skill in a temporary workspace
whose path contained spaces. Each run used isolated MCP configuration; existing
user configuration was not overwritten. The skill was actually read and tools
were called by Codex, rather than by the SDK test alone.

- A read-only board summary left the active-card snapshot unchanged and ignored
  instruction-like text embedded in a synthetic card.
- Creation, description editing, status movement, and transfer produced one
  Ready card on the destination board. Its old key resolved to the stable ID.
- A proxy dropped a creation response after Tack committed it. Codex retried
  identical arguments with the same operation ID; Tack returned a replay and
  only one card existed.
- A simulated human changed the title before Codex's description update.
  Codex received a revision conflict, reread, used a new operation ID/current
  revision, and preserved the human title.
- Requested archive/restore affected only the synthetic target card. The
  default `auto` policy blocked unattended archive before it reached Tack;
  subsequent lifecycle acceptance used an explicit archive-tool `approve`
  policy and a dedicated board-scoped fixture key. The skill reported the block
  accurately instead of claiming success or silently changing configuration.

- With a replacement read-only key, Codex summarized the board and reported that
  creation was unavailable without attempting a write. After revocation, it
  received invalid-credential denials and did not attempt a card listing or
  reveal credentials.

The [redacted acceptance trace](codex-acceptance.json) records the six actual
client scenarios, tool outcomes, operation IDs, and the observed policy block.
Credentials and private installation paths are excluded.

The new Codex guide is included in the generated project-site navigation and
search. Sixteen route/width axe checks, page overflow, search/navigation,
keyboard/mobile menu, enlarged-text reflow, and page-error checks passed. These
are functional/expert checks, not representative-user research or a
screen-reader conformance claim.

## Scope and remaining deployment acceptance

This delivery provides a local stdio server and a portable skill. It does not create a central HTTP MCP service or use the separate Cloud project-sync credential. The existing Tack API remains the authorization and transaction boundary; no database migration was needed.

## Persistent local review installation

The user selected `http://localhost:3000`. Installed the offline package at
`~/.local/share/tack-agent`, the user skill at `~/.agents/skills/tack`, and a
private credential file at `~/.config/tack/local-review.env` (mode 600).
The dedicated **Codex local review** key grants only `read` for the current
TCK/TST boards and expires January 9, 2027. Its secret is outside Git and was
never printed. It can be inspected/revoked through Tack's API keys page.

Registered `tack` in the shared Codex user configuration using absolute Node and
installed executable paths. Every unrelated configuration field was compared
and preserved. A fresh actual CLI session loaded the user skill and persisted
connection, authenticated with exactly the read scope, and reported 5 active
cards on TCK and 2 on TST. Independent paginated active/archive card snapshots
before/after matched. Only the requested key-management records were added.

Desktop visual inspection is unavailable because the computer-use tool blocks
access to the Codex app. The configuration is installed and verified through
the CLI; desktop UI refresh/discovery was not observed. Start a fresh Codex chat,
and restart the app if Tack is not yet listed. Try “Use $tack to summarize TCK.”

A separate-machine LAN acceptance run must verify the actual DNS name, HTTPS
certificate trust, permissions, and client connection. Loopback tests do not
establish those deployment properties. Other MCP clients can use the protocol,
but only the verified client/platform is claimed here. No further work is
required for the requested persistent local connection installation.
