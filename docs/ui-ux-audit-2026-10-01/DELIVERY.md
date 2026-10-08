# Tack UI/UX improvements — October 1, 2026

The eight findings in [the audit](AUDIT.md), plus its smaller clarity improvements, are implemented. The existing visual style, shared board access, local accounts, provider configuration, and permanent card-key aliases are retained.

## What changed

| Finding | Delivered behavior |
| --- | --- |
| F01: capture loss | Unsent titles are retained in tab storage for up to 24 hours, separately for each account, board, and column. Team navigation, board switching, sign-out/sign-in, and reload restore them without submitting them. A recovered title offers Discard; successful creation clears it. Storage failure is explained and ordinary navigation offers a leave guard. |
| F02: search scope | Search explicitly covers active cards on the current board. Entering a full key exposes an action to open that card across boards and archives, including historical aliases. Enter also runs that lookup. Title filtering remains board-local. |
| F03: empty narrow entry | The first view uses a populated In progress column, otherwise the first populated column or Backlog. Explicit column choices persist per account and board for the tab and are not overridden by filtering. |
| F04: card history | Opening a card creates a history entry. Back saves before closing to its original board and filters; failed saves retain the editor. Forward reopens it. Direct links retain an explicit Close-to-board fallback. |
| F05: export scope | Team explains workspace-wide access. Export workspace describes JSON’s boards/cards/labels/account profiles and CSV’s cards from every board, including archived cards. |
| F06: editor hierarchy | Status, assignee, and labels precede the expandable move/reorder controls. The initial footer explains autosave. Transfer retains its key-change warning and uses client navigation. |
| F07: board administration | Existing boards precede an expandable Add form. Refreshed active/archive counts explain removal eligibility; Open board and View archive lead to remaining work. The Boards panel includes an administrator entry. Server removal protections remain in force. |
| F08: keyboard return | Board management restores focus after modal teardown to Options or its sidebar trigger, with the header toggle as the mobile-panel fallback. |

Smaller changes standardize Card details/Description wording, explain administrator-assisted sign-in help, tailor sign-in text to configured providers, add a panel-toggle tooltip, and give the current board a system-color outline in forced colors.

## Verification

- Typecheck, lint, 33 unit/integration tests, and the Docker production build passed.
- The final full desktop/mobile Chromium suite passed **71 checks**, with **5 intentional duplicate/desktop-only skips**. It covers capture retention, save failure and retry, ordered Back/Forward navigation, direct links, cross-board alias/archive lookup, transfers without document reloads, board counts and focus, responsive layouts, 200% text, and existing account/provider/permission flows.
- The production app at `http://localhost:3000` passed overflow checks at 1440, 1280, 1180, 1179, 1100, 900, 700, 390, and 320 CSS pixels. Board, editor, and manager axe scans found zero violations; keyboard return to Options passed; no page errors were recorded. See [check results](delivery-evidence/checks.json).
- Read-only before/after hashes match for 2 boards, 7 cards, 8 key records, 4 labels, and their card-label relationships. Test writes used only disposable schemas.

## Screenshots

- [Desktop board](delivery-evidence/board-1440.png)
- [Phone board with a populated default column](delivery-evidence/board-390.png)
- [320-pixel layout](delivery-evidence/board-320.png)
- [Routine card fields and autosave guidance](delivery-evidence/editor-390.png)
- [Board counts, removal prerequisites, and archive links](delivery-evidence/manager-390.png)
- [Workspace export wording](delivery-evidence/export-scope.png)
- [Current board in forced colors](delivery-evidence/forced-colors.png)

## Review guide

1. Leave a new-card title unsent, visit Team, and return. Switch boards and back as well.
2. Search a complete current or former key and use the cross-board action.
3. Open a card, edit it, then use browser Back and Forward.
4. Open Manage boards from Options or the Boards panel. Inspect counts, removal guidance, and archive links; press Escape to check focus return.
5. At phone width, compare the initial populated column and the remembered selection after reload.

Capture recovery is tab-scoped and expires after 24 hours. Automated browser coverage uses Chromium desktop and mobile emulation; live Cognito tenant acceptance and real screen-reader testing remain separate deployment/pilot checks.
