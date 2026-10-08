# Tack Architecture

Updated: 2026-10-04

## System shape

Tack is one Next.js App Router application and one PostgreSQL database:

```text
Browser
  ├─ private sign-in
  ├─ server-rendered board snapshot
  ├─ optimistic local interactions
  └─ focus/interval refresh
         ↓
Next.js pages and route handlers
  ├─ Better Auth sessions
  ├─ page/API authorization
  └─ narrow issue/label mutations
         ↓
IssueStore + node-postgres
         ↓
PostgreSQL
```

The app remains one service with PostgreSQL. Optional configured OIDC providers (including Cognito User Pools) supplement local authentication. There is no separate API service, worker, cache, queue, WebSocket subsystem, or object storage.

## Runtime boundaries

- `src/app/page.tsx` requires a session and reads the initial board snapshot.
- `src/components/board.tsx` owns DnD, drawers, filters, optimistic updates,
  rollback, freshness, and Undo.
- `src/app/api/issues/**` requires any authenticated account.
- `src/app/api/labels/**` requires an administrator.
- `src/app/api/boards/**` allows authenticated listing and administrator creation/removal.
- Issue snapshots and ordering are scoped by board ID; members can transfer active or archived cards across boards.
- `src/app/api/export` gives administrators JSON or CSV data-portability
  downloads.
- `src/app/api/auth/[...all]` exposes Better Auth's maintained session and
  administrator endpoints.
- `src/app/team/page.tsx` and `src/components/team-manager.tsx` provide the
  deliberately small account-administration surface.
- `src/lib/auth-providers.ts` validates server-side provider configuration and trusted UserInfo.
- `src/lib/auth.ts` defines local and optional OIDC authentication, database sessions,
  the admin plugin, and Tack's extra user presentation fields.
- `src/lib/auth-guards.ts` performs page and request authorization close to the
  data access boundary.
- `src/lib/issue-store.ts` owns issue invariants and PostgreSQL transactions.
- `src/lib/database.ts` owns the connection pool, transaction helper, advisory
  migration lock, and ordered migrations.
- `migrations/postgres/` is the deployed schema source of truth.

The root `migrations/001_initial.sql` and `002_team_context.sql` files are
retained only as the historical SQLite prototype schema. They are not applied
by the current runtime.

## Agent access

`/settings/api-keys` and `/api/keys/**` require a browser session and current active account. Users own their key metadata; administrators may review metadata and revoke keys across users. Better Auth's API-key plugin is pinned to 1.6.25 with hash-only storage and browser-session emulation disabled. Its HTTP management endpoints are disabled; Tack's handlers validate origin, scopes, boards and expiry.

`/api/v1/**` requires a Bearer API key, never a cookie fallback. It verifies once, then rechecks current owner eligibility and scopes inside the operation transaction. Existing browser and account APIs reject Authorization headers. No key authorizes account, board, label administration or workspace export.

`agent-service.ts` wraps shared `IssueStore` operations in one transaction, reusing the store's global ordering lock. Every card update advances a database revision, including browser writes. Agent edits check the revision under lock. Every agent mutation also writes a 24-hour idempotency record atomically; retries check current board access before returning cached data. Credential metadata is locked while operations run so revocation cannot interleave halfway through an authorized transaction. Reads and mutation results remove private assignee fields and unauthorized former-board aliases.

The optional `tools/tack-mcp.ts` runs locally over stdio using the pinned official SDK 1.32.0. It uses a fixed origin and environment key to call the agent API; it has no database access and opens no MCP network listener. See [agent access](docs/agent-access/README.md) for the endpoint/tool contract, rate limits, cache/audit behavior, and LAN trust setup.

## Responsive board interaction

The board uses four columns at 1180 CSS pixels and above. Below that width,
explicit status buttons select one column; a filter signature scopes that choice.
A new filter view may initially select a matching column, while the user's
subsequent choice is honored even when its result count is zero. Changes to the
shared snapshot do not override an explicit choice for the current filter view.

Quick capture precedes each column's list. Creation and the C/New card shortcut
retain the view's filters. If the newest created card is hidden by those filters,
a persistent notice identifies its destination and offers Show card, Clear
filters, and dismiss. Showing the card preserves the filter URL. Clearing filters
from this notice also selects the destination column.

