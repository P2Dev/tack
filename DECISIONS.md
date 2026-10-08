# Tack Decisions

Date: 2026-07-27

## D-001 — Self-host with Docker Compose

Status: Accepted

The shared pilot will run on team-controlled infrastructure using Docker Compose.
The minimum production topology is:

```text
reverse proxy / TLS
        ↓
Tack application container
        ↓
PostgreSQL container
        ↓
persistent database volume
```

The application and database must have health checks, restart policies, explicit
environment configuration, and documented backup/restore commands. The reverse
proxy may be supplied by the host and does not need to be bundled with Tack.

## D-002 — Use PostgreSQL for the shared deployment

Status: Accepted

PostgreSQL is the selected standard database for Milestone 3. MariaDB and MySQL
would also satisfy the broad hosting constraint, but supporting multiple SQL
dialects would add work without helping the first team.

The current application store and deployed migrations use PostgreSQL. The
SQLite schema remains in the repository only as prototype history. A
SQLite-to-PostgreSQL importer is intentionally deferred until prototype import
is confirmed.

## D-003 — Keep identity local and small

Status: Accepted and implemented

The pilot does not require SSO, OAuth, magic-link email delivery, or an external
identity service. Accounts will be stored in Tack's database and managed by an
administrator.

Implementation constraints:

- use a maintained password-hashing and session implementation;
- never store plaintext or reversibly encrypted passwords;
- use secure, HTTP-only session cookies;
- keep roles to `admin` and `member`;
- allow administrators to create, disable, and reset accounts;
- do not add profiles, groups, invitations, or fine-grained permissions.

Better Auth 1.6 is the selected implementation. It provides scrypt password
hashing, database-backed sessions, HTTP-only session cookies, email/password
sign-in, and administrator account actions. Public sign-up is disabled.

The configured initial administrator is created by `pnpm db:bootstrap`. The
script is idempotent: an existing matching account is confirmed as an active
administrator, but its password is not overwritten. Additional accounts are
managed inside Tack.

Better Auth names its built-in non-administrator role `user`; Tack presents and
documents that role as `member`. The deployed database remains the single
identity, session, and application store.

## D-004 — Keep authorization at server data boundaries

Status: Accepted and implemented

Page redirects and hidden controls improve navigation but do not establish
authorization. Every issue API verifies a session, every label API verifies an
administrator, protected pages verify their session on the server, and Better
Auth enforces its account-administration endpoints.

The first pilot has no project-level or issue-level permission model. Any active
member can read and change any issue.

## D-005 — Make exports portable without exporting credentials

Status: Accepted and implemented

Administrators can download a versioned JSON snapshot or an issue-oriented CSV.
The JSON export is the lossless portability format: it includes all active and
archived issues, labels, active and disabled account profiles, and stable
relationship IDs. CSV favors human inspection and resolves assignee and label
names on each issue row.

Exports deliberately exclude password hashes, authentication accounts,
sessions, verification records, tokens, and operational configuration. The
route enforces administrator authorization, disables response caching, and
neutralizes spreadsheet-formula prefixes in CSV cells.

## Open deployment inputs

- Expected team size and issue volume
- Whether prototype data must be imported
- The host's reverse proxy/TLS convention
- Backup destination and retention policy

## D-006 — User-owned keys and local MCP for agents

Status: Accepted and implemented, 2026-10-04

Every active member can manage API keys independently of Team administration. Start read-only, preselect the current board, and require explicit choices for updates, archive/restore, transfers, or all future boards. Keys expire in 7/30/90 days; rotation creates a replacement. Administrators can revoke other users' keys but cannot retrieve secrets or grant a key account-administration powers.

Use the compatible Better Auth API-key package with session emulation disabled and Tack-owned lifecycle handlers. A separate versioned API shares IssueStore mutations and adds board/scoped authorization, transactionally checked revisions, and 24-hour idempotency on every mutation. Keep browser sessions separate from delegated credentials.

The user selected a local stdio MCP adapter. Each agent runs its own process with a fixed Tack HTTPS origin and an environment key. A central MCP endpoint, OAuth issuer, new board membership roles, and an activity-feed product are outside this target. Real LAN deployment remains dependent on host, DNS/TLS, trust, and the selected client.
