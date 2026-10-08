# Minimal Issue Tracker: Product Research

Date: 2026-07-27

## Objective

Build an internal issue tracker that feels like moving post-it notes on a shared board. It is for lightweight work tracking only. Code review, QA, release management, and discussion remain in the tools where those activities already happen.

The intended outcome is not a smaller Jira clone. It is a deliberately narrow shared board that a developer can understand without training and use without completing a form.

## Research constraints

- One team is the initial audience.
- Adoption friction matters more than workflow configurability.
- A card must be useful even when only its title is known.
- The board is the primary interface and source of truth.
- Review and QA states are explicitly out of scope.
- Hosting and the identity boundary are confirmed for the pilot.
- Team size, import needs, reverse proxy convention, and backup retention remain open.

## Confirmed patterns from existing tools

### Minimize required fields

[Linear requires only a title and status](https://linear.app/docs/creating-issues); its other issue properties are optional. It also offers a single-key create shortcut. This supports a title-first capture flow with details added later.

[GitHub Projects supports draft issues](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project?apiVersion=2022-11-28) that are created by typing an idea and pressing Enter. Creating within a board column inherits that column's status. This is a strong model for inline, context-aware capture.

### Keep the workflow short and transitions unrestricted

[Jira's default Kanban columns](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/) are Backlog, Selected for Development, In Progress, and Done.

[Jira's simplified workflow](https://support.atlassian.com/jira-software-cloud/docs/what-is-a-simplified-jira-workflow/) lets cards move freely between columns and applies transitions immediately without transition screens. This is the useful part of Jira to preserve; its workflow administration is not.

[Linear's default workflow](https://linear.app/docs/configuring-workflows) has Backlog, Todo, In Progress, Done, and Canceled, and it can add a separate triage inbox. For this product, a separate triage concept would add ceremony before the team has demonstrated a need for it.

### Optimize frequent actions

[Trello's keyboard support](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/) includes card creation, title editing, navigation, filtering, archiving, and undo. These shortcuts are evidence that capture, movement, and recovery are high-frequency board actions.

[Linear search](https://linear.app/docs/search) supports issue ID, title, description, and in-view filtering. The minimal tracker needs much less search syntax, but issue ID and title lookup are worth supporting from the start.

### Drag-and-drop cannot be the only movement mechanism

[WCAG 2.2 guidance for dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) explicitly uses a task board as an example: a board that supports dragging should also provide a menu for moving an item to another column. The product therefore needs drag-and-drop, a status menu, and keyboard operation.

## Shared deployment and identity research

The implementation research was refreshed before the shared-pilot milestone:

- [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication)
  recommends using an authentication library and keeping secure authorization
  checks close to data access rather than relying only on optimistic proxy or
  client checks.
- [Better Auth's Next.js integration](https://better-auth.com/docs/integrations/next)
  supports the App Router and server-side session reads, while its
  [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql) accepts a
  `pg.Pool` directly.
- [Better Auth email/password authentication](https://better-auth.com/docs/authentication/email-password)
  uses scrypt and exposes password-length controls. Its
  [admin plugin](https://better-auth.com/docs/plugins/admin) supplies account
  creation, role, ban/unban, and password reset without adding SSO or outbound
  email.
- [node-postgres transaction guidance](https://node-postgres.com/features/transactions)
  requires one checked-out client for every statement in a transaction. Tack's
  transaction helper follows that constraint.
- [Docker Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/)
  supports waiting for a dependency's `service_healthy` state. Tack uses
  `pg_isready` before application startup.
- PostgreSQL's current [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)
  and [`pg_restore`](https://www.postgresql.org/docs/current/app-pgrestore.html)
  tools support the custom archive used by the operational scripts.

Better Auth was selected because it covers the narrow local-account boundary
with maintained primitives and stores users/sessions in the same PostgreSQL
database as the board. Tack does not implement password hashing, session-token
generation, or cookie parsing itself.

## Product recommendation

### Product principles

1. **Capture first, classify later.** A title is the only user-entered field required to create a card.
2. **Stay on the board.** Creating, editing, filtering, moving, and archiving should not require navigating to another page.
3. **Reveal details on demand.** Cards show only scan-friendly information; a side panel holds optional details.
4. **Make actions reversible.** Moves and archives offer immediate undo. Permanent deletion is not part of the normal UI.
5. **Use plain language.** Avoid Jira vocabulary such as schemes, transitions, resolutions, epics, and issue types.
6. **Do not encode ceremonies.** The tracker records the current state; it does not force planning, estimation, review, or QA behavior.
7. **Prefer one obvious workflow.** Configuration is deferred until real team usage proves it is necessary.

### Default board

| Column | Meaning | Entry rule |
| --- | --- | --- |
| Backlog | Captured but not committed | Default for global quick-add |
| Ready | A sensible next item | Team judgment; no required metadata |
| In Progress | Someone is actively working it | Assignee remains optional |
| Done | Tracking is complete | Review/QA status is not represented |

Why four columns: Backlog keeps uncommitted ideas from obscuring the immediate queue, while Ready provides a small shared commitment boundary. There are no Review, QA, Blocked, or Released columns. "Blocked" can be a label if the team later needs it.

Columns are fixed in the MVP. A future administrator may rename them, but arbitrary workflow construction is intentionally excluded.

### Card model

Required system fields:

- Stable public key, such as `MIN-142`
- Title
- Status
- Position within the status column
- Created and updated timestamps
- Creator identity
- Archive timestamp when archived

Optional user fields:

- Markdown description
- One assignee
- Zero or more labels

The first version should not add priority, estimate, due date, issue type, sprint, parent, dependency, checklist, attachment, or custom fields. Manual order is the team's lightweight priority signal.

### Core interaction contract

- The application opens directly to the shared board.
- Each column has an inline "Add card" action.
- Typing a title and pressing Enter creates the card in that column.
- A global `C` shortcut starts a card in Backlog.
- Selecting a card opens a side panel without losing board context.
- Title and description autosave; metadata uses compact selectors.
- Dragging changes status or order optimistically.
- Every card also has a Move menu for pointer and keyboard users.
- A move or archive shows a short-lived Undo action.
- A card has a stable, copyable deep link.
- Search matches public key and title.
- Filters are limited to assignee and label; an obvious reset restores the full board.
- Filter/search state is represented in the URL so a view can be shared.
- Refocusing the browser refreshes board data; a short polling interval keeps multiple users reasonably current.
- On narrow screens, columns become a status switcher plus a single vertical card list rather than a tiny horizontal board.

### Empty and error states

- An empty board explains the four columns in one sentence and puts focus on the first title input.
- No onboarding tour is required.
- Failed optimistic changes visibly roll back and preserve unsaved text.
- Network loss shows a persistent offline indicator. The MVP does not promise offline writes.
- Archiving is recoverable. Permanent deletion, if ever added, belongs behind an administrator-only confirmation.

## MVP boundary

### In scope

- One workspace and one board
- Member sign-in
- Board read
- Inline issue creation
- Edit title and Markdown description
- Move and reorder by drag, status menu, and keyboard
- One optional assignee
- Optional labels
- Search by ID/title
- Filter by assignee/label
- Archive and restore
- Shareable card and filtered-board URLs
- Responsive layout
- Accessible focus, announcements, and non-drag alternatives
- Basic stale-data refresh for team use
- Seed/demo data for development only

### Explicitly out of scope

- QA and review workflow
- Comments, mentions, and notifications
- Attachments
- Sprints, cycles, estimates, velocity, reports, and roadmaps
- Epics, subtasks, dependencies, and linked issues
- Due dates, SLAs, and time tracking
- Custom fields and user-defined workflows
- Integrations, webhooks, and public API
- Automation rules
- Fine-grained project or issue permissions
- Native desktop/mobile applications
- Full offline sync
- Real-time cursors or WebSockets

These exclusions are product safeguards. A deferred feature should be added only when pilot usage identifies a recurring tracking problem that cannot be solved by title, description, assignee, label, order, or status.

## Implemented technical approach

The smallest maintainable shape is a single TypeScript web application with a relational database:

- React-based responsive UI and a server runtime in one deployable application
- Server-rendered initial board followed by narrow JSON mutations
- Relational tables for users, issues, labels, and issue-label joins
- Schema validation at every write boundary
- Sanitized Markdown rendering with raw HTML disabled
- Optimistic client updates with rollback on failure
- Field-specific patches so moving a card does not overwrite a concurrent title edit
- Transactional integer reordering; an O(n) position shift is acceptable at the intended small-team scale
- Polling plus refresh-on-focus instead of a real-time subsystem
- Unit tests for domain rules, integration tests for writes/reordering, and a small browser smoke suite

Current stack:

- Next.js App Router, React, and TypeScript
- A small component layer and DnD Kit
- Better Auth email/password and admin plugins
- PostgreSQL with node-postgres and versioned raw SQL migrations
- Zod validation at every application write boundary
- Vitest against isolated PostgreSQL schemas
- Playwright for authenticated desktop/mobile flows
- Docker Compose for one application and one database container

An ORM was not added because the schema and transactional reorder operations
remain smaller and clearer as explicit SQL.

Milestone 2 implementation update, 2026-07-27: the relational member/label model, optional assignment, key/title search, assignee/label filters, URL-restored views, 12-second polling, refresh-on-focus, and field-specific patches are implemented. Two-session testing found an important client-side race: an untouched stale title could be resent after a move refreshed the issue. The editor now distinguishes locally touched fields from externally refreshed fields, preserving active drafts while accepting fresh untouched values.

The database history is:

| Deployment shape | Recommendation |
| --- | --- |
| Historical local prototype | SQLite in WAL mode |
| Current development and shared pilot | PostgreSQL in Docker Compose |

The shared pilot uses a small local identity store instead of SSO, OAuth, or
email delivery. Better Auth owns password hashes and database sessions; Tack
adds only the account-administration UI and server authorization boundary.

Milestone 4 preparation adds an administrator-only data-portability boundary.
JSON is the versioned, lossless snapshot; CSV is an issue-oriented inspection
format. Both contain active and archived issue data, labels, and account
profiles while deliberately excluding authentication records, secrets, and
sessions. The pilot runbook in `PILOT.md` turns the assumptions below into
concrete observation prompts without adding product scope in advance.

## Current data model

```text
user
  id, email, name, role, banned, initials, color, createdAt, updatedAt

session / account / verification
  maintained Better Auth session and credential records

issues
  id, public_number, title, description, status, position,
  assignee_id, created_at, updated_at, archived_at

labels
  id, name, color, created_at

issue_labels
  issue_id, label_id
```

Status is a constrained value: `backlog`, `ready`, `in_progress`, or `done`.

An issue move runs in a database transaction. It removes the issue from its old position, closes that gap, opens the target position, and updates only `status`, `position`, and `updated_at`. This favors correctness and simplicity over a ranking algorithm designed for very large boards.

## Product acceptance criteria

A pilot build is ready when:

1. A new member can understand the board and create a first issue without instruction.
2. Creating a basic issue requires only typing a title and pressing Enter.
3. Create, edit, move, reorder, archive, restore, search, and filter work without a page navigation.
4. Moving an issue works by drag, a pointer-accessible menu, and keyboard.
5. Two browser sessions converge after a refresh interval and never lose a confirmed write silently.
6. A card deep link restores the board with that card open.
7. The primary flow works at 375 px width and at a desktop viewport.
8. Automated tests cover the four-state workflow and position changes.
9. No review or QA concepts appear in the data model or interface.

## Assumptions to validate during pilot

| Assumption | Validation |
| --- | --- |
| One shared board is enough for the first team | Observe whether users ask for separate projects rather than saved filters |
| Four fixed statuses fit daily work | Review requested workarounds after two weeks |
| Title, description, assignee, and labels cover tracking needs | Record requested fields and the concrete decisions they would enable |
| Manual order is enough priority | Watch for repeated requests for explicit urgency |
| Polling is current enough | Ask whether users encounter stale movement or assignment |
| Comments can remain elsewhere | Check whether issue context is being lost in chat or pull requests |
| No import is needed for the first pilot | Confirm before inviting the team |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Scope expands toward Jira parity | Treat the explicit exclusions as a product constraint and require pilot evidence for additions |
| A visually simple board hides keyboard barriers | Ship status menus, visible focus, announcements, and browser tests with the first interactive board |
| Multiple users reorder simultaneously | Use transactional moves, narrow patches, polling, and visible rollback |
| Container storage is treated as ephemeral | Use a named PostgreSQL volume and verify backup/restore before pilot access |
| Local authentication expands into account management | Limit it to admin-created accounts, disable/reset, sign-in/out, and two roles |
| Done grows forever | Add archive/restore now and consider age-based collapsing only after observing usage |

## Recommendation

The low-friction loop, team context, local identity boundary, and Compose
deployment are now implemented as one coherent pilot, with portable exports and
a launch/observation runbook. The next step is not another feature build:
introduce Tack to the team for two weeks, observe where capture or tracking
actually fails, and consolidate only evidence-backed friction. Do not add more
fields or workflow states before the pilot identifies a recurring decision the
current title, description, assignee, label, order, and status model cannot
support.