Phone filter controls are disclosed on demand, with active values visible as
removable chips. Archive, Team, label administration, and sign-out live in a
native details disclosure. Drawer focus returns to its originating control, or
the visible Board options summary when the card has no visible trigger.

## Shared freshness and recovery

The shared refresh state, pending-write count, and expired-session flag are
independent. Completing a mutation cannot mark a failed shared refresh healthy.
A successful applied shared read records its checked-at time; refresh requests
are single-flight and still honor mutation-version and open-panel guards. Drawers
explicitly explain their paused shared updates.

Move failures restore the serialized operation's prior local snapshot and column,
then retain an explicit retry/check/dismiss action. These are acknowledgements and
local recovery controls, not an exactly-once protocol. Capture failures keep the
title and expose Check board before a deliberate resubmission. New-card creation
is never automatically retried after an uncertain response.

`SessionRecovery` opens a validated local sign-in destination in another tab.
Quick capture, labels, and Team forms stay mounted in the original tab. The user
returns and retries; passwords are not persisted to browser storage. Issue draft
recovery continues to use the separate U1 hook and its same-tab return path.

Team feedback is keyed to its account or create form. One action runs at a time;
controls remain disabled during the subsequent server refresh. Password Cancel
removes that form and restores trigger focus. Label deletion has an inline,
explicit consequence/Cancel step, and pending label operations guard closing.
Archive failures and success actions live outside the scrolling list or note.
Board failure notices remain available after leaving a panel, while the panel
owns visible recovery during the modal interaction.

## Identity and authorization

Better Auth 1.6 owns four tables: `"user"`, `session`, `account`, and
`verification`. The admin plugin extends users with role/ban fields and
sessions with impersonation metadata. Tack extends users with `initials` and
one restrained avatar `color`.

OIDC authorization-code sign-in uses PKCE and verified UserInfo. Local authentication remains available. New provider users are denied by default; configured provisioning creates members. Provider identity does not grant an administrator role. See [authentication setup](docs/AUTHENTICATION.md) for configuration, pinned-version callback paths, and the live-provider verification boundary.

The product exposes two roles:

- `admin` — normal board access plus account and label management
- `member` — normal board access

Better Auth's internal non-admin role is named `user`; Tack maps it to
`member` at the UI/domain boundary. Public sign-up is disabled. The bootstrap
script temporarily enables server-side sign-up only inside its own process,
then marks the configured account as an administrator.

Authorization is not inferred from client controls. Protected server pages
redirect unauthenticated users, issue APIs return `401`, label APIs return
`401` or `403`, the export API returns `401` or `403`, and Better Auth enforces
its own administrator endpoints.

Passwords are hashed by Better Auth's maintained scrypt implementation.
Sessions are database-backed and use secure HTTP-only cookie behavior supplied
by Better Auth.

## Data portability

The administrator-only export boundary reads the same `IssueStore` snapshot as
the board plus disabled account profiles needed to resolve historical
assignees. The version-2 JSON form contains users, labels, all boards (including removed/reserved IDs), per-board number counters, and every active or archived issue with stable IDs, current keys, former-key aliases, and relationships. It is the lossless portable
snapshot.

The CSV form emits one row per issue and resolves assignee and label names for
inspection in a spreadsheet. Every cell is quoted and user-entered values that
could be interpreted as formulas are prefixed with an apostrophe.

Neither format reads or serializes Better Auth's `account`, `session`, or
`verification` records. Export responses are marked `no-store` and `nosniff`.

## Data model

```text
user
  id, name, email, emailVerified, image
  role, banned, banReason, banExpires
  initials, color, createdAt, updatedAt

session
  id, token, userId, expiresAt
  ipAddress, userAgent, impersonatedBy, createdAt, updatedAt

account
  credential provider record and password hash

verification
  expiring verification values used by the auth library

issues
  id              random internal UUID
  board_id        immutable short board ID, foreign key to boards
  public_number   monotonic number within this board
  title           required, trimmed, 1–180 characters
  description     optional Markdown, up to 20,000 characters
  status          backlog | ready | in_progress | done
  position        zero-based integer within an active status
  created_at
  updated_at
  archived_at     null while active
  assignee_id     nullable user reference

labels
  id
  name            unique, case-insensitive, 1–24 characters
  color           one of six restrained workspace colors
  created_at

issue_labels
  primary key     (issue_id, label_id)
```

