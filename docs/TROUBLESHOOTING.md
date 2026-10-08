# Troubleshoot Tack

Start with `docker compose ps` and `docker compose logs --tail=100 app`.
Do not share `.env`, API keys, database dumps, or unredacted private data in a
public issue.

## Setup and startup

| Symptom | Check and recovery |
| --- | --- |
| Docker daemon unavailable | Start Docker Desktop/Engine; verify `docker info` before Compose |
| Setup says `.env` already exists | Existing configuration is preserved; edit it rather than rerunning for new passwords |
| Port already in use | Change `TACK_PORT` and both auth origins together; change `POSTGRES_PORT` if its host port is busy |
| Missing environment value | Generate `.env` or copy/edit `.env.example`; remove placeholder secrets |
| App container unhealthy | Read app and database logs; check database credentials, migration errors, and public-origin/provider configuration |
| Database password authentication fails after editing `.env` | Existing PostgreSQL credentials do not change when a file changes; restore the matching value or deliberately rotate the database password |
| Host migration/test command uses the wrong database | Check explicit `DATABASE_URL`/`PG*` variables; they take precedence over `POSTGRES_*` from `.env` |

## Sign-in and providers

An existing administrator password is not overwritten by changing `.env`.
Reset it through another administrator in Team or use your documented recovery
procedure. Ensure `BETTER_AUTH_URL` and trusted origins match the browser URL’s
scheme, host, and port.

For provider failures, check the callback registered in the provider against
`/api/auth/oauth2/callback/PROVIDER_ID`, exact issuer discovery, client credentials,
and boolean verified email from UserInfo. With automatic provisioning off, the
administrator must create the matching local email first. Keep local sign-in
available. [Authentication](AUTHENTICATION.md) lists the full configuration.

## Cards and boards

- Missing new card: inspect filters and the capture notice’s **Show card** action.
- Save failed: preserve the draft, check connectivity/session, and use Retry.
- Cannot remove a board: move active **and archived** cards out; keep at least one board.
- An old card key opens a different board: the card was transferred; aliases resolve its current key.
- Shared changes appear paused: close/save the open editor; inspect the freshness indicator.

## Agents

| Response | Next action |
| --- | --- |
| 401 | Replace an invalid/expired/revoked key, or check whether its owner is disabled; browser cookies do not authenticate `/api/v1` |
| 403 | Check the key’s scope; create a replacement with the needed capability if appropriate |
| 404 | Check the card’s current board and the key’s allowed boards; transfers need both source and destination access |
| 409 revision conflict | Read the card again, reconsider the edit, then use its new revision and a new retry ID |
| 409 idempotency conflict | The same retry ID was reused for different input; use a new ID for a new operation |
| 429 | Wait for `Retry-After`; reduce request frequency |
| Timeout/uncertain write | Retry identical arguments with the same ID within 24 hours; after that, inspect before retrying |

The MCP adapter uses HTTPS for LAN addresses, permits HTTP only on loopback,
rejects redirects, and limits requests to 15 seconds/responses to 4 MB. Check the
fixed origin, certificate trust, environment key, working directory, and client
launcher. Reduce list page size for a response limit. [Agent access](agent-access/README.md)
explains the complete contract.

## Project-site problems

Run `pnpm docs:build && pnpm docs:check`. For GitHub Pages, check the **Project
site** workflow and that Pages uses **GitHub Actions** as its source. The Pages
site documents Tack; opening it cannot sign you into your self-hosted instance.
See [project-site maintenance](PROJECT_SITE.md).

## Report a problem

Open a [GitHub issue](https://github.com/P2Dev/tack/issues) with the affected
commit/version, environment, reproduction steps, expected/actual behavior, and
redacted logs. Report vulnerabilities privately via [security guidance](../SECURITY.md).
