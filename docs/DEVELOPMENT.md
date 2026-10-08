# Develop Tack

Use Node.js **24.9+**, pnpm **11.9+**, Docker Compose, and PostgreSQL **18**.
The repository pins pnpm in `package.json` and dependencies in `pnpm-lock.yaml`.

## Run on the host

```sh
./scripts/setup.sh
pnpm install --frozen-lockfile
docker compose up -d db
pnpm db:migrate
pnpm db:bootstrap
pnpm dev
```

Open [localhost:3000](http://localhost:3000). If the Docker app is already using
that port, stop it with `docker compose stop app` before starting the development
server. The database container remains running. Host commands load `.env` and
map `POSTGRES_*` settings to PostgreSQL client settings; explicit environment
values and `DATABASE_URL` take precedence.

Add sample cards only to a disposable development installation:

```sh
pnpm db:seed
```

The seed script checks the active board before adding samples. It is not part
of normal startup and should not run against a team production instance.

## Verify a change

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm docs:build
pnpm docs:check
```

For browser tests:

```sh
pnpm exec playwright install chromium
E2E_PORT=3157 pnpm test:e2e
```

Use a dedicated test database where possible. Create it on the local Compose
PostgreSQL instance:

```sh
docker compose exec db sh -c 'createdb -U "$POSTGRES_USER" tack_tests'
```

Supply `TEST_DATABASE_URL` and `E2E_DATABASE_URL` pointing to `tack_tests` with your
configured credentials. These are PostgreSQL URLs; encode special characters in
a password if entering a URL manually. If omitted, the host command wrapper uses
the configured database. Tests create/drop their own schemas (`tack_issue_store_test`,
`tack_board_migration_test`, `tack_identity_test`, `tack_agent_service_test`, and
`tack_playwright`); do not point tests at a schema containing real team data.

Browser preparation recreates `tack_playwright` and uses test credentials. Some
visual evidence files are written by tests; review actual source/evidence changes
before committing. CI runs tests against its disposable PostgreSQL service.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server with local environment loading |
| `pnpm build` / `pnpm start` | Build/run the production application |
| `pnpm db:migrate` | Apply unapplied migrations |
| `pnpm db:bootstrap` | Create/confirm the configured recovery administrator |
| `pnpm db:seed` | Add sample cards to an empty active board |
| `pnpm db:backup [path]` | Database backup via Docker |
| `pnpm db:restore path --confirm` | Replace the database from a backup |
| `pnpm test` / `pnpm test:watch` | Unit/integration tests |
| `pnpm test:e2e` | Desktop/mobile browser and real stdio MCP tests |
| `pnpm mcp` | Optional local agent adapter |
| `pnpm docs:build` / `pnpm docs:check` | Build static docs and validate links |
| `pnpm docs:preview` | Serve built docs locally on port 4173 |
| `pnpm docs:verify` | Browser/layout/axe checks for the built project site |

## Source map

- `src/app`: authenticated pages, browser APIs, and `/api/v1` agent API.
- `src/components` and `src/hooks`: board, account tools, and draft/recovery behavior.
- `src/lib`: auth, validation, store transactions, export, and agent contracts.
- `migrations/postgres`: deployed schema; migrations at the root preserve the old SQLite prototype only.
- `tools/tack-mcp.ts`: local stdio adapter with fixed-origin API calls.
- `tests/e2e`: authenticated browser and protocol integration checks.
- `scripts`: migrations, bootstrap, backup, setup, and documentation build tools.
- `site`: static project-site layout/style assets; guide content stays in Markdown.
- `docs`: current guides plus historical delivery reports and screenshots.

See [architecture](../ARCHITECTURE.md), [decisions](../DECISIONS.md), and
[contributing](../CONTRIBUTING.md) before changing auth, transactions, or public
contracts. The [testing record](../TESTING.md) documents evidence and remaining
live-provider/browser limitations.
