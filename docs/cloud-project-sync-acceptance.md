# Cloud project sync acceptance

Verified 2026-10-10 on branch `codex/cloud-project-sync`, starting from live-source base `27e59a9b80c344aec4f1eb1eccab7c1a8a5b80bb`. The controller's existing Cognito email-verification source and regression-test patches are incorporated exactly. This is a source delivery; no host/AWS mutations, production records, live keys, deployment or Cloud activation were used.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 98 passed, 10 files |
| New Cloud contract/database/real HTTP tests | 50 passed, 3 files |
| Desktop/mobile browser integration acceptance | 4 passed |
| Full ESLint | Passed |
| TypeScript, including actual route types | Passed |
| Default production build (Turbopack) | Passed; dedicated PUT route generated |
| Additional webpack production build | Passed |
| Documentation site build/link checks | Passed |
| Whitespace validation | `git diff --check` passed |

The database tests ran only against a new disposable local PostgreSQL 16 container, with isolated schemas. All test fixtures are synthetic. Builds/browser testing used an isolated source copy with no `.env`, avoiding the user's local private configuration. Browser acceptance used real synthetic session sign-in and the running Next.js server, exercising administrator-only UI, member session/API denial, dedicated key creation, create/replay response URLs and archived projections preserving browser-created cards. Accessibility checks reported no violations on the integration creation form.

The new tests verify strict schema/identity/key headers and bounds, hash-only real key persistence, expiry/revocation/owner demotion/disable, dedicated scope isolation from ordinary card keys and from card reads, key rotation, 429/Retry-After, canonical replay after cache clearing, concurrent identical creation and conflicting code/revision races, immutable code/slug, stale/conflicting revisions, rollback on audit failure, and expiry while waiting for the board lock. Explicit LNG/MNJ operator mapping fixtures verify expected UUID/code/slug/revision, batch rollback, unknown imported payload, first PUT floor, idempotent import/replay, higher revision and existing cards/TCK preservation. Existing suites also retain card workflows, legacy active/archived migration, authentication/OIDC linking/local fallback, disabled/signup rules and exact Cognito verification claims.

Application rollback was tested against the retained additive schema with an ordinary card key: the existing board/card service works, the revoked integration key fails, and ledger/cards/boards remain intact. Rollback does not delete new boards or restore a stale whole database.

## Reproduce

Provide a disposable synthetic PostgreSQL database through `TACK_SYNTHETIC_DATABASE_URL` (never a production URL). Run from the source root without the local environment-loading wrapper:

```sh
TEST_DATABASE_URL="$TACK_SYNTHETIC_DATABASE_URL" \
DATABASE_URL="$TACK_SYNTHETIC_DATABASE_URL" \
  node node_modules/vitest/vitest.mjs run
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Browser tests are `tests/e2e/cloud-project-sync.spec.ts` on both configured projects. The local acceptance copy used direct preparation/Next development commands with webpack to avoid loading `.env`; normal CI uses the repository's Playwright configuration with a supplied synthetic `E2E_DATABASE_URL`. Production builds were run from the same isolated source copy using both default and webpack bundlers. Existing PostgreSQL query-queue deprecation warnings remain non-failing warnings; pg@9 is outside this feature.

## Remaining prerequisites

Review/merge approval and controller-pinned deployment are pending. Before enabling Cloud, privately back up and verify the target database, apply migration 004, explicitly import the approved LNG/MNJ mappings, provision a dedicated expiring credential and keep the Cognito compatibility patches from being applied twice. Then verify live Cognito/local login and current mapped-project replays, an opted-in synthetic new Cloud project, opt-out with no board, failure/retry recovery, identical replay and old-key revocation. See [the operator guide](CLOUD_PROJECT_SYNC.md). No production acceptance or Cloud enablement is claimed by these synthetic results.
