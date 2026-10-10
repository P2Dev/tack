# Cloud project board integration

Version 1, prepared 2026-10-10. This feature does not enable Cloud synchronization or deploy itself. Review and deploy a pinned source/image with controller coordination first. Existing boards, cards, numbering, users and authentication remain intact.

## Protocol

`PUT /api/v1/integrations/cloud/projects/{cloudProjectId}` requires a dedicated bearer API key whose only scope is `projects:sync`, `Content-Type: application/json` and exactly `Idempotency-Key: cloud-project-{UUID}-r{revision}`. Ordinary card keys never receive this privilege. Integration keys cannot read boards/cards, export, manage users or create keys. The owner must still be an enabled Tack administrator on every request and replay; Cloud/Cognito roles do not grant Tack permissions.

All fields are required; unknown fields are rejected:

```json
{
  "schemaVersion": 1,
  "cloudProjectId": "39cbda4f-bc0c-456a-b9dd-87a147fae3f1",
  "revision": 1,
  "slug": "example-project",
  "code": "EXM",
  "name": "Example project",
  "description": "Project description",
  "appUrl": null,
  "status": "active"
}
```

UUIDs use lowercase canonical spelling. Revisions are positive safe integers. Slugs use 1–80 lowercase letters/digits separated by single hyphens. Codes are immutable 2–10 uppercase letters/digits, starting with a letter. Names are 1–80 characters without outer whitespace; descriptions are up to 20,000 characters. `appUrl` is null or an HTTPS URL up to 2,048 characters without credentials, backslashes or line breaks. Tack stores the URL as metadata and never fetches it. Status is `active` or `archived`.

A first creation returns 201; an update/import/replay returns 200. Success contains exactly `schemaVersion`, `cloudProjectId`, `revision`, `resourceType:"board"`, `resourceId` (code), and `url` (`https://tack.p2dev.cloud/?board=EXM` on that deployment). URLs come from the configured `BETTER_AUTH_URL` origin, never client Host/forwarding headers. Replays return `Idempotency-Replayed: true`. Responses and errors are `Cache-Control: no-store` and include `X-Request-Id`. Errors have `{error:{code,message},requestId}`; throttling returns 429 and `Retry-After: 60`.

The `cloud_projects` PostgreSQL ledger uniquely binds UUID, slug and board code, with the latest canonical JSONB projection, revision and response. A higher revision updates metadata and board name atomically. Identical payload at the latest revision replays safely across process restarts, key rotation and expiration of the ordinary 24-hour request cache. An older revision returns `409 stale_revision`, including previously accepted requests after a newer revision. A different payload at the same revision returns `409 revision_conflict`. UUID/code/slug remain immutable. Codes already owned by an unrelated or removed board, or slugs owned by another UUID, return `409 identity_collision`; a similarly named board is never adopted. Duplicate names with different identities are permitted.

Archiving/restoring only updates projection metadata. It never removes a board, changes cards or discards issue history. A removed linked board returns `409 board_unavailable` and requires explicit operator recovery. Success audit records store only request/key/owner IDs, operation, external UUID and outcome; failures never store raw payloads or secrets. This is a projection upsert, not an arbitrary board administrator API.

## Migration and explicit existing-board import

1. Keep Cloud's `TACK_PROJECT_SYNC_ENABLED=false`. Take a protected PostgreSQL backup under the controlling host's existing backup process. Do not export real records to this repository.
2. Verify the expected Tack database/deployment target privately. Run `pnpm db:migrate` on the approved release. Migration `004_cloud_projects.sql` adds a ledger and an exclusive scope check. It does not adopt boards, modify existing key scopes, recreate resources or rewrite cards. Standard previously provisioned keys retain their permissions. Migration application is transactional and repeatable through `schema_migrations`.
3. Review [the explicit LNG/MNJ manifest](cloud-project-mappings.example.json) against Cloud's approved mapping and the existing `app_meta` entries. Use the active authorizing Tack administrator's ID privately as `TACK_IMPORT_ADMIN_ID`; do not copy an account record or secret into Git/logs.
4. In the configured app environment, run:

```sh
node --import tsx scripts/import-cloud-projects.ts \
  docs/cloud-project-mappings.example.json "$TACK_IMPORT_ADMIN_ID"
```

The local operator command requires an enabled administrator and an explicit list of expected UUID/slug/code/provisioned-revision values. It reads only each matching `p2dev-cloud-project-{UUID}` operator mapping, validates `schemaVersion`, UUID, slug, code=boardId, expected revision, `provisionedBy:"p2dev-cloud-operator"`, board availability and unique ownership, and imports the entire batch in one transaction. It never uses name matching. Malformed/conflicting entries roll back the batch; retries verify an existing ledger without resetting a newer revision. Existing operator metadata remains unchanged for recovery.

