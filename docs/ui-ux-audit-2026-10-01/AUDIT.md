# Tack UI/UX audit and improvement plan

**Reviewed: October 1, 2026 · Original audit**

The findings below record the pre-change interface. All remedies were subsequently authorized; see [implementation and verification](DELIVERY.md).

The interface has a coherent visual identity and a usable core workflow. The next improvements should make work easier to find and navigation more predictable. A broad visual redesign is not warranted by this review.

The most consequential confirmed gap is an unfinished quick-capture title disappearing during a trip to Team. Several controls also retain assumptions from the earlier single-board application: search, export wording, card history, and board administration do not consistently communicate their scope.

## Priority overview

| ID | Severity | Finding | Evidence confidence | Recommended treatment |
| --- | --- | --- | --- | --- |
| F01 | High | An unfinished new-card title disappears after visiting Team | Confirmed interaction | Retain capture drafts across navigation or guard every departure consistently |
| F02 | Medium | Search does not explain its scope or find former card keys | Confirmed interaction and source | Label board-local search; provide exact-key lookup across boards and aliases |
| F03 | Medium | Narrow layouts can start on an empty column while the board has work | Confirmed at several widths | Remember the selected column per board; use a useful first-entry default |
| F04 | Medium | Back from a card jumps to the previous board | Confirmed interaction | Give card opening a history entry and guard history-driven exits |
| F05 | Medium | “Export the board” exports the entire workspace | Confirmed UI and response | State the export scope accurately before download |
| F06 | Medium | Moving a card to another board precedes routine status/assignment fields | Confirmed layout; priority is an expert judgment | Put routine metadata ahead of the transfer action |
| F07 | Medium | Board removal explains a prerequisite without helping users satisfy it | Confirmed layout/source; error response simulated | Show active/archive counts and routes to the remaining cards |
| F08 | Medium | Closing Manage boards drops keyboard focus to the page body | Confirmed keyboard interaction | Restore focus after the modal closes |

“High” means a material risk to task completion or trust, not a confirmed loss of saved database records. No critical task blocker was found in the sampled flows. Reach and frequency are inferred from the product's small-team workflow; no participant study or analytics was supplied.

## What is working

- The warm palette, restrained status colors, readable titles, and compact card layout form a consistent interface. Keep them.
- Desktop board navigation exposes names and IDs, marks the current board, and can be hidden without losing the selected board.
- The recent client-side board switching and desktop visibility preference address the previously reported navigation friction.
- Search/filter chips make applied filters removable. Column-specific capture remains reachable above the card list.
- Card-save failure gives a truthful explanation, preserves the text, and exposes Retry and Discard in a fixed recovery area. A simulated failed save remained usable at 320 pixels.
- Native modal drawers contain interaction. The mobile Boards panel supports keyboard dismissal; most existing drawer behavior follows the same convention.
- No horizontal page overflow was found at the nine sampled widths. Seven axe scans reported no automated violations. These checks did not catch F08, which required an actual keyboard walkthrough.

## Findings and proposed remedies

### F01 — Unfinished capture is protected inconsistently

**High · New-card capture, demonstrated for an administrator · Confirmed**

At 1440 × 900, enter a title in Backlog without submitting, choose **Options → Team**, then use **Back to board**. The title is empty on return; no discard prompt appears. Switching boards already asks before discarding that same input, so two ordinary navigation paths have different protection.

The input lives only in local component state in [board-column.tsx](/Users/pauldemers/Desktop/min_iss/src/components/board-column.tsx:44). The guard exists specifically in [switchBoard](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:568); the [Team link](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:928) does not use it. This finding concerns unsubmitted text, not loss of a saved card.

**Recommendation:** Prefer retaining short capture drafts by account, board, and column in bounded tab storage. Clear a draft only after confirmed creation or explicit discard. If retention is deferred, apply a consistent leave guard to Team, sign-out, board switching, and browser departures. Explain when input has been recovered.

**Acceptance:** Type without submitting, visit Team, return, and recover the exact title. Repeat with Back, reload, board switching, and a failed create. Confirm that drafts cannot appear under another board or account and that successful submission clears them.

