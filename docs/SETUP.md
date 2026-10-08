# Install Tack

The recommended local setup runs the app and PostgreSQL in Docker. No Node.js
installation is required for this path.

## Requirements

- Git.
- Docker Engine/Desktop with Docker Compose (`docker compose version`).
- OpenSSL (`openssl version`), used to generate random secrets.
- A POSIX shell; Windows users can use WSL or Git Bash with Docker Desktop.

## Start in four commands

```sh
git clone https://github.com/P2Dev/tack.git
cd tack
./scripts/setup.sh
docker compose up -d --build --wait
```

The script creates a private `.env` file, generating database, session, and
administrator secrets. It never overwrites existing configuration or prints
passwords. Open `.env` to find or edit `TACK_ADMIN_EMAIL` and
`TACK_ADMIN_PASSWORD`. Keep that file local; it is ignored by Git.

Open [localhost:3000](http://localhost:3000), sign in, and create a card. Add
colleagues through **Options → Team**. Public self-registration is disabled.
The initial board is `TCK`; it starts empty. Example data is optional.

The bootstrap password creates a new administrator account only. Changing the
password in `.env` later does not change that account’s existing password; use
Team to reset it. Startup confirms the configured administrator as active.

## Manual configuration

If you cannot run the script:

```sh
cp .env.example .env
openssl rand -hex 32
```

Use independently generated values for `POSTGRES_PASSWORD`,
`BETTER_AUTH_SECRET`, and `TACK_ADMIN_PASSWORD`. The session secret needs at least
32 characters; administrator passwords need 10–128 characters. Set the
administrator email, then run `docker compose up -d --build --wait`.

See [configuration](CONFIGURATION.md) for all options.

## Change ports

If port 3000 is busy, edit these values in `.env` before starting:

```dotenv
TACK_PORT=3001
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3001
```

Then open [localhost:3001](http://localhost:3001). If the database’s host port is
busy, change `POSTGRES_PORT` from 54329 to another unused port. Container-to-
container database traffic always uses 5432.

## Stop and restart

```sh
docker compose stop
docker compose start
```

`docker compose down` removes containers and networking while retaining the
named PostgreSQL volume. Adding `--volumes` deletes that data; use it only when
you intend to discard the installation.

## Next steps

- [User guide](USER_GUIDE.md) for cards and boards.
- [HTTPS deployment](DEPLOYMENT.md) before sharing the instance with your team.
- [Authentication](AUTHENTICATION.md) for optional Cognito/OIDC.
- [Agent access](agent-access/README.md) for user-owned API keys and MCP.
- [Development](DEVELOPMENT.md) if you want to run or modify the code on the host.
