# Tack UI review and UX upgrade plan

Reviewed: 2026-09-20. Updated: U1, U2, and U3 implemented and verified locally.

See [U1 delivery and verification](U1-DELIVERY.md). The findings and baseline below preserve the original review evidence.

## Recommendation

Keep Tack's small, title-first board and warm visual identity. First make editing, saving, sharing, and returning to the board dependable. Then give the actual work more space, particularly on phones and medium-width screens. Do not add tracking features to solve presentation or recovery problems.

The highest-priority finding is draft loss: switching cards or archiving before the 700 ms autosave runs can discard an edit. The most visible design problem is hierarchy: on the tested 390 px layout, the column starts 589 px below the top and its quick-add starts at 912 px, despite only one card in that column.

## Target, authority, and boundaries

- **Intended users:** members of one small development team tracking work; administrators also manage access and labels. This follows the project brief, not interviews.
- **Original deliverable:** an evidence-backed review, proposed flows, implementation sequence, and acceptance cases written into this workspace. The follow-up “proceed” authorized U1 implementation and verification.
- **Authorization:** review/planning, followed by U1, U2, and U3 implementation and verification through successive “proceed” instructions. Deployment, user recruitment, and communications remain outside these deliveries.
- **Preserve:** one workspace, one board, four fixed statuses, title-only creation, optional details, unrestricted movement, non-drag alternatives, stable keys, shareable filters, archive/restore, member/admin boundaries, and exports.
- **Existing stack:** Next.js, React, TypeScript, plain CSS tokens, dnd-kit, Better Auth, PostgreSQL. No replacement framework, component library, or backend redesign is justified by this review.
- **Product exclusions remain:** review/QA workflows, comments, notifications, sprints, estimates, custom fields, and workflow configuration.
- **Research approach:** inspect current source and rendered behavior, consult primary accessibility guidance for relevant interaction contracts, then validate proposed composition with the existing pilot. No external product survey is needed to establish these defects.

This review fits Milestone 4's bounded usability consolidation. It does not complete the real-team pilot or settle TLS hosting and backup inputs.

## Evidence and limits

The current workspace source ran through Next.js development mode at `http://localhost:3105`, using the local PostgreSQL database. The existing Compose services were started to make that database available. Review used the local administrator, six existing active cards, four labels, and one account. The initial archive was empty.

Captured board layouts at **1440 × 900, 900 × 900, 390 × 900, and 320 × 900**; inspected the issue drawer at **390 × 844** and Team at wide and narrow widths. This is Chromium with viewport resizing, not a real touch-device or screen-reader session.

| Evidence | What it establishes |
| --- | --- |
| [Desktop board](evidence/board-desktop.png), [900 px board](evidence/board-900.png), [390 px board](evidence/board-390.png), [320 px board](evidence/board-320.png) | Current hierarchy, card composition, header pressure, and responsive arrangement |
| [Desktop editor](evidence/issue-desktop.png), [mobile editor](evidence/issue-mobile.png) | Editor density, optional-field ordering, and full-screen phone presentation |
| [Team desktop](evidence/team-desktop.png), [Team mobile](evidence/team-mobile.png), [sign-in](evidence/sign-in-desktop.png) | Secondary task presentation and local-account entry |
| [Baseline measurements](evidence/baseline.json) | Layout coordinates, no document-width overflow at sampled widths, and lost destination across sign-in |
| [Interaction probes](evidence/interaction-probes.json) | Draft loss, archived Escape behavior, false save feedback, mobile tab override, missing-card response, focus escape, and axe results |
| [Failed-save feedback](evidence/failed-save-copy.png), [archived detail](evidence/archived-detail.png), [filtered mobile view](evidence/filtered-mobile.png) | Visible results of the controlled recovery checks |

Interaction probes intercepted issue API requests in the browser. Mutations and failures were simulated; existing issue records were not edited. Authentication used the actual local account. This supports client interaction findings, not claims about successful persistence or server fault recovery. Two logged HTTP 500 console messages came from deliberately injected failures. The final baseline had no page errors; the probe run had no other console errors. The Next development indicator in captures is tooling, not product UI.

`pnpm typecheck` and `pnpm lint` passed for the baseline. Desktop board and label drawer axe scans reported zero violations. Those scans did not detect the demonstrated mobile focus problem and are not accessibility conformance evidence. The full database/browser suites and production build were not rerun for this planning task. Historical results in `TESTING.md` remain historical.

