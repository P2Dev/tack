# Tack

Tack is a small, shared issue tracker for development teams that want the
clarity of post-it notes without ticket-filing ceremony. A title is enough to
create a card. Work moves through Backlog, Ready, In progress, and Done; review
and QA stay in the tools where they already happen.

## What it includes

- Multiple private workspace boards with four fixed statuses
- Board switching and administrator-managed board creation/removal
- Title-only capture above each column’s cards, with filters preserved
- Four columns on desktop; explicit column selection on phones and tablets
- Per-board `ENG-N` keys, cross-board moves, and permanent aliases for old links
- Autosaved title and Markdown description, with retry/discard and tab-local
  draft recovery after interrupted saves
- Optional assignee and administrator-managed labels
- Key/title search and shareable assignee/label filters
- Pointer, touch, keyboard, and native-select movement
- Recoverable archive with immediate Undo
- Refresh-on-focus and short polling, with checked/paused/unavailable feedback
- Persistent action recovery and sign-in in another tab for interrupted forms
- Local email/password accounts with `admin` and `member` roles
- Optional Cognito User Pools and OIDC sign-in, with local accounts still available
- Administrator account creation, disable/enable, role, and password reset
  with feedback beside the affected account and explicit password-reset Cancel
- User-managed, scoped API keys and a versioned agent API
- Optional local stdio MCP adapter with retry and stale-edit protection
- Administrator-only JSON and CSV data exports
- PostgreSQL persistence and versioned SQL migrations
- A self-hosted Docker Compose stack with health checks
- Backup and restore commands

Comments, notifications, review states, QA workflow, sprints, estimates,
custom fields, and workflow configuration are intentionally excluded.

## Self-host with Docker Compose

Requirements:

- Docker Engine with Docker Compose
- A reverse proxy that provides TLS for any non-local deployment

Create the environment file:

```bash
cp .env.example .env
openssl rand -base64 32
```

Put the generated value in `BETTER_AUTH_SECRET`, replace both database and
administrator passwords, and set these values to the externally reachable
origin:

```dotenv
BETTER_AUTH_URL=https://tack.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://tack.example.com
```

Start Tack:

```bash
docker compose up -d --build
docker compose ps
```

Open `BETTER_AUTH_URL` and sign in with `TACK_ADMIN_EMAIL` and
`TACK_ADMIN_PASSWORD`. The bootstrap password is used only when that account is
first created; changing it in `.env` does not overwrite an existing account's
password. Further accounts are managed from **Options → Team** inside Tack.

Administrators can also download a complete JSON snapshot or an issue-oriented
CSV from **Options → Team**. Exports include active and archived cards, labels, and
account profiles; they never include password hashes, session tokens, or
authentication records.

The database port is bound to loopback only. The application port is exposed
for the host reverse proxy. PostgreSQL data is stored in the named
`tack_postgres_data` volume.

### Back up and restore

Create a PostgreSQL custom-format backup:

```bash
./scripts/backup.sh
# or choose the output path
./scripts/backup.sh /secure/backups/tack.dump
```

Restore replaces the current Tack database, so the command requires an
explicit confirmation flag:

```bash
docker compose stop app
./scripts/restore.sh /secure/backups/tack.dump --confirm
docker compose start app
```

The scripts require only a POSIX shell and Docker Compose. The `pnpm db:backup`
and `pnpm db:restore` aliases are available on development machines. Keep
backups outside the Docker host and set a retention policy appropriate for the
team.

## Local development

Requirements:

- Node.js 24.9 or newer
- pnpm 11.9 or newer
- PostgreSQL 18 (the Compose database is the easiest option)

After creating `.env`, start PostgreSQL and run the app on the host:

```bash
docker compose up -d db
export DATABASE_URL='postgresql://tack:YOUR_POSTGRES_PASSWORD@127.0.0.1:54329/tack'
export BETTER_AUTH_SECRET='YOUR_32_CHARACTER_OR_LONGER_SECRET'
export BETTER_AUTH_URL='http://localhost:3000'
export TACK_ADMIN_EMAIL='admin@example.com'
export TACK_ADMIN_PASSWORD='a-strong-temporary-password'

pnpm install
pnpm db:migrate
pnpm db:bootstrap
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The seed command is safe
to rerun and skips an already-populated board.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm mcp` | Run the local MCP adapter with `TACK_BASE_URL` and `TACK_API_KEY` |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create the production build |
| `pnpm start` | Run the production build |
| `pnpm db:migrate` | Apply unapplied PostgreSQL migrations |
| `pnpm db:bootstrap` | Create or confirm the configured administrator |
| `pnpm db:seed` | Add representative issues to an empty board |
| `pnpm db:backup [path]` | Create a custom-format PostgreSQL backup |
| `pnpm db:restore path --confirm` | Replace the database from a backup |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm test` | Run PostgreSQL-backed repository/domain tests |
| `pnpm test:e2e` | Run desktop and mobile authenticated browser tests |

Install Playwright's Chromium build once before the browser suite:

```bash
pnpm exec playwright install chromium
```

`pnpm test` expects `TEST_DATABASE_URL` to point to a disposable PostgreSQL
database. It creates and removes isolated schemas prefixed `tack_`, including repository, migration, identity, and agent-service tests.
`pnpm test:e2e` uses `E2E_DATABASE_URL` and recreates only the
`tack_playwright` schema.

## Project notes

- [Agent access](./docs/agent-access/README.md) explains user API keys, HTTP operations, the local MCP adapter, and LAN deployment.
- [Boards and issue keys](./docs/BOARDS.md) explains switching, moves, removal, and migration.
- [Authentication setup](./docs/AUTHENTICATION.md) covers Cognito, other OIDC providers, local fallback, and account provisioning.

- [Stakeholder overview](./docs/stakeholder-overview/README.md) explains the delivered UI/UX upgrades, with screenshots and an offline browser presentation.
- [RESEARCH.md](./RESEARCH.md) records product and implementation evidence.
- [ROADMAP.md](./ROADMAP.md) defines completed and planned milestones.
- [PILOT.md](./PILOT.md) is the launch, observation, and consolidation runbook.
- [ARCHITECTURE.md](./ARCHITECTURE.md) describes boundaries and invariants.
- [TESTING.md](./TESTING.md) records verification and known gaps.
- [DECISIONS.md](./DECISIONS.md) records accepted architecture choices.

## License

[MIT](./LICENSE) © 2026 p2dev.
