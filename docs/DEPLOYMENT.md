# Deploy and operate Tack

Tack runs as a Next.js application with PostgreSQL 18. Docker Compose includes
persistent storage, migrations, administrator bootstrap, health checks, and
restart policies. The static GitHub Pages project site hosts documentation;
it does not run the application or hold team data.

## Share an instance over HTTPS

1. Install and start Tack using [setup](SETUP.md).
2. Choose a stable LAN/public DNS name and a certificate trusted by browsers and agents.
3. Put a host reverse proxy in front of `127.0.0.1:3000`.
4. Set the public origin in `.env`, then recreate the app:

```dotenv
TACK_BIND_ADDRESS=127.0.0.1
TACK_PORT=3000
BETTER_AUTH_URL=https://tack.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://tack.example.com
```

```sh
docker compose up -d --build --wait
```

For example, a host-installed Caddy proxy can use this Caddyfile for a public
DNS name that resolves to the host:

```text
tack.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

[Caddy reverse-proxy reference](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Certificate issuance depends on DNS and connectivity. On a private LAN, use your
trusted private CA/certificate process and install its trust in browsers and
agent runtimes. Do not use insecure certificate bypasses. A containerized proxy
must join the app’s Docker network and target `app:3000`, rather than its own
loopback address; add that proxy to your Compose configuration.

If binding the app to a particular LAN address is necessary, change
`TACK_BIND_ADDRESS` deliberately and restrict firewall access to the proxy or
intended LAN. The database host port remains loopback-only. Keep the named
`tack_postgres_data` volume. See [configuration](CONFIGURATION.md) and
[authentication](AUTHENTICATION.md) for deployment settings.

## Check health

```sh
docker compose ps
curl --fail http://localhost:3000/api/health
docker compose logs --tail=100 app
```

Adjust the URL for a changed host port. Readiness requires both app and database
containers to be healthy. Logs are operational data; redact credentials and
private team content before sharing them.

## Back up

```sh
./scripts/backup.sh
# Or choose an external storage path:
./scripts/backup.sh /secure/backups/tack.dump
```

The script uses `pg_dump` in the database container and produces a custom-format
backup. Store copies away from the host, with access controls and a retention
policy suitable for the team. Backups contain private content and authentication
records. Browser JSON/CSV exports are useful for portability but cannot replace
a complete database restore.

Keep a separate protected copy of deployment configuration and a record of the
application commit/image used with each backup. Test restoration on a disposable
installation before relying on the backup process.

## Upgrade

Start from a clean checkout and take a backup before applying new migrations:

```sh
./scripts/backup.sh
git pull --ff-only
docker compose up -d --build --wait
docker compose ps
```

Startup applies only unapplied SQL migrations under a transaction/advisory lock,
then confirms the bootstrap account. Check sign-in, card capture/edit, boards,
and one agent request after upgrading. Review release notes and migration
changes before updating an important team installation.

## Restore or roll back

Restore replaces the current database. Stop the app, restore the selected
backup, and run the application version compatible with that backup:

```sh
docker compose stop app
./scripts/restore.sh /secure/backups/tack.dump --confirm
docker compose start app
```

If rolling back a migration, restore the matching application checkout/image
before starting it. Starting a newer image can immediately reapply migrations.
An older image may be incompatible with a newer schema. Verify health, sign-in,
boards, and agent access after recovery.

## Deployment acceptance

From another team machine, verify HTTPS with certificate validation, member and
administrator sign-in, card creation/edit/movement, board switching, archive
recovery, and exports. If using a provider, also check a provisioned member,
unprovisioned user, disabled account, and local-admin fallback. For agents,
exercise list/create/read/update/move and key revocation using the chosen client.

Live Cognito acceptance and a real LAN agent deployment depend on the operator’s
host/provider/client configuration; local integration evidence does not replace
those checks. [Troubleshooting](TROUBLESHOOTING.md) covers common failures.