There were no representative-user sessions, analytics, measured usability gains, performance benchmarks, Firefox/WebKit runs, or large-board tests. Priority reflects task consequence, not measured frequency. The folder has no Git metadata, so no commit-based baseline or diff was available.

## What should survive the upgrades

- The recognizable paper, rust, serif-heading, and small-note character.
- Plain-language status names and short descriptions.
- Inline creation and the `C` and `/` shortcuts.
- Native status selectors, keyboard ordering, and drag as parallel options.
- Optional assignee/labels and title-only cards that remain useful.
- Existing failure behavior that retains an editor draft and prevents the explicit Close action from discarding a failed save.
- Recoverable archive and Undo, with current server authorization boundaries.

## Current journeys

| Task | Current path | Completion and friction |
| --- | --- | --- |
| Capture work | Board → column input or New card/`C` → title → Enter | Creates in the chosen column; global New card chooses Backlog and clears filters. Inputs follow the entire card list. |
| Edit context | Card → side drawer → title/description → delayed autosave | Explicit Close attempts to save, but card switching and Archive bypass that path. |
| Move work | Native selector, drag, or drawer Earlier/Later | Immediate movement and Undo are valuable; keep all alternatives. |
| Find/share | Search/filter → card or Copy view/Copy link | Filters survive a signed-in reload. A signed-out recipient loses the requested issue and filters at login. |
| Recover a card | Archive → archived title → Restore | Archived detail uses a separate drawer implementation with different keyboard and return behavior. |
| Administer access | Team → create/reset/role/disable → feedback | Capabilities are appropriately separate from the main board; multi-account operation and failure recovery were source-reviewed, not exercised against real accounts. |

## Ranked findings

P1 means address in the first correctness milestone. P2 means meaningful friction or visual improvement for the planned optimization. Confidence distinguishes reproduced behavior from source risk or design judgment.

| ID | Priority / evidence | Finding and consequence | Smallest useful correction |
| --- | --- | --- | --- |
| F01 | **P1, reproduced; high confidence** | Edit a title, then open another card before 700 ms: no PATCH occurs and the draft disappears. Edit then Archive: only the archive POST occurs and the old title is archived. `Board.openIssue` changes the keyed drawer; Archive calls the parent directly. | One save/leave contract for switching, closing, archiving, and navigating away. Await the latest draft before the operation, or retain it and require an explicit discard on failure. |
| F02 | **P1, reproduced; high confidence** | After a simulated failed save, Copy link changes the footer to **Saved** while the edited title remains unsaved. Metadata updates also share this state in source. Clipboard errors are uncaught. | Track draft persistence separately from copy and metadata feedback. “Link copied” must never imply persistence. Add visible Retry and explicit Discard actions for failed drafts. |
| F03 | **P1, reproduced; high confidence** | On the full-screen mobile drawer, Shift+Tab from Close focuses the quick-add input behind it. Archived detail neither receives initial focus nor closes on Escape. | Use one accessible drawer primitive for active, archived, and label/archive views. On phones, make the underlying page inert and contain focus; restore focus to a visible logical target. |
| F04 | **P1, reproduced; high confidence** | Opening `/?issue=TCK-1&q=example` while signed out redirects to `/sign-in`, then `/`. The shared destination is lost. A nonexistent `issue` key silently renders an ordinary board. | Carry a validated local return URL through sign-in. Provide a clear missing-card state and Return to board action without destroying filters. |
| F05 | **P2, reproduced; high confidence** | Search `TCK-1` on mobile, then select Ready: Backlog stays selected because the render-time fallback overrides a chosen empty column. | Auto-select a matching status only when applying a new filter if needed; honor subsequent explicit column selection, including zero results. |
| F06 | **P2, rendered; high confidence in layout, inferred usability impact** | At 390 px, the board begins at y=589; quick-add is at y=912. The hero, explanatory copy, label administration, and summary consume the upper viewport. At 900 px, the header squeezes New card and crowds the context/sign-out region. | Compact the recurring board heading and toolbar; make administration secondary; keep a labeled Add card action available before long lists; fix header compression at intermediate widths. |
| F07 | **P2, rendered; design opportunity** | Cards repeat their column status and “Has note”/“Title only,” while useful identifiers and secondary text are very small. Large fixed title/description editors give optional fields substantial weight. | Refine card reading order and editor density. Keep movement discoverable; do not remove its non-drag control merely to save space. Put Title and Description together before secondary metadata. |
| F08 | **P2, source-supported risk** | Polling pauses while drawers are open, yet the header stays in its normal state. `finishMutation` sets sync to live even after failures; request errors do not distinguish expired authentication from temporary connectivity. | Separate refresh freshness, mutation status, and authentication recovery. Show an actionable persistent error when required, and preserve drafts through reauthentication. Verify with injected 401/offline responses. |
| F09 | **P2, source-supported and partly reproduced** | Archive → detail loses the archive return context; closing targets an active-board trigger that does not exist. Restore-from-detail closes immediately before its outcome is known. | Remember the entry point, return to Archive when appropriate, and keep a failed restore actionable. Reuse the same scrolling and Markdown display rules as active detail. |
| F10 | **P2, source risk; not reproduced** | Overlapping saves have no explicit single-flight queue; movement/archive failures restore an entire old snapshot. Under delayed or out-of-order responses, newer local state could be replaced. | During F01, test delayed and reordered responses. Serialize dependent operations or reconcile only affected state where needed. Do not claim cross-user conflict protection from a local queue. |