Evidence: [before Team](evidence/14-quick-draft-before-team.png), [after returning](evidence/15-quick-draft-after-team.png), [recorded interaction](evidence/flow-observations.json).

### F02 — Search says “key or title” but only searches current active cards

**Medium · Finding existing or moved work · Confirmed**

Searching `TST-1` from Engineering returns “0 of 5 cards shown,” with no suggestion that another board contains it. More surprisingly, searching its former key `TCK-1` on the destination Test board returns “0 of 2 cards shown,” although the direct old-key link resolves correctly to `TST-1`.

The [filter](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:315) examines only the current board's active cards and their current key/title. Historical aliases are available on the issue model but are not searched. Archive content is outside this filter as well.

**Recommendation:** Label the field **Search this board** and clarify that the view contains active cards. Treat a complete key specially: resolve it across boards, aliases, and archived items, or offer an explicit **Open card TCK-1** action using the existing deep-link resolver. Preserve board-local title filtering. A global fuzzy-search service is not required for this improvement.

**Acceptance:** A current key on another board and a former key both lead to the correct card. Archived-key lookup identifies the archived state. Ordinary title search remains local and explains a zero-result state accurately.

![A valid historical key produces no search results](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-audit-2026-10-01/evidence/04-old-key-search.png)

### F03 — Narrow entry can look empty even when the board has cards

**Medium · Mobile, tablet, and smaller desktop windows · Confirmed**

The current Engineering board has five active cards and zero In progress cards. At 1179, 1101, 1100, 900, 390, and 320 pixels, its initial view selects **In progress**, showing “Nothing here yet” and no cards. The status counts provide a workaround, but the first screen is a poor summary of the existing work. This also occurs immediately below the four-column breakpoint.

[visibleMobileStatus](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:339) defaults to `in_progress` when there is no explicit selection or search match.

**Recommendation:** Remember the user's explicit column selection per board. On first entry, use In progress when populated, otherwise the first populated status; use Backlog for an entirely empty board. Never override a deliberately selected empty status during refresh or filtering. Optionally make the empty copy point to other populated columns.

**Acceptance:** Opening the current fixture exposes a populated column without another tap. An explicitly selected empty Done column remains selected through refresh. Truly empty boards still offer a clear creation path.

![Five active cards, but the initial narrow view shows an empty column](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-audit-2026-10-01/evidence/board-390.png)

### F04 — Card details do not behave like a history step

**Medium · Returning from a card · Confirmed**

Navigate from Test to Engineering, open `TCK-2`, then press browser Back. The interface returns to **Test**, rather than closing the card on Engineering. Board navigation creates a history entry, while [opening a card replaces that entry](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:513).

**Recommendation:** Opening a card should create a meaningful history step. Back should close it to its originating board and filters; Forward should reopen it. A direct card link needs an explicit Close fallback to its board. Reuse the editor's save/recovery contract when history navigation happens during edits; do not implement history behavior independently of draft handling.

**Acceptance:** Board A → Board B → card → Back lands on B; another Back lands on A. Verify Forward, direct links, filters, pending saves, failed saves, and explicit discard.

Evidence: [card before Back](evidence/16-card-before-back.png), [destination after Back](evidence/17-card-after-back.png), [flow log](evidence/flow-observations.json).

### F05 — Export and access wording still imply one board

**Medium · Administrator data export and access decisions · Confirmed**

Team labels its download area **Export the board**. The response contains cards from both `TCK` and `TST`. The same page says accounts control access to “the shared board,” while membership actually covers every board.

The [UI copy](/Users/pauldemers/Desktop/min_iss/src/components/team-manager.tsx:406) is narrower than the [export implementation](/Users/pauldemers/Desktop/min_iss/src/lib/export.ts:63). There was no unauthorized access finding: the problem is that an administrator may misunderstand what they are downloading or granting access to.

**Recommendation:** Rename this to **Export workspace**, explicitly list all boards, active/archived cards, labels, and account profiles, and describe Team access as workspace-wide. Add an export scope selector only if board-only exports become a concrete need.

**Acceptance:** A person can identify the scope before clicking JSON or CSV; labels agree with both actual responses. Existing admin-only authorization remains unchanged.

![Export wording does not reveal that all boards are included](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-audit-2026-10-01/evidence/20-export-scope.png)