An imported row has `payload=null` and the provisioned revision as its lower bound. That revision proves provisioning only. The first authorized PUT must be at or above that revision and match UUID/immutable slug/code; it initializes the complete payload without inventing a historical hash. LNG and MNJ are reused with all their cards. A project with saved operator metadata but no imported ledger returns `409 mapping_import_required` instead of creating a duplicate board.

## Provisioning and rotation

An enabled Tack administrator signs in through the existing API keys page, selects **Cloud project sync only**, gives the credential a descriptive service name, and chooses 7, 30 or 90 days. The server independently checks the current enabled administrator; changing the browser payload cannot bypass it. Do not grant `read`/card scopes or board restrictions to this key. The normal hash-only API-key store, expiry, revocation and 120 requests/minute throttle apply. The key is displayed once using Tack's existing creation UI; copy it directly to Cloud's protected runtime environment and hide it. Never save it in repository files, screenshots, browser storage or command history.

With controller coordination, privately set `TACK_PROJECT_SYNC_URL=https://tack.p2dev.cloud` and `TACK_PROJECT_SYNC_KEY`, then enable `TACK_PROJECT_SYNC_ENABLED=true` after the mappings and release are verified. An integration key deliberately fails `GET /api/v1/me`; acceptance uses the authorized project PUT. Keep `BETTER_AUTH_URL` set to Tack's canonical public origin. Do not use a browser user's Cloud/Cognito bearer token.

To rotate: create a replacement dedicated key while the old key is still valid, update Cloud's protected environment, verify an identical current-revision replay with the new key, then revoke the old key in Tack. Confirm the old key is denied and the new key still replays. Rotation never resets project identity, revisions or existing cards. Revocation, expiry, administrator demotion or owner disabling denies every future write and cached replay. A transaction locks lifecycle/owner records while it commits; revocation/disable waits for an already authorized write to finish.

## Rollback and recovery

Disable Cloud synchronization first and revoke integration keys through Tack before reverting application code. Take a fresh protected backup. Revert only Tack's application source/image to the previously reviewed **Cognito-patched** base `27e59a9b80c344aec4f1eb1eccab7c1a8a5b80bb` with the controller's existing email-verification patches. The feature includes those exact patches and tests, so do not apply them twice when deploying this release.

Keep migration 004, the ledger, operator mappings, boards/cards and key metadata in place during application rollback. The previous application can use its ordinary scopes/schema unchanged and has no integration PUT endpoint. This additive-schema rollback avoids deleting board history or overwriting subsequent work with an old backup. Prior UI may show an unlabeled revoked integration scope; no ordinary key gains privileges. Do not drop boards, truncate tables, restore an old whole database over new cards, or remove the schema-migration record. Reapplying this release reuses durable mappings/payloads safely; provision a fresh key and replay Cloud's current revisions before reenabling.

A corrupt/removed mapping requires an operator reconciliation with the approved UUID/code/slug, backup and current cards. Never silently remap a UUID/code or rename/adopt a board by name. No destructive cleanup is part of the importer or background endpoint. For a disposable acceptance fixture, use Tack's normal empty-board removal only after checking all active/archived cards; preserve production linked boards and their ledger.

## Acceptance evidence

The three `cloud-project-*.test.ts` suites use synthetic fixtures in isolated PostgreSQL schemas and cover strict v1 fields/bounds, same-origin URLs, real bearer hashing and lifecycle, admin-only exclusive provisioning, rotation, ordinary-key denial, throttling headers, concurrent creation/revision races, collisions, stale/conflicting revisions, atomic failure rollback, explicit LNG/MNJ import with unknown initial payload, rename/archive/restore and preservation of cards/TCK.

Run the complete test suite with `TEST_DATABASE_URL` and `DATABASE_URL` pointed explicitly at a disposable synthetic PostgreSQL database; avoid the local `.env` wrapper for acceptance so no real database is selected accidentally. Typecheck, lint and build additionally verify the route and UI. The existing OIDC/provider suites cover Cognito-compatible exact boolean/string verification, malformed claims, disabled accounts, local recovery login, state/replay checks and explicit signup policy. Deployment login, live imported mappings and Cloud opt-in/opt-out/failure recovery remain controller acceptance steps after review; no production deployment or live credential provisioning was performed by this implementation.

The synthetic verification results and remaining deployment acceptance are recorded in [Cloud sync acceptance](cloud-project-sync-acceptance.md). Desktop/mobile browser tests additionally check the dedicated UI and actual Next.js integration routing.
