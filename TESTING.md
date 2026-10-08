# Tack Testing

Date: 2026-07-27

## User API keys and local MCP — 2026-10-04

- **38 unit/integration tests passed**; full browser suite **76 passed, six intentional skips**. Final focused agent suite: five passed, one viewport duplicate skipped, followed by final metadata-display checks on desktop/mobile.
- Key tests use real Better Auth hashing and verification, including an actual OIDC session, expiry, rate limiting, revoked/disabled owners, session-only management, and blocked alternate plugin endpoints.
- Agent transactions cover concurrent retries, stale edits, scoped boards, old aliases, cached results after transfers, metadata privacy, and card lifecycle. The real stdio SDK client exercises HTTP operations and failure recovery; agent edits are visible in the browser.
- Production key-creation checks at 1440/390/320 pixels: zero axe violations, no overflow or page errors. Typecheck, lint and production build passed. Existing board/card/label/key data hashes are unchanged after migration (excluding the additive revision column).
- Actual LAN TLS/client acceptance and live AWS Cognito configuration remain deployment checks. See [delivery evidence](docs/agent-access/DELIVERY.md) and [connection guide](docs/agent-access/README.md).

## Complete UI/UX audit remedies — 2026-10-01

- Final desktop/mobile Chromium suite: **71 passed, 5 intentional skips**.
- Unit/integration suite: **33 passed**. Typecheck, lint, and Docker production build passed.
- New regression coverage includes account/board-bound capture recovery, workspace export wording, save-aware Back/Forward, a two-board/card history sequence, exact-key alias/archive lookup, management counts/removal guidance/focus, and remembered mobile columns.
- Board and card transfer tests assert same-document client navigation. The responsive matrix retains its desktop density assertion and 200% text coverage.
- Production checks at nine widths found no horizontal page overflow. Three production axe scans found zero violations, manager Escape returned focus correctly, and no page errors occurred.
- Normal data hashes remained unchanged: two boards, seven cards, eight key records, four labels, and card-label relationships. All test mutations used disposable schemas.

See [delivery notes and screenshots](docs/ui-ux-audit-2026-10-01/DELIVERY.md).

## Collapsible board navigation — 2026-10-01

Desktop navigation now occupies a collapsible left column; narrow screens use a
modal panel. The full browser run passed 60 checks with five intentional skips;
after fixing focus restoration found by the new mobile test, both focused panel
checks passed. Those tests cover collapse persistence, released board width,
current-board indication, focus containment, Escape, protected capture drafts,
and switching. Axe, the existing responsive/200% text checks, typecheck, lint,
and the production build passed. See [sidebar evidence](docs/multi-board/SIDEBAR.md).

## Multiple boards and identity providers — 2026-09-29

- Six Vitest files: **33 passed**. Coverage includes legacy-schema migration,
  per-board numbering and ordering, concurrent allocation, transfer aliases and
  retry integrity, archived cards, removal guards, export v2, provider
  configuration, and the actual Better Auth handler against a local test issuer.
- OIDC integration checks code exchange with PKCE, state/replay rejection,
  verified-email linking to a local account, optional member provisioning,
  disabled-account denial, and callback destination validation. Local password
  login and disabled public local registration remain covered.
- Full desktop/mobile Chromium suite: **59 passed, five intentional duplicate
  skips**. New journeys cover board creation/switching, flushing drafts before a
  transfer, old-key redirects after removal, archived transfer failure/retry,
  admin/member boundaries, stale board links, and provider failure followed by
  local login to the requested board.
- Axe checks include board management and provider sign-in. Existing keyboard,
  seven-width, 200% text, save/recovery, Team, export, and drag checks passed.
- Typecheck, lint, and Docker production build passed. Test schemas remain
  isolated from normal application data. Use `E2E_PORT=3157` (or another free
  port) if the default 3100 is occupied.
- Live AWS tenant acceptance, real-device/browser coverage beyond Chromium,
  and screen-reader testing remain outside this verification.

See [delivery evidence](docs/multi-board/DELIVERY.md) for screenshots and local
production verification. The sections below retain historical milestone results.

## U3 verification — 2026-09-20

- Full Playwright suite: 51 passed, five intentional mobile/width-matrix
  duplicates skipped. Final feedback cleanup: 31 focused U1/U3 checks passed,
  one duplicate skipped. Final label keyboard focus: four passed.
- All 20 domain/export/return-path tests, lint, typecheck, and production build
  passed.
- Seven new recovery scenarios run on desktop and mobile Chromium: refresh/write
  independence, real expired-session capture, label failure/deletion, label
  401/403, account role/password feedback and Cancel, new-account form retention,
  and long archived-note/list restore recovery.