### F06 — The editor gives transfer higher placement than routine metadata

**Medium · Editing status and assignment · Layout confirmed; frequency assumption stated**

The editor orders fields as Title → Description/preview → **Move to board** → Status → Assignee → Labels → Position. With two boards, a 104-pixel transfer section is always present even when unused. At 390 × 844, Status starts around y=695 and Assignee falls below the scrolling body's visible boundary. On desktop at 844 pixels high, the status control is largely below that body's boundary as well. These controls remain reachable by scrolling; they are not permanently blocked.

The placement comes from [issue-drawer.tsx](/Users/pauldemers/Desktop/min_iss/src/components/issue-drawer.tsx:173). Treating status and assignment as more frequent than cross-board transfer is an expert assumption to validate with actual users.

**Recommendation:** Keep title/description prominent, then status, assignee, and labels. Put **Move to another board** and ordering behind a secondary disclosure or action area. Add concise initial autosave guidance; currently the footer may be blank before any edit. Retain the fixed recovery/footer behavior, which worked well in the error check.

**Acceptance:** At 390 × 844 and desktop height 844, routine metadata is reached before transfer controls. Transfer remains discoverable and preserves its key-change warning. Save failure actions remain visible when secondary sections expand.

![Cross-board transfer appears before status and assignment](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-audit-2026-10-01/evidence/editor-390.png)

### F07 — Board removal lacks a path from the error to the remaining work

**Medium · Board administration · Layout/source confirmed; error display simulated**

Manage boards begins with a large creation form. Existing board rows have names, IDs, and Remove actions, but no active/archive counts. A nonempty board can proceed to confirmation and then receive “Move all active and archived cards…” without a link to those cards. The rule is explained, but the interface does little to help complete the prerequisite.

The [manager](/Users/pauldemers/Desktop/min_iss/src/components/board-manager-drawer.tsx:40) only receives board metadata. The displayed refusal was injected with the same message used by the server; no real removal request was issued during this audit.

**Recommendation:** Give each board row active/archive counts and **Open board** / **View archive** actions. Show why removal is unavailable before confirmation, while retaining the server-side final check. Make board administration discoverable from the Boards panel, using a labeled admin entry rather than another collapse icon. Consider placing the board list before an expandable Add form when the user arrives to manage existing boards.

**Acceptance:** An administrator can identify which cards prevent removal and reach the relevant list directly. Archived cards cannot be overlooked. Empty/last-board protections and permanent ID reservation remain intact.

Evidence: [manager first view](evidence/06-manage-boards-top.png), [simulated refusal](evidence/08-board-removal-error.png).

### F08 — Manage boards loses the keyboard return point

**Medium · Keyboard navigation · Confirmed**

Open **Options → Manage boards**, then press Escape. Focus becomes `BODY`; the next Tab starts at the header's panel toggle instead of returning to Options.

The [close handler](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:1182) tries to focus the background trigger before the native modal has closed. This is the same class of timing issue already addressed in mobile board navigation.

**Recommendation:** Restore focus after modal teardown, preferably through a shared drawer return-focus contract. Choose an explicit fallback when the original trigger no longer exists.

**Acceptance:** Escape and the close button both return focus to Options. Verify forward/reverse Tab, narrow layouts, pending operations, and dialogs whose originating card disappears. A passing axe scan is not sufficient for this check.

Evidence: [recorded active element and next Tab](evidence/flow-observations.json).

## Smaller clarity and consistency opportunities

These are secondary to the eight findings above:

- **Vocabulary:** The board says “card,” the editor says “Issue details,” and description content is also called a “note.” Use “Card details” and a consistent description label in user-facing copy; internal issue terminology can remain.
- **Sign-in copy:** With no organization provider configured, the page still mentions organization sign-in. Show copy that matches the available methods and explain administrator-assisted access/password recovery. No new self-service recovery backend is implied.
- **Navigation affordance:** The icon-only panel toggle has an accessible name, but no visible “Boards” cue or tooltip. Add a tooltip and consider a compact label where space permits. Actual discoverability has not been measured with participants.
- **Forced colors:** Both board-navigation rows render with similar black borders and text; the usual selected inset shadow disappears. Add a non-color current-board cue or system-color outline. The board title still identifies the current location.
- **Transfer consistency:** [Cross-board card transfer](/Users/pauldemers/Desktop/min_iss/src/components/board.tsx:576) still uses a full document navigation, whereas ordinary board switching now uses client navigation. This is source-confirmed; no live transfer was performed in the normal data during this audit. Align the transition when next touching that flow.

