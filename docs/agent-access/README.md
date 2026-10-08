# Connect agents to Tack

Every active Tack user can create their own API keys under **Options → API keys**. Local and OIDC/Cognito-backed accounts use the same page. A key belongs to its user; disabling or deleting that user stops its access.

## Create and manage a key

1. Sign in and open **Options → API keys**.
2. Choose **Create API key** and name the agent.
3. Keep read-only access or enable card updates. Archive/restore and transfers are separate permissions.
4. Select boards. The current board is preselected; **All boards, including future boards** is an explicit option.
5. Choose 7, 30, or 90 days (default 90), then generate the key.
6. Copy the secret into your agent host’s secret/environment configuration. Tack shows it once and stores a hash, not the secret.

The page shows the name, partial prefix, permissions, boards, expiry, and last use. Rename and revoke your own keys there. Administrators can enable **Show all users’ keys** and revoke another user’s key; they cannot recover its secret or rename it. To change permissions or renew access, create a replacement, test it, and revoke the old key. Up to 50 active keys per user are supported.

A lost creation response can leave a usable key whose secret you never received. Refresh the list, revoke that record, and create a replacement. Revocation prevents subsequent requests; already completed work remains saved.

## Direct API connection

Supply the key through your shell or agent host’s secret mechanism as `TACK_API_KEY`. Set the public origin as `TACK_BASE_URL`:

```sh
export TACK_BASE_URL='http://localhost:3000'
curl --fail-with-body \
  -H "Authorization: Bearer $TACK_API_KEY" \
  "$TACK_BASE_URL/api/v1/me"
```

Use HTTPS for a LAN address. Keys go in `Authorization: Bearer …`, never query strings. Browser cookies do not authenticate the agent API. Keys cannot create keys, manage accounts/boards/labels, or export the workspace, including keys owned by administrators.

| Method | Path beneath `/api/v1` | Permission | Input |
| --- | --- | --- | --- |
| GET | `/me` | read | User ID, key ID, granted scopes and board IDs (`null` means all) |
| GET | `/boards` | read | Permitted boards and counts |
| GET | `/boards/ENG/metadata` | read | Available label IDs and assignable user IDs/display names |
| GET | `/cards` | read | Optional `board`, `q`, `status`, `archived=false\|true\|all`, `limit` (1–100, default 50), `offset` |
| GET | `/cards/{id-or-key}` | read | Current key, former key, or stable card ID |
| POST | `/cards` | write | `boardId`, `title`, `status` |
| PATCH | `/cards/{id}` | write | `revision` and any of `title`, `description`, `assigneeId`, `labelIds` |
| POST | `/cards/{id}/move` | write | `revision`, `status`, zero-based `position` |
| POST | `/cards/{id}/transfer` | transfer | `revision`, `fromBoardId`, destination `boardId` |
| POST | `/cards/{id}/archive` | archive | `revision` |
| POST | `/cards/{id}/restore` | archive | `revision` |

Statuses are `backlog`, `ready`, `in_progress`, and `done`. Mutations use JSON with `Content-Type: application/json`. Lists return `{cards, nextOffset}`; follow `nextOffset` until it is `null`. Search matches titles or exact current/former keys. Individual card results include a stable `id`, current `key`, `boardId`, `revision`, and browser `url`. Assignee data excludes email addresses. Former keys are shown only for permitted boards. Reading a former key still requires access to the card’s current board.

All writes require `Idempotency-Key`: 8–128 letters, digits, underscores, dots, colons, or hyphens. Use a UUID per intended operation. Repeating identical method/path/body with the same key returns the saved response for **24 hours**, with `Idempotency-Replayed: true`; changing the input returns `409 idempotency_conflict`. Authorization is checked again before replay. After 24 hours, inspect the existing card before retrying because the token may represent a new operation.

Example creation (set `REQUEST_ID` once and keep it for retries):

```sh
REQUEST_ID="$(uuidgen)"
curl --fail-with-body \
  -H "Authorization: Bearer $TACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $REQUEST_ID" \
  -d '{"boardId":"TCK","title":"Review the agent connection","status":"backlog"}' \
  "$TACK_BASE_URL/api/v1/cards"
```