- Member UI hides admin utilities; existing API/export authorization checks remain.
  Axe scans and focused keyboard/focus checks passed in their tested contexts.
- Final production renders verify board reflow at 1440/390 and Team at 320 px,
  without page exceptions. The existing six-card data is unchanged. Fault cases
  use isolated test data and injected responses, then real successful retries.

See [U3 delivery](docs/ui-ux-review/U3-DELIVERY.md) for evidence and limits. This
completes the scoped UI/UX work; it does not claim a production deployment or
representative-user validation.

## U2 verification — 2026-09-20

- Full browser suite: 37 passed, five intentional mobile/width-matrix duplicates
  skipped. Final focused U2 verification after enlarged-text reflow: seven passed,
  one duplicate skipped.
- All 20 domain/export/return-path tests passed. Typecheck, lint, and production
  build passed.
- New cases verify filtered capture and Show card/Clear filters, explicit
  zero-result column selection, direct capture into that column, disclosed filter
  and Options keyboard access, seven viewport widths, editor reading order, and
  200% text with overflow checks and actual capture.
- The pointer drag fixture now places its card in the viewport explicitly;
  capture's position above the list no longer implicitly scrolls to the last card.
- Rendered evidence covers the original six-card board and a separate realistic
  long-title fixture. The production comparison does not modify normal cards.
- The final desktop column starts at 247.5 px. At 390 px, capture starts at
  391 px and the first card is visible. No horizontal overflow at 320, 390, 700,
  860, 900, 1180, or 1440 px. Enlarged status controls wrap without clipped text.

See [U2 delivery](docs/ui-ux-review/U2-DELIVERY.md) for screenshots, measured
before/after positions, and evidence limits. U1 checks remained in the full run.

## U1 verification — 2026-09-20

U1 is implemented and verified locally. Earlier sections below describe the
historical pilot baseline; this section records the current milestone evidence.

- `pnpm typecheck`, `pnpm lint`, and `pnpm build`: passed.
- Full Vitest suite: 20 passed (10 PostgreSQL store, 2 export, 8 safe-return-path
  cases), using the existing disposable store-test schema.
- Full authored Playwright suite: 30 passed, 4 intentional mobile duplicates
  skipped. Includes the original board/account/export checks and nine new U1
  scenarios, using the isolated `tack_playwright` schema.
- Final focused browser verification after feedback-placement and untouched-field
  synchronization refinements: 9 passed, 1 intentional mobile skip.
- New scenarios cover immediate archive/close, serialized delayed saves, failed
  save + copy + retry/discard, real 401/session reauthentication, reload recovery,
  active/archived destinations through sign-in, missing cards, archive focus and
  failed restore, clipboard denial, queued move failure, and in-dialog move Undo.
- The existing two-session test now also checks that an untouched title updates
  from the shared snapshot in the other editor.
- Axe checks of board, label manager, and restored issue editor passed in the
  tested desktop/mobile contexts. Keyboard focus wrapping and Escape/return
  behavior were verified separately.
- Desktop/mobile recovery renders were inspected. Feedback is outside the
  scrolling form, and tests assert that copy/move feedback is in the viewport.

See [U1 delivery](docs/ui-ux-review/U1-DELIVERY.md) for screenshots, scope, and
limits. Browser fault injection checks client recovery; ordinary success checks
also verify actual persistence. No production deployment, representative-user
study, real-device test, or screen-reader conformance claim is made.

## Verification commands

With PostgreSQL running and the documented environment configured:

```bash
pnpm db:migrate
pnpm db:bootstrap
pnpm db:seed
pnpm typecheck
pnpm lint
TEST_DATABASE_URL="$DATABASE_URL" pnpm test
pnpm build
E2E_DATABASE_URL="$DATABASE_URL" pnpm test:e2e
docker compose up -d --build
docker compose ps
```

Playwright requires its matching Chromium build:

```bash
pnpm exec playwright install chromium
```

## Automated coverage

### Repository/domain tests

`src/lib/issue-store.test.ts` verifies:

- sequential stable public keys;
- title-only creation;
- independent field patches;
- optional assignment and label replacement/clearing;
- label-association cascade behavior;
- transactional reorder within a column;
- unrestricted movement through all four statuses;
- cross-column insertion and source-gap closure;
- archive/restore position behavior;
- rejection of blank titles and invalid positions.

The ten store tests run against the real PostgreSQL migration and SQL store.
They create and remove only the `tack_issue_store_test` schema in
`TEST_DATABASE_URL`; they do not truncate the database's normal application
schema.