Do not add themes, dashboards, charts, bulk transfer, or a new search platform just to address these findings. They are not necessary for the proposed first improvements.

## Proposed implementation sequence

| Slice | Work | Exit condition |
| --- | --- | --- |
| 1. Predictable navigation and data scope | F01 capture retention/guards; F04 card history; F08 focus restoration; F05 accurate export/access copy | No unexplained loss of an unfinished capture; Back/Forward and modal close have predictable destinations; download scope is explicit |
| 2. Find the existing work | F02 scoped search plus exact-key resolution; F03 per-board column choice | Current/former keys resolve across boards; first narrow entry exposes existing work without overriding user selection |
| 3. Easier editing and administration | F06 editor ordering; F07 counts and removal guidance; related terminology polish | Routine editing precedes rare actions; an administrator can identify and reach the work blocking removal |

These are proposed changes, not implemented work. Keep the current visual language and the existing local-account, provider, board-key, archive, and permission policies. Each slice should have focused desktop/mobile and keyboard checks; run the full existing suite before integrating a completed slice.

## Audit method and boundaries

The audit used the running production build at `http://localhost:3000`, source inspection, and scripted browser walkthroughs. The normal data contained two boards; Engineering had five active cards, no archived cards, and an empty In progress column. A moved card in Test supplied a real old-key example.

| Surface / state | Coverage | Result |
| --- | --- | --- |
| Board and navigation | 1440, 1280, 1180, 1179, 1101, 1100, 900, 390, 320 CSS pixels; authored light theme | No page overflow; F02/F03 observed |
| Card editor | 1440 × 844 and 390 × 844 | F06; controls remain reachable by body scrolling |
| Save recovery | Simulated 503; 1440 and 320 pixels | Draft retained; Retry/Discard visible; no horizontal overflow |
| Board management | 390 × 844, simulated nonempty-board refusal, keyboard Escape | F07/F08 |
| Team / export | Desktop and narrow; read-only JSON response inspection | F01/F05 |
| Sign-in, mobile navigation, labels, archive | Rendered inspection; archive was empty | No new blocker observed in sampled states |
| Text enlargement | 200% text at 390 × 844 | No horizontal overflow; lower capture position requires scrolling |
| Forced colors / reduced motion | Chromium emulation | Current-board visual cue needs attention; no motion-heavy flow present |
| Automated accessibility | Seven states, axe-core Playwright 4.12.1 | Zero detected violations; manual focus issue still present |

Browser: Chromium 151.0.7922.34 through Playwright 1.62.0. Desktop viewport sweep used height 900; focused narrow/editor cases used height 844. Editor bounding boxes in the raw metrics describe viewport coordinates and do not account for clipping by the scrolling body; the findings use the rendered screenshots for that distinction.

Application mutations were intercepted in the audit browser. The failed-save and board-removal errors were simulations; successful create/remove/transfer operations were not repeated against normal data. The current board snapshot matched before and after the walkthroughs. No application code, board/card content, account configuration, or deployment settings were changed.

This is an expert audit, not a representative-user study or accessibility conformance assessment. No screen reader, physical mobile device, Firefox/WebKit, live Cognito login, large-board load test, or complete member-account walkthrough was performed. No new build or regression suite was needed for this report-only task. Existing test results are background evidence, not a substitute for the observations above.

Raw evidence: [layout/accessibility observations](evidence/observations.json), [flow observations](evidence/flow-observations.json), [browser and labels check](evidence/additional-observations.json).

## Suggested user validation after the fixes

Ask a few actual team members to find a moved card from its former key, resume an unfinished capture after visiting another page, change a card's assignee on a phone-sized view, return from card details using Back, and explain what an export contains before downloading it. Record wrong turns and requests for help; do not treat a shorter click path alone as proof of improvement.
