# Published — Public project site and documentation

2026-10-08: published [Tack’s project site](https://p2dev.github.io/tack/), simplified README/setup, completed task-oriented guides, and added contribution and CI/Pages workflows. Local checks passed: 38 integration tests, clean Docker quick start, typecheck/lint, 494 static references, responsive/keyboard/axe site checks, and live HTTPS/navigation/search acceptance. Publication CI exposed an early-hydration status-control defect and a duplicate-title test assertion; both were corrected and eight focused browser checks passed (two intentional viewport skips). [Delivery record](docs/releases/2026-10-08-project-site.md) and [application CI results](https://github.com/P2Dev/tack/actions/workflows/ci.yml).

The project-site implementation and publication are complete. No additional features are selected for this target. A live Tack LAN deployment remains a separate installation task.

---

# Completed locally — User API keys and local agent access

2026-10-04: implemented user-owned API keys, the scoped `/api/v1` API, and the optional local stdio MCP adapter. All active users can create, inspect, rename and revoke their own keys; administrators can revoke others. Board/scoped access, hash-only storage, expiry, rate limits, revision conflicts and 24-hour mutation idempotency are verified. Local and provider-backed accounts share the flow.

Verification: 38 unit/integration tests, 76 full browser checks (six intentional skips), and final focused key/MCP checks passed; typecheck, lint and production build passed. The updated local review copy is available at http://localhost:3000, and existing board data remains unchanged. [Delivery evidence](docs/agent-access/DELIVERY.md) and [connection guide](docs/agent-access/README.md).

No further implementation is required for this target. Actual LAN delivery still needs the host, HTTPS name/certificate trust, selected agent client and separate-machine smoke test. The current review app remains loopback-only; this is not a claim of LAN deployment.

---

# Completed target — October UI/UX audit remedies

Authorized 2026-10-01: implement all eight audit findings and the listed clarity improvements. Implemented and verified: 71 browser checks and 33 unit/integration tests passed, with five intentional browser skips. Typecheck, lint, production build, nine-width layout checks, and sampled production accessibility checks passed. The updated local app runs at http://localhost:3000; read-only hashes confirm existing board data is unchanged. See [delivery details](docs/ui-ux-audit-2026-10-01/DELIVERY.md).

---

# Completed target — Multiple boards and configurable sign-in

Authorized 2026-09-29: preserve local accounts; support Cognito User Pools and other configured OIDC providers; add board switching, creation/removal, per-board keys, and moving active/archived cards between boards.

Accepted defaults: immutable short board IDs; sequential BOARD-N keys; moves allocate a destination key and preserve old link aliases; only empty boards may be removed. Existing TCK data migrates in place. Board administration follows the existing admin role; all members share access to all boards. Labels and accounts remain workspace-wide.

Implemented and verified locally: 33 unit/integration tests and 59 browser checks passed, with five intentional browser duplicates skipped. Typecheck, lint, and the Docker production build passed. Evidence covers existing-data migration, isolated numbering/order, transfer aliases and retries, board removal protections, admin/member boundaries, local and OIDC callback flows, and responsive/keyboard recovery. See [delivery evidence](docs/multi-board/DELIVERY.md). AWS credentials are not configured, so live Cognito acceptance remains a deployment check.

---

# Minimal Issue Tracker Roadmap

Date: 2026-07-27

## Goal

Deliver a low-friction shared issue board for a small development team. The product tracks what is Backlog, Ready, In Progress, or Done. Review and QA happen elsewhere.

## Current state

- **2026-09-20 UI/UX upgrades U1–U3: implemented and verified locally.** The
  latest “proceed” authorized U3, closing the scoped shared-state and
  administrative recovery work from [the review plan](docs/ui-ux-review/PLAN.md).
- U3 separates refresh freshness, writes, and expired sessions; keeps failures
  actionable; preserves interrupted forms through sign-in in another tab; and
  places Team/label/archive feedback beside the task. See
  [U3 delivery](docs/ui-ux-review/U3-DELIVERY.md).
- Verification: 51 full browser checks passed with five intentional skips;
  after feedback cleanup, 31 focused U1/U3 checks passed with one duplicate
  skipped; four final label-focus checks passed. All 20 domain/export/return-path
  tests, lint, typecheck, and production build passed. A read-only production
  check confirmed the original six-card data remains unchanged.
- U1's draft/save/navigation recovery and U2's compact capture/filter workflow
  remain verified. [U1 details](docs/ui-ux-review/U1-DELIVERY.md) and
  [U2 details](docs/ui-ux-review/U2-DELIVERY.md) retain their evidence. There is
  no new exactly-once creation or cross-user same-field conflict protocol.
- **No further implementation is required for the UI/UX upgrade target.** No
  deployment was requested or performed. The next delivery step is the existing
  real-team pilot: choose the TLS host and backup destination/retention, deploy
  and verify there, then observe actual participants using `PILOT.md`. These
  external inputs and observations remain outstanding; optional tracking
  features are not release blockers.

Historical implementation state (2026-07-27):

- Milestones 1–3 are implemented; Milestone 4 preparation is implemented.
- Tack now runs as an authenticated Next.js and PostgreSQL Compose stack.
- Local administrator-managed accounts, database sessions, and `admin`/`member`
  authorization protect the existing low-friction board.
- PostgreSQL migrations, health checks, initial-admin bootstrap, and
  backup/restore commands are in place.
- The full authenticated board and account-management flows pass on desktop and
  mobile Chromium.
- Milestone 4 is ready for a real-team pilot; no additional tracking features
  are selected in advance.

## Guardrails

- Title is the only required user-entered field.
- The board is the default and primary interface.
- The application has one workspace, multiple shared boards, and four fixed statuses.
- Status transitions are immediate and unrestricted.
- Dragging always has menu and keyboard alternatives.
- No review, QA, comments, notifications, sprint planning, reporting, or workflow builder.
- Add scope only in response to observed pilot friction.

## Milestone 0 — Research and product definition

Status: Complete

Delivered:

- Prior-art research across Jira, Linear, GitHub Projects, Trello, and WCAG
- Product principles and MVP boundary
- Default workflow and card model
- Provisional architecture and data model
- Acceptance criteria, risks, and assumptions to validate

Verification:

- Sources are linked directly from `RESEARCH.md`.
- Scope contains no review or QA workflow.
- Every included field supports basic tracking.

## Milestone 1 — Local core board vertical slice

Status: Complete

### Why

This proves the product's central claim before adding team administration: capturing and moving a note should feel faster than filing a ticket.

### Scope

- Scaffold one TypeScript full-stack web application
- Establish visual tokens and a responsive board shell
- Add SQLite schema and migrations for issues
- Render Backlog, Ready, In Progress, and Done
- Inline title-only creation in any column
- Card side panel with title and Markdown description editing
- Move and reorder with drag-and-drop
- Equivalent status menu and keyboard movement
- Archive/restore and immediate undo
- Stable card deep links
- Optimistic updates with rollback and error feedback
- Seed command for development data
- Focused unit, integration, and browser smoke tests
- Basic local run and test documentation

### Not in this milestone

- Authentication or deployment
- Multiple users, assignees, or labels
- Search and filtering
- Imports or integrations
- Any feature listed as out of scope in `RESEARCH.md`

### Verification

- Fresh migration and seed succeeded.
- Seven repository/domain tests passed.
- Desktop and mobile browser flows passed.
- Pointer drag passed on desktop.
- Automated axe scans passed on desktop and mobile.
- Manual inspection passed at 375 px, 900 px, and 1440 px.
- Keyboard reorder and native non-drag status movement were verified.
- TypeScript, ESLint, and the production build passed.

### Needs

- None; milestone complete.

## Milestone 2 — Lightweight team context

Status: Complete

### Scope

- User records using local development identities
- One optional assignee per issue
- Optional administrator-managed labels
- Search by issue key and title
- Filters for assignee and label
- Shareable filter URLs
- Refresh-on-focus and short-interval polling
- Conflict-safe field patches and multi-session tests
- Accessibility and responsive regression pass

### Verification

- Ten migrated in-memory repository/domain tests pass.
- Two browser contexts create, move, and edit the same issue without losing either field.
- Search and assignee/label filters restore deterministically from the URL on desktop and mobile.
- Desktop pointer drag and native movement alternatives pass.
- Desktop and mobile axe scans pass for the board and label-management drawer.
- Manual rendered inspection passes at 375 px, 900 px, and 1280 px.
- TypeScript, ESLint, the production build, and the full browser suite pass.

### Needs

- None; milestone complete.

## Milestone 3 — Identity and shared pilot deployment

Status: Complete

### Decisions locked

- Self-hosted Docker Compose
- One Tack application container and one PostgreSQL container
- Persistent database volume with documented backup and restore
- Local, administrator-managed accounts
- No SSO, OAuth, or outbound email dependency for the first pilot
- `admin` and `member` are the only roles

### Delivered

- Better Auth 1.6 email/password accounts with maintained scrypt hashing
- Database-backed sessions and sign-in/sign-out
- Administrator account create, role, disable/enable, and password reset
- Server-side member/admin authorization
- Async node-postgres store and PostgreSQL migrations
- Transaction-scoped advisory locks for board ordering and migration startup
- PostgreSQL-backed domain tests using an isolated schema
- Production Dockerfile and Compose application/database services
- Service health checks, restart policies, and dependency readiness
- Idempotent initial administrator bootstrap
- Custom-format backup and guarded restore scripts
- `.env.example` and self-host/development runbooks
- Private sign-in and responsive team-access screens

### Not in this milestone

- SSO, OAuth, magic-link email, invitations, groups, or profile management
- Multiple workspaces, projects, or fine-grained issue permissions
- Kubernetes or multi-replica deployment
- Review, QA, comments, notifications, or other deferred tracking features

### Verification

- Better Auth schema inspection reports no missing tables or fields.
- Initial administrator bootstrap succeeds and is idempotent.
- Ten PostgreSQL repository/domain tests pass.
- Anonymous issue API access returns `401`.
- Administrator account creation and disable flows pass in a real browser.
- Nine authenticated browser tests pass; three viewport-independent mobile
  duplicates are intentionally skipped.
- Desktop and 390 px rendered inspections show no horizontal overflow or console
  errors.
- TypeScript, ESLint, and the production build pass.
- A custom-format backup restores into a clean disposable database and preserves
  account data.
- The Compose application and PostgreSQL services both report healthy; the app
  health endpoint confirms a live database query.

### Deferred inputs

- Expected team size and issue volume
- Whether existing prototype issues must be imported
- Reverse proxy/TLS convention on the target host
- Backup destination and retention policy

## Milestone 4 — Two-week pilot and consolidation

Status: In progress — pilot-ready; real-team observation pending

### Scope

- Observe real creation, movement, filtering, and archiving behavior
- Collect friction as concrete failed or repeated tasks
- Validate the assumptions in `RESEARCH.md`
- Fix bounded usability and reliability defects
- Add CSV/JSON export for data portability
- Update product and architecture decisions
- Decide whether any deferred feature has enough evidence to enter the roadmap

### Verification

- Every accepted pilot issue maps to an observed problem and a testable outcome
- Export includes all active and archived issues plus labels and assignees
- Documentation reflects the deployed system
- Deferred-feature decisions are recorded with rationale

### Pilot-ready delivery

- Administrator-only, versioned JSON snapshot
- Administrator-only issue-oriented CSV
- Active and archived issues, labels, and active/disabled account profiles
- Explicit exclusion of credentials, sessions, tokens, and configuration
- CSV quoting and spreadsheet-formula neutralization
- Launch, observation, feedback, consolidation, and rollback checklist in
  `PILOT.md`

### Preparation verification

- Twelve domain/export tests pass.
- Nine authenticated browser tests pass with three intentional mobile skips.
- Export access returns `200` for an administrator, `401` anonymously, and
  `403` for a member.
- Invalid export formats return `400`.
- CSV escaping covers commas, quotes, newlines, and spreadsheet-formula
  prefixes.
- Desktop and 390 px rendered inspections show no horizontal overflow or
  browser console errors.
- TypeScript, ESLint, and the production build pass.

### Remaining evidence

- Deploy behind the team's TLS reverse proxy.
- Choose backup destination and retention.
- Invite the actual pilot participants.
- Run the two-week observation window.
- Record concrete repeated or failed tracking tasks.
- Validate each assumption in `RESEARCH.md`.
- Select at most one evidence-backed next product improvement.

## Release definition

The initial release is complete after Milestone 4 when the team can:

- open one URL and see the shared state;
- create a card with one field;
- move, edit, find, assign, label, archive, restore, and share cards;
- use the core workflow without dragging or a mouse;
- trust that confirmed changes persist;
- do all review and QA work outside this application.

## Candidate after release

Do not preselect the next feature. Use pilot evidence to choose one improvement. Likely candidates are import, a personal "mine" view, age-based Done collapsing, or an explicit blocked signal. Projects, custom workflows, comments, and notifications remain intentionally high-threshold additions.