`boards` stores immutable short IDs, display names, next issue numbers, and removal timestamps. `issue_keys` maps every allocated public key to its stable issue ID. Removed board IDs remain reserved. `app_meta` retains the historical single-board counter; new allocation uses `boards`. `schema_migrations` records applied PostgreSQL migrations.

## Persistence invariants

- Each board allocates `BOARD-N` numbers that are never reused. Transfers allocate a new destination key; all old keys remain resolvable aliases.
- Existing TCK data migrates without renumbering; only empty boards can be removed, and at least one board must remain.
- Validation and database constraints both require a nonblank title and valid
  status.
- Active positions are contiguous and zero-based within each board/status.
- Create, move, archive, and restore acquire one transaction-scoped advisory
  lock for board ordering.
- Each transaction uses one checked-out PostgreSQL client for
  `BEGIN`/`COMMIT`/`ROLLBACK`.
- A cross-column move closes the source gap and opens the target position.
- Archive preserves the last position for a best-effort restore.
- Normal UI actions never permanently delete issues.
- Issue patches modify only fields present in the request.
- Assignee and label references are validated before commit.
- Disabled users remain hydratable on historical cards but are not offered for
  new assignments.
- Removing a label cascades only through `issue_labels`.

The ordering algorithm is O(n) within a board/status. The existing global transactional ordering lock also serializes board creation/removal and cross-board transfers.

## Client interaction model

- The server provides active issues, archived issues, active members, and
  labels in one initial snapshot.
- Create waits for its assigned public key before inserting the card.
- Text/metadata edits and moves update local state optimistically. Archive and
  restore wait for confirmation so their recovery context remains available.
- A browser-local promise queue serializes board writes and synchronously updates
  the snapshot reference before the next operation. This prevents one local
  snapshot rollback from overwriting another in-flight local operation. It is not
  a distributed queue or cross-user same-field conflict mechanism.
- Failed field patches roll back only the requested fields. Failed moves restore
  the snapshot captured when that serialized operation starts; archive/restore
  failures retain their unchanged collection and visible recovery context.
- Board state lives in `?board=ENG`, card state in `issue=ENG-N`; filters live in `q`, `assignee`, and `label`. Historical issue links resolve before the board snapshot is selected.
- `use-issue-draft.ts` owns title/description drafts. Saves start after a 700 ms
  pause; a single in-flight writer drains newer edits before confirming Saved.
  Close, Archive, movement, and metadata operations flush text first.
- Drawers use native modal dialogs with explicit focus wrapping. The covered
  board is inert; users close/save or explicitly discard before switching cards.
- Unsaved text is retained in session storage per account/card for recovery in
  the same tab, with a 24-hour validity limit, and cleared on save/discard. A
  recovered draft requires review before saving. Storage failure keeps the
  editor open and explains the manual-copy fallback. This is not offline sync.
- Shared destinations pass through sign-in using an allowlisted local return
  path. Missing card links produce an actionable drawer while retaining filters.
- The editor distinguishes locally touched fields from server-refreshed fields.
- The board refreshes every 12 seconds and on focus, pausing during drawers,
  drag, or active mutations.

## Deployment

```text
Host reverse proxy / TLS
          ↓
Docker Compose
  ├─ Tack application
  │    migrate → bootstrap admin → start
  └─ PostgreSQL 18
       └─ named persistent volume
```

Compose waits for PostgreSQL's health check before starting Tack. Both services
restart unless stopped. The application exposes `/api/health`, which checks a
real database query. PostgreSQL is bound to host loopback; the application port
is available to a host reverse proxy.

The migration runner serializes competing starts with a PostgreSQL advisory
lock. The first shared release targets one application replica.

Backups use `pg_dump --format=custom`; restore uses `pg_restore` after replacing
the configured database. Both commands run the PostgreSQL tools from the
database container so host tool versions cannot drift from the server.

## Accessibility and visual model

The board retains banner, main, region, heading, form-control, dialog, and
status semantics. DnD has pointer, touch, and keyboard sensors, while every
card also exposes a native status selector and explicit reorder buttons.
Focus, live announcements, reduced motion, forced colors, and mobile
single-column behavior remain part of the global design contract.

The visual thesis is a calm worktable: warm neutral canvas, off-white working
surfaces, serif display type, sans-serif controls, monospaced keys, and
restrained status colors. Account administration uses the same visual language
and stays secondary to the board.

Automated checks reduce common accessibility defects but do not establish full
WCAG conformance.