Source anchors: [board state and refresh](../../src/components/board.tsx), [autosave/editor](../../src/components/issue-drawer.tsx), [shared drawer](../../src/components/detail-drawer.tsx), [archive](../../src/components/archive-drawer.tsx), [sign-in redirect](../../src/app/page.tsx), [sign-in completion](../../src/components/sign-in-form.tsx), [cards](../../src/components/issue-card.tsx), [column capture](../../src/components/board-column.tsx), and [responsive CSS](../../src/app/globals.css).

## Proposed experience

### Editing, leaving, and recovery

Keep autosave, with an explicit state model: clean → unsaved → saving → saved, or failed with the draft retained. “Saved” means the latest dirty fields have been acknowledged. Copy feedback is independent.

| State / action | Proposed behavior | Recovery / acceptance |
| --- | --- | --- |
| Open card | Show key, title, context, optional metadata, and persistent save status | Preserve issue deep link and the board's filters/scroll context |
| Edit | Debounce into one coordinated save sequence; newer typing remains dirty until acknowledged | A slow earlier response cannot mark newer input saved or overwrite it |
| Close, switch card, or Archive | Flush pending edits and await the result before switching or archiving | If saving fails, retain the editor with Retry and Discard changes; no silent unmount |
| Blank title | Explain the requirement beside Title and make it reachable | User can correct it or explicitly discard to the last saved value |
| Reload, browser navigation, Team, sign-out | Handle dirty/pending state deliberately | Use an appropriate navigation guard; do not promise asynchronous saves on tab termination. Explicit discard remains possible. |
| Copy link/view | Copy the current intended URL and announce “Link copied” / “View link copied” | On clipboard failure, show a selectable URL; persistence status is unchanged |
| Connection failure | Show operation-specific feedback, retain inputs, and offer Retry | A successful copy or unrelated operation cannot erase an unsaved error |
| Session expired | Explain that signing in is required and preserve the draft | Specify draft retention before implementation; prefer bounded session storage cleared after save/discard if navigating through sign-in, not indefinite offline storage |