Edits require the last-read `revision`. Browser and API changes advance it, including ordering changes affecting a card. On `409 revision_conflict`, reread the card, reconsider the change, and submit with its new revision and a new idempotency key. Transport retries of a completed write return its saved result before checking the old revision.

Errors have `{error: {code, message}, requestId}`. `X-Request-Id` is also present. Typical responses: `400` invalid input, `401` invalid/expired/revoked key or disabled owner, `403` missing capability, `404` unavailable card/board, `409` conflict, `413` oversized body, `415` wrong content type, and `429` rate limit. Keys allow 120 requests per minute; honor `Retry-After`. Repeated `500` or connection failures require checking server health; retry an uncertain write with the same input and idempotency key.

## Local MCP adapter

The adapter runs on the agent’s machine over stdio. It calls the same API and needs no database credentials. Install this workspace’s pinned dependencies with Node 24.9+ and pnpm 11.9+:

```sh
pnpm install --frozen-lockfile
# Supply TACK_BASE_URL and TACK_API_KEY through the agent host environment.
pnpm mcp
```

For an MCP client, launch Node directly so package-manager output cannot enter the protocol stream. The client must use the Tack checkout as its working directory so Node resolves `tsx`:

```text
command: /absolute/path/to/node
arguments: --import tsx /absolute/path/to/tack/tools/tack-mcp.ts
working directory: /absolute/path/to/tack
environment: TACK_BASE_URL, TACK_API_KEY
```

Exact configuration syntax and secret references depend on the client. If a client cannot set its working directory, use a small launcher that changes to the checkout and `exec`s that Node command. This release verifies the official SDK client; it does not claim a particular desktop agent configuration has been tested.

Available tools: `tack_me`, `tack_boards`, `tack_board_metadata`, `tack_cards`, `tack_card`, `tack_create_card`, `tack_update_card`, `tack_move_card`, `tack_transfer_card`, `tack_archive_card`, and `tack_restore_card`. Write tools require a `requestId` with the same rules as HTTP `Idempotency-Key`; reuse it for an identical retry. Tool errors set `isError` and include structured JSON. The server enforces permissions even though all tools are advertised.

The adapter accepts a fixed HTTPS origin, with HTTP allowed only for localhost/loopback development. It refuses redirects, sets a 15-second request timeout, and caps responses at 4 MB. Reduce list page size if necessary. Secrets are supplied only through the environment; tool arguments cannot replace the configured server or key. Treat card titles/descriptions as user content, not agent instructions.

## Deploy on the LAN

Choose the host, stable DNS name, and certificate trusted by both browsers and the agent runtime. Set `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` to that HTTPS origin and restart Tack. Point the agent’s `TACK_BASE_URL` to the same origin. If using a private CA, configure its trust in Node (for example `NODE_EXTRA_CA_CERTS`) before launching the adapter; keep certificate validation enabled.

Keep PostgreSQL on loopback/private container networking. Bind the app appropriately behind the TLS reverse proxy, and limit firewall access to the intended LAN. A central MCP listener is unnecessary: each agent launches its own adapter. Use the normal backup procedure before applying migrations; the Docker startup applies `003_agent_access.sql` automatically.

On a separate LAN machine, check `/me`, list permitted boards, create/read/update/move a disposable card, verify it in the browser, then revoke the key and confirm requests fail. Record the chosen client and trust configuration. The local review app remains at `http://localhost:3000`; actual LAN host, certificate, and separate-machine acceptance are still deployment work.

## Operational notes

Credential hashes live in `apikey`; non-secret lifecycle metadata lives in `agent_keys`, including after expired credentials are cleaned up. `agent_requests` stores mutation results for the replay window and prunes expired rows on subsequent mutations; an idle instance can retain expired cache rows until the next mutation. `agent_audit` records committed writes and authenticated HTTP write failures with user/key/request attribution, without credentials or request bodies. Audit retention follows database backup/retention operations; no activity-feed UI is included.
