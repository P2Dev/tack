# U3 — Shared-state and administrative recovery

Implemented and verified locally, 2026-09-20. The latest “proceed” authorized the final
milestone in [the UI/UX plan](PLAN.md). WNP-Developer guided completion;
optimize-ux guided recovery transitions; optimize-ui guided feedback placement
and rendered inspection. The existing visual direction and product scope remain.

## Changed experience

| Situation | Result and recovery |
| --- | --- |
| Shared refresh fails | The board says it may be out of date, with persistent Retry refresh. Finishing a write cannot clear that warning. |
| Refresh succeeds | A checked-at time reflects the successful shared read. Overlapping refresh requests are suppressed. |
| A drawer is open | The drawer explains that shared updates are paused. Saving a change is shown separately from shared refresh. |
| Move cannot be confirmed | The previous local view is restored, including the mobile column. Persistent Retry action, Check board, and Dismiss remain available. |
| Capture cannot be confirmed | The title and filters remain; Check board is available before explicitly trying again. There is no automatic resubmission. |
| Session expires | The interrupted form offers sign-in in another tab. The original tab keeps its inputs, then the user retries. U1's stored issue-draft recovery remains available. |
| Label operation fails | Feedback distinguishes 401, 403, validation responses, and unavailable service. Name/color or the removal choice remain in place. |
| Remove label | An inline confirmation names the workspace/every-card consequence and provides Cancel. Pending deletion blocks closing the panel. Success is acknowledged inside the drawer. |
| Restore an archived card | Errors remain outside the long-note/list scroll area. List recovery offers Retry restore; success offers Show restored card, preserving filter context. |
| Change a Team account | Pending, failure, and success feedback appears beside the affected account. New-account feedback stays with its form. Password reset has Cancel and returns focus. |
| Account controls are protected | The current-account/last-admin explanation is visible without hover. Existing policies and server permission boundaries are unchanged. |

The initial visual inspection found duplicate transient and background messages.
Failures now use persistent task-level feedback; a modal shows its own recovery
without also rendering the board's inactive notice or toast underneath it.

## Verification

- Full authored browser suite: **51 passed, 5 intentional skips**, including
  U1/U2 regressions, native movement, archive/Undo, filtered capture, permissions,
  export, the seven-width matrix, and enlarged text.
- After removing duplicate feedback, focused U1/U3 verification: **31 passed,
  1 intentional mobile duplicate skipped**.
- Final label-confirmation focus checks: **4 passed**. Opening confirmation
  focuses Cancel with the consequence as its accessible description; successful
  removal returns focus
  to Label name.
- **20 domain/export/return-path tests passed**. Lint, TypeScript, and the
  production build passed.
- New browser cases cover refresh failure surviving failed and successful writes;
  real cookie expiry and sign-in in another tab; retained label input and pending
  deletion; 401 versus 403 inside the drawer; Team role/password feedback and
  Cancel; new-account input retention; and restore recovery from a long archived
  note and list while preserving filters.
- Axe checks passed in the tested board, label, editor, and Team contexts. The
  member browser also verifies that admin utilities are absent while server
  denial checks remain in place.
- Inspected desktop/mobile failure and administration renders. The read-only
  production check found no page exceptions or horizontal overflow on the board
  at 1440/390 px or Team at 320 px. Original six-card titles/statuses were unchanged.

Browser failures are injected before forwarding requests; recovery successes use
the actual API and isolated PostgreSQL schema. These checks establish the
implemented paths, not representative-user outcomes. The first refresh test was
corrected to await client hydration before dispatching a simulated focus event.

## Review the result

- [Board recovery — desktop](evidence/u3/board-recovery-desktop.png) · [phone](evidence/u3/board-recovery-mobile.png)
- [Account feedback — desktop](evidence/u3/team-feedback-desktop.png) · [phone](evidence/u3/team-feedback-mobile.png)
- [Long archived note recovery](evidence/u3/archive-long-recovery-mobile.png)
- [Label feedback](evidence/u3/labels-feedback-mobile.png)
- [Production phone board](evidence/u3/production-board-390.png)
- [Production verification record](evidence/u3/production-check.json)

U1, U2, and U3 are complete for local delivery. The final scoped UI/UX review
found no remaining in-scope P1 defect. No further implementation is required for
this upgrade target. The next delivery work is the existing real-team pilot:
choose its TLS host and backup destination/retention, deploy and verify that
environment, then collect the observation evidence in `PILOT.md`.

## Delivery boundary

No database migration, framework change, deployment, outbound invitation, or
account-policy expansion was made. Local issue drafts retain the U1 recovery
contract. Other unfinished forms survive while their original tab stays open;
this does not promise quick-capture or password-form recovery after closing or
reloading that tab. Passwords are not copied to browser storage.

A lost response can leave a write's outcome uncertain. There is no new
exactly-once creation protocol or cross-user same-field conflict resolution.
The interface retains input, avoids automatic resubmission, and provides a way
to inspect the board before trying again.

Chromium desktop/mobile emulation and automated accessibility scans do not
establish screen-reader, Firefox/WebKit, or real-device conformance. A real-team
pilot, its TLS host, and backup destination/retention remain external inputs.
