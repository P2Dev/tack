# Configure Tack

Docker Compose reads `.env`. Copy `.env.example` or run `./scripts/setup.sh`.
Recreate the app after changing configuration: `docker compose up -d --build --wait`.
Keep the file local. Explicit environment values override `.env` for the host
commands that use `scripts/with-env.mjs`.

## Docker and core settings

| Variable | Default/example | Meaning |
| --- | --- | --- |
| `POSTGRES_DB` | `tack` | Database name; keep stable after first initialization |
| `POSTGRES_USER` | `tack` | Database owner; keep stable after first initialization |
| `POSTGRES_PASSWORD` | Generated | Database password; replacing the file value does not rotate an initialized database password |
| `POSTGRES_PORT` | `54329` | Loopback host port for local development; container traffic uses 5432 |
| `TACK_BIND_ADDRESS` | `127.0.0.1` | Host address exposed by the app; use a host TLS proxy with the default |
| `TACK_PORT` | `3000` | Host port exposed by the app container |
| `BETTER_AUTH_SECRET` | Generated | At least 32 characters, used by authentication; keep stable and private |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Actual public browser/agent origin; use HTTPS for non-local access |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins; normally the public origin |
| `TACK_ADMIN_EMAIL` | `admin@example.com` | Account created/confirmed as administrator during startup |
| `TACK_ADMIN_PASSWORD` | Generated | Initial local password, 10–128 characters; does not overwrite an existing password |
| `TACK_ADMIN_NAME` | `Tack Admin` | Name used when creating the bootstrap account |
| `TACK_ADMIN_COLOR` | `rust` | Initial avatar color: rust, blue, gold, green, slate, violet |

The PostgreSQL image initializes credentials only for a new data volume. Rotate
an existing database password through PostgreSQL and update all matching
connection settings together. Do not delete the volume to change a password.
Bootstrap confirms its configured account as an active administrator on startup;
use a designated recovery account and choose that identity deliberately.

## Sign-in providers

| Variable | Default | Meaning |
| --- | --- | --- |
| `TACK_AUTH_DEFAULT` | `local` | Preferred sign-in option: local or a configured provider ID |
| `COGNITO_ISSUER` | Empty | Exact User Pool OIDC issuer |
| `COGNITO_CLIENT_ID` | Empty | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Empty | Confidential client secret, where configured |
| `COGNITO_NAME` | `Amazon Cognito` | Sign-in button label |
| `COGNITO_ALLOW_SIGN_UP` | `false` | Allow verified provider users to create member accounts on first sign-in |
| `TACK_OIDC_PROVIDERS` | `[]` | JSON array of additional provider definitions |

See [authentication](AUTHENTICATION.md) for callback URLs, verified email
requirements, provisioning, and retaining local sign-in.

## Host development and tests

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Optional PostgreSQL URL; takes precedence over individual PG settings |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Explicit host database settings; the command wrapper maps `POSTGRES_*` values when these are absent |
| `DATABASE_POOL_SIZE` | Pool size, default 10; host runtime setting, not forwarded by the default Compose file |
| `TEST_DATABASE_URL` | Disposable database for unit/integration tests; use its own database name |
| `E2E_DATABASE_URL` | Disposable database for browser tests |
| `E2E_PORT` | Browser-test server port, default 3100; use 3157 when 3100 is busy |

The host command wrapper supplies test URLs from the configured database if
absent; test operations are isolated by schema. Prefer a dedicated test database
as described in [development](DEVELOPMENT.md).

## Local agent adapter

`TACK_BASE_URL` and `TACK_API_KEY` are supplied by the agent host, not to the Tack
app container. The adapter accepts HTTPS origins, with HTTP allowed only for
loopback development. `NODE_EXTRA_CA_CERTS` can supply a private CA certificate
for Node clients. See [agent access](agent-access/README.md).

## Project site

`TACK_SITE_URL` optionally changes the documentation site’s canonical origin and
path when building a fork. It defaults to `https://p2dev.github.io/tack/`.
The project site is static documentation; the Tack application needs a separate
Next.js/PostgreSQL deployment.