`src/lib/export.test.ts` adds two database-independent contract tests for:

- a versioned snapshot containing active and archived issues plus disabled
  account profiles;
- deliberate exclusion of authentication records;
- stable issue-number ordering and relationship IDs;
- CSV quoting for commas, quotes, and newlines;
- spreadsheet-formula neutralization for user-entered text.

The current domain/export suite reports twelve passes.

### Browser tests

`tests/e2e/board.spec.ts` runs in desktop Chromium and a Pixel 7-sized context.
It verifies:

- private sign-in and authenticated board access;
- quick-add, deep link, autosave, assignment, labels, and status movement;
- archive and Undo restore;
- pointer drag and native status movement;
- key/title search and shareable assignee/label filters;
- concurrent two-session patches without silent loss;
- anonymous API denial and sign-in redirect;
- administrator account creation and disable;
- administrator-only team and label operations;
- administrator-only JSON/CSV exports, anonymous `401`, member `403`, invalid
  format `400`, attachment headers, and exported issue presence;
- automated axe scans of the board and label drawer.

The current suite reports nine passes and three intentional mobile skips.
Pointer drag, the two-context convergence scenario, and the authorization/admin
scenario are viewport-independent and run on desktop.

The suite recreates only the `tack_playwright` schema in `E2E_DATABASE_URL`.

## Deployment verification

Completed on 2026-07-27:

| Check | Result |
| --- | --- |
| Better Auth schema inspection | No missing tables or fields |
| Initial admin bootstrap | Created successfully; repeat run confirmed idempotency |
| PostgreSQL domain suite | 10 passed |
| Authenticated browser suite | 9 passed, 3 intentional skips |
| Export domain contract | JSON boundary and CSV safety checks passed |
| Export authorization | Admin `200`; anonymous `401`; member `403` |
| TypeScript and ESLint | Passed |
| Production Next.js build | Passed |
| Docker image build | Passed |
| Compose database health | Healthy via `pg_isready` |
| Compose application health | Healthy; `/api/health` returned `{"status":"ok"}` |
| Backup | Non-empty PostgreSQL custom archive created |
| Restore | Restored into a disposable database; account row verified; test database removed |

Local Docker handoff verified on 2026-07-28:

- Compose rebuilt the production image and started PostgreSQL and Tack.
- Both containers reported healthy.
- Startup confirmed current migrations and created the configured local
  administrator.
- `/api/health` returned `{"status":"ok"}`.
- A real browser sign-in succeeded at the configured `http://localhost:3000`
  origin.
- The idempotent demo seed loaded five active cards across the four statuses.
- The Team page showed the administrator account and JSON/CSV export controls.
- The browser console reported no Tack warnings or errors.

## Manual rendered inspection

The Milestone 3 UI was inspected in the in-app browser at 1280 × 720 and
390 × 844:

| Case | Result |
| --- | --- |
| Private sign-in | Clear account-only entry; one obvious action; no horizontal overflow |
| Desktop board | Four equal columns; compact signed-in/admin controls |
| Mobile board | Icon header, status switcher, and one visible card list |
| Desktop team access | Member list and sticky create-account panel remain secondary to board |
| Mobile team access | Create form precedes a readable, two-row action layout |
| Desktop data export | Compact panel remains secondary to account management |
| Mobile data export | Create → export → people order; two full-width-safe controls |
| Browser console | No warnings or errors |

The rendered pass caught and fixed:

- a PostgreSQL 18 volume mounted at the pre-18 data path;
- an unnecessary 17 px sign-in-page scroll at a 720 px-high viewport;
- mobile header pressure after adding account controls;
- production startup using a Next.js output mode inconsistent with
  `next start`.

## Known gaps

- No Firefox, WebKit, or real touch-device run yet.
- No screen-reader pass with VoiceOver, NVDA, or TalkBack yet.
- No 200% text-resize or forced-colors manual session yet.
- No reverse-proxy/TLS deployment has been tested because the target host
  convention is still open.
- No long-running load or large-board performance test; the intended scale is
  one small team and one application replica.
- No SQLite prototype importer exists because import has not been confirmed.
- Backup scheduling, off-host destination, and retention remain deployment
  inputs rather than application behavior.

Automated accessibility checks are supporting evidence, not a conformance
claim.

## Board navigation follow-up — 2026-10-01

Eight focused desktop/mobile board checks passed for the single desktop collapse
control and client-side switching. A delayed destination response verifies busy
state and input protection; a document sentinel and request counter verify that
switching and browser Back/Forward do not reload the document. Existing board
management, draft cancellation, transfers, aliases, and permissions also passed.