Use a modal side drawer for the initial correctness milestone, with a full-screen form on mobile, to prevent accidental background interactions. Preserve the board visually on desktop. If the pilot establishes a need to switch cards without closing detail, a later docked non-modal panel can provide that through the same guarded transition contract. Modal behavior must include actual background inertness and focus handling, not just `aria-modal`. See [W3C's dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### Finding, sharing, and returning

Preserve `q`, `assignee`, `label`, and `issue` through sign-in using a local return destination. Reject external or malformed return targets. Successful sign-in should land on the requested active or archived card. An unavailable key should explain the result and offer the board with the original filters.

Make opening a card a meaningful history step where practical: Back returns to the prior board/view; Forward reopens the card; search keystrokes replace the current view rather than creating a history entry per character. Guard dirty edits before history-driven transitions. Define direct-link Close as returning to the filtered board when no in-app parent exists.

On mobile, column selection is user-controlled. A chosen empty status should say “No matching cards in Ready” with Clear filters. The first filtered result may guide the initial status, but must not override later selections. Keep filter values visible when controls are collapsed. Creating a card that does not match the current filter should report its destination and offer Show card or Clear filters, instead of silently removing the user's view.

### Visual direction: a compact working board

Retain the warm canvas, rust action accent, serif brand/headings, colored status edges, and familiar native inputs. The change is primarily composition and scale.

| Surface | Proposed arrangement | Capability preserved |
| --- | --- | --- |
| Desktop header | Brand/board identity → concise freshness → clear New card → secondary board/account utilities | Archive, Team, sign-out, current identity |
| Board heading | Compact “Engineering board” heading and one count; introductory explanation moves to empty/help context | Product explanation remains available without recurring hero space |
| Toolbar | Search, assignee, label, active filter summary; Copy view secondary | All existing filters and shareable URLs |
| Column | Status/count, always-reachable add affordance, cards | Existing column-specific creation and order semantics |
| Card | Title leads; key and optional labels/assignee support; compact move control remains explicit | Full title on open, key recognition, labels, assignment, non-drag movement |
| Mobile | Compact header with labeled Add card; search; expandable Filters with active count; status switcher; list | Column context and visible filter state; no icon-only primary capture action |
| Tablet | Test four columns at readable minimum width; if they do not fit, use the same explicit status switcher as mobile | Predictable left-to-right status order; avoid the current split 2×2 workflow hiding In progress below Backlog |
| Editor | Key/title, description, optional status/assignee/labels; advanced ordering after core details; stable save/recovery region | Markdown preview, move/reorder, copy link, Archive |
| Team | Keep the separate admin route; concise member actions with local feedback; create-account section reachable from a top action | Existing local-account policy and exports |

Use semantic tokens already present. Raise actionable/secondary text from the current 10–11 px treatments where reading suffers; use roughly 14–16 px for main working text and 12–13 px for supporting metadata as a prototype starting point. Keep status meaning available through labels, not color alone. Reduce redundant nested boundaries before adjusting decoration. Do not add a theme picker, dark mode, imagery, or new font downloads for this pass.

Proposed composition targets, to be checked with equivalent fixtures: first column begins within the upper 250 px at 1440 × 900; the first card and a labeled capture action appear in the initial 390 × 844 viewport; at 900 px the header has no overlap or crushed controls. These are design acceptance targets, not measured gains.

### Secondary-flow refinement

Use the shared drawer for archived detail, show its previous status, render Markdown consistently, and provide Back to archive plus Restore. On restore success, offer Show card if the current view hides it; on failure, retain the action and context.

Keep label deletion's explicit consequence (“removes this label from every card”). Move Manage labels into a secondary board utility while preserving admin-only access. For Team, make reset/disable/role actions show pending and completion feedback near the affected account, explain protected self/last-admin actions without relying only on hover, and give password reset a clear Cancel. These are presentation changes; outbound invitations and self-service account recovery remain outside scope.

## Delivery sequence

### U1 — Trustworthy edits and navigation

**Complete locally.** It closes observed draft-loss and misleading-feedback defects before redesigning screens. See the linked delivery record for implementation decisions and verification. Covers F01–F04 and F09; bounds the F10 investigation and establishes save-error behavior needed by F08.

- Implement coordinated draft saving and guarded transitions; separate copy and save state.
- Unify drawer focus, Escape, return behavior, and archive detail.
- Preserve safe return destinations through sign-in and explain invalid issue links.
- Add focused regressions for fast switching/archive, failed save/retry/discard, delayed responses, clipboard feedback, and focus restoration.
- Files: `board.tsx`, `issue-drawer.tsx`, `detail-drawer.tsx`, `archive-drawer.tsx`, sign-in/page components, and browser tests. Extract a small controller/hook only if it clarifies ownership; no generalized state platform.
- **Dependency/research:** decide the exact dirty-draft retention behavior for reauthentication during implementation; verify current router/history and auth error contracts from the installed stack. No new account service or database migration is assumed.
- **Done:** the previously reproduced failures are covered and pass; existing creation, movement, assignment, labels, sharing, archive/restore, and authorization checks still pass.

### U2 — A board that prioritizes capture and scanning

**Status: complete locally.** See [U2 delivery](U2-DELIVERY.md) for final behavior, verification, and comparison captures. Depends on U1's stable transitions and covers F05–F07.

- Render the compact desktop/mobile board composition with realistic titles and assigned/labeled cards before propagating shared styles.
- Simplify the recurring hero and toolbar; preserve filter context during capture; fix explicit mobile tab selection.
- Move capture before long lists or provide a clearly associated persistent control.
- Refine cards and editor reading order; keep all keyboard/native move alternatives.
- Resolve the 861–1179 px header/board behavior deliberately and inspect 320, 390, 700, 860, 900, 1180, and 1440 px around affected breakpoints.
- **Dependency/research:** use the existing visual direction. Prepare a synthetic long-title/many-card fixture; actual team volume remains unknown and is a pilot input, not permission for new architecture.
- **Done:** proposed layout targets hold, primary controls remain reachable under reflow and enlarged text, and before/after captures use the same data. Review 320 CSS px reflow against [W3C's criterion](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html); width checks alone are insufficient.

### U3 — Clear shared-state and administrative recovery

**Status: complete locally.** See [U3 delivery](U3-DELIVERY.md) for recovery behavior, verification, and limits. Builds on U1's save and error model; completes F08 and the secondary refinements.

- Distinguish refresh freshness, pending writes, failed writes, and expired sessions; give each a truthful next action.
- Verify create/move/restore failures and recovery with inputs/context retained; expose retry where automatic recovery is insufficient.
- Improve Team and label operation feedback without expanding account policy or tracking scope.
- Test member and administrator surfaces, archived long notes, no results, failed clipboard, offline/401 responses, and return paths.
- **Done:** failures leave a recoverable task, action/status copy agrees with server outcomes, and a focused UI/UX pass finds no remaining in-scope P1 defects.

No calendar estimate is asserted before U1's save-state investigation. These are sequential, reviewable slices; avoid running a large restyling pass in parallel with changes to editor ownership.

## Acceptance scenarios for implementation

| Case | Required evidence |
| --- | --- |
| Edit then leave immediately | Within 700 ms, switch, close, archive, and navigate away. Latest draft persists or an explicit recovery/discard choice retains it. |
| Slow/out-of-order save | Type again during an in-flight save; combine move/metadata with a failed request. Final state reflects acknowledged latest input; no unrelated successful update is rolled back. |
| Failed save + Copy link | “Couldn’t save” remains meaningful; copy announces “Link copied”; retry saves exactly the retained draft. |
| Keyboard overlays | Open, traverse both directions, Escape, archive, restore, and return. Focus never lands behind an obscuring mobile drawer; disappearance of a trigger has a logical fallback. |
| Shared destination | Signed-out active/archived/filter links return to the exact destination; external return URLs are rejected; missing cards get an actionable state. |
| Search and capture | Filters persist through reload/back; explicit zero-result mobile tabs stay selected; new cards receive clear feedback even if hidden by filters. |
| Responsive work | 320 px reflow, 390 × 844, intermediate widths, and desktop: no obscured controls; capture is reachable without scrolling through a long list. Include 200% text enlargement. |
| Movement and recovery | Pointer, keyboard, select, Earlier/Later, archive, Undo, restore, and failure paths retain their meaning and ordering. |
| Permissions | Member/admin actions continue to be enforced at server boundaries, including labels, Team, and export. |
| Project checks | Typecheck, lint, relevant domain/export tests, full authored browser suite against its disposable schema, and production build. Add targeted interaction regressions rather than CSS-value tests. |

Run manual keyboard and rendered checks alongside axe. A screen-reader sample, touch-device check, and Firefox/WebKit checks remain unverified until actually performed; prioritize them against the pilot's device needs. Use the project's test schemas, not destructive setup against the normal application schema.

## Pilot validation and optional later work

After implementation, reuse `PILOT.md`. Observe actual participants attempting neutral tasks: capture newly discovered work, find a shared card after signing in, update context and move it, recover an archived card, and recover from an interrupted save. Record unaided completion, assistance, wrong turns, and uncertainty about saved state. No sessions or participant results have occurred in this review.

Keep archive search, a Mine shortcut, Done collapsing, alternative board representations, and richer onboarding optional until issue volume or repeated pilot tasks justify them. Multi-user edits to the same field need a bounded investigation if observed; do not quietly promise collaborative conflict resolution from independent-field patch tests.

The review and all three upgrade milestones are complete locally. No further implementation is required for this target. The next delivery work is the existing real-team pilot, subject to its TLS hosting, backup, and participant inputs. No deployment or user study is claimed.
