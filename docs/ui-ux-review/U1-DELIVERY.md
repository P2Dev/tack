# U1 — Trustworthy edits and navigation

Delivered to the local workspace on 2026-09-20. Status: implemented and verified;
not deployed. U2 and U3 remain separate proposed milestones.

## Delivered behavior

- Title and description have one coordinated save sequence. New typing during
  an in-flight request remains pending until its own save succeeds. Close and
  Archive wait for the latest text, as do metadata and movement actions.
- Every drawer is modal: the background board is inert, keyboard focus wraps,
  Escape uses the same close path, and focus returns to a visible task control.
  Switching cards now requires closing the current editor, preventing the
  former unguarded switch/unmount path.
- Failed text saves retain the editor and expose Retry save and Discard changes.
  Blank titles can be corrected or explicitly discarded. Copy feedback and
  selectable-link fallbacks are independent of persistence status.
- Save errors, copy feedback, move errors, and move Undo stay visible and usable
  inside the editor. Pending operations disable conflicting controls.
- A local write queue serializes board mutations, so an old snapshot rollback
  cannot erase another simultaneous local write. Untouched text fields adopt
  newer shared snapshots without replacing this tab's dirty fields.
- Archive and restore wait for the server outcome. Archived detail uses the
  shared drawer, renders Markdown, returns to Archive with focus when opened
  there, and retains restore errors. Successful restoration keeps the restored
  card open for review.
- Active and archived issue links, search, assignee, and label context survive
  sign-in. Only owned local routes are allowed as return destinations. Missing
  keys explain the result and offer the board with its filters retained.

## Interrupted drafts

Unsaved title/description fields are stored in this tab's session storage,
scoped to the signed-in account and card, with a 24-hour validity limit. They
are cleared after successful saving or explicit discard. Reloading or opening
the card after reauthentication restores the draft for review; it is not
automatically committed. Unload attempts while dirty receive the browser's
standard warning. If session storage is unavailable, the editor explains that
the user should copy the text before leaving.

This is recovery for the same tab/account, not cross-device drafts or offline
synchronization. Browser tab termination is not promised to save to the server.
Existing replace-state issue URLs remain; a broader Back/Forward navigation
redesign has not been introduced. In-app Team/sign-out/background-card controls
are inert until the modal editor is closed. Drafts surviving other navigation
are recovered when that card is reopened.

## Verification

| Check | Result |
| --- | --- |
| TypeScript / ESLint | Passed |
| Production Next.js build | Passed |
| Store, export, and safe-return tests | 20 passed |
| Full desktop/mobile browser suite | 30 passed; 4 intentional mobile skips |
| Focused browser pass after final feedback/shared-field refinements | 9 passed; 1 intentional mobile skip |
| Keyboard, Escape, archive return, native modal state | Passed in desktop/mobile Chromium |
| Axe scans: board, labels, restored editor | No detected violations in tested states |
| Real persistence and independent two-session field edits | Passed |
| Controlled delayed writes, failed saves/restores/moves, clipboard denial | Passed |
| Real unauthorized save → sign-in → draft recovery | Passed |

Tests used the existing disposable PostgreSQL schemas. Application data was
not replaced. No schema migration, dependency addition, account-policy change,
production deployment, or user recruitment was required.

## Rendered review

The final review used the same failure sequence that produced the original
false Saved report: fail a title save, then copy its link. The updated UI shows
**Link copied** separately from **Not saved**, with Retry and Discard visible.
Both desktop and mobile captures were visually inspected. These are functional
test fixtures, not a claim of measured usability improvement.

- [Desktop recovery](evidence/u1/save-recovery-desktop.png)
- [Mobile recovery](evidence/u1/save-recovery-mobile.png)
- [Original failure capture](evidence/failed-save-copy.png)

Screen-reader use, real touch hardware, Firefox/WebKit, representative-user
understanding, and same-field multi-user conflict resolution remain unverified.
The broader board-density/mobile-filter work belongs to U2, and refresh
freshness plus wider administrative recovery remain in U3.

No further work is required for U1. The next proposed milestone is **U2 — A
board that prioritizes capture and scanning**.
