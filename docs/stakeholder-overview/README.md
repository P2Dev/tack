# Tack — UI & UX stakeholder overview

**20 September 2026 · Implemented and verified locally · Pilot launch pending**

[Open the visual presentation](tack-overview.html). It contains embedded screenshots, works offline, and offers reading and presentation modes. Click any screenshot to enlarge it. This Markdown file is the fuller companion write-up.

To share the visual version, send just `tack-overview.html` and open it in a browser. Select **Present**, then use the arrow buttons or Left/Right keys; Escape returns to reading mode. Screenshot enlargement offers **Actual size** for inspecting fine detail. The Markdown companion references screenshots in this workspace.

## What we delivered

Tack is a small, private team board built around a simple action: capture a title and move the card as work progresses. The UI/UX upgrade makes that workflow easier to reach, gives people clearer confidence in saved changes, and provides useful recovery when something fails.

All three planned milestones are complete in the local workspace. The scoped review found no remaining in-scope high-priority defect. The next step is the existing two-week team pilot, after hosting, backups, ownership, participants, and dates are settled. The application has **not been deployed** as part of this work.

![Current Tack desktop board with four statuses, compact heading, and capture above the cards.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/u3/production-board-1440.png)

*Current local production build. The original six cards remain unchanged.*

## Why the experience needed attention

| Observed friction | Delivered change | Intended benefit |
| --- | --- | --- |
| A large heading and stacked controls pushed the work down; capture followed the cards. | Compact heading, capture above the list, clearer phone navigation. | People can reach everyday work sooner. |
| Save and copy feedback could conflict; interrupted edits were difficult to recover. | Coordinated saves, retained drafts, separate copy status, explicit retry/discard. | People can tell whether their work was saved and recover deliberately. |
| Filters, shared updates, and failures could disrupt the current task or leave an unclear next step. | Retained view context, persistent recovery actions, separate refresh and write status. | People can continue from an understandable state. |
| Administration feedback was detached from the affected action. | Account-specific feedback, visible protection reasons, and cancellable confirmations. | Administrators can see what happened and what to do next. |

These are observed interface and behavior changes. Faster task completion, adoption, and user confidence still need to be evaluated with the pilot team.

## 1. Put capture and the board first

The recurring introductory hero is replaced by “Engineering board.” On desktop, the four columns appear together. Below 1180 CSS pixels, people select one status at a time. The phone header keeps a labeled **New card** action, with secondary actions under **Options**.

Capture now appears before each column’s list. Card titles and controls are larger. Phone filters collapse behind a labeled control, while active filter chips remain visible. Title and description are grouped first in the editor, before optional metadata.

| Before — 390 × 900 | After U2 — 390 × 900 |
| --- | --- |
| ![Before: introductory copy and filters consume most of the phone viewport; capture is below it.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/board-390.png) | ![After: compact controls, visible status selection, capture above the first card.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/u2/board-390.png) |

The controlled comparison used the same original six cards, equal viewport sizes, and the selected **In progress** column. Positions below are measured from the top of the viewport and rounded to the nearest CSS pixel.

| Viewport width | Column starts: before → after | Capture starts: before → after |
| --- | --- | --- |
| 1440 px | 353 → 248 px | 606 → 333 px |
| 900 px | 360 → 335 px | 1149 → 420 px |
| 390 px | 589 → 310 px | 912 → 391 px |
| 320 px | 596 → 355 px | 919 → 436 px |

At 390 × 844, capture and the first card are visible together. These measurements demonstrate layout changes; they do not measure time saved. Baseline screenshots used a development build; the comparison after U2 used a production build. The small development indicator is not application UI.

## 2. Make editing and navigation trustworthy

Title and description saves are coordinated. Closing, archiving, and other conflicting actions wait for the latest text. Failed saves keep the draft in the editor with **Retry save** and **Discard changes**. Copying a link has its own confirmation, so “Link copied” cannot imply that a failed edit was saved.

Unsaved issue title/description drafts can be recovered in the same tab and account for up to 24 hours. Recovered text is presented for review and is not automatically submitted. Dialogs contain keyboard focus, provide a consistent Escape path, and return focus to the task. Shared card links and filters survive sign-in.

![U1 recovery evidence: Link copied is separate from Not saved, with Retry save and Discard changes.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/u1/save-recovery-mobile.png)

*Controlled failure fixture from U1, before U2 rearranged the editor. The screenshot documents the save/copy behavior, not the final editor layout.*

This is same-tab draft recovery, not offline synchronization or cross-device saving. Other unfinished forms survive while the original tab stays open; closing or reloading it has no equivalent recovery guarantee. Passwords are not stored in browser storage. Cross-user changes to the same field do not have a new conflict-resolution mechanism.

## 3. Preserve context and explain recovery

Creating a card retains the current filters. If those filters hide the new card, a persistent notice offers **Show card** or **Clear filters**. A deliberately selected empty status remains selected, so the board does not unexpectedly switch away from the user’s choice.

Shared refresh status is separate from saving. If updates fail, the board says it may be out of date and offers **Retry refresh**. An unrelated successful save cannot clear that warning. A failed move restores the previous local view and offers **Retry action**, **Check board**, and **Dismiss**.

![Two distinct recovery notices: shared updates unavailable and a move that could not be confirmed.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/u3/board-recovery-desktop.png)

*U3 controlled failure fixture. Sample card names and counts belong to the test environment.*

After an uncertain create response, the title remains available and the user can check the board before explicitly trying again; the application does not resubmit automatically. An expired session offers sign-in in another tab while the original form remains open. Archive restoration keeps errors and recovery controls outside long scrolling notes.

## 4. Keep administrative feedback beside the action

Team operations show pending, success, and failure states beside the affected account. Password changes have **Cancel**, and account-protection explanations are visible without hovering. New-account errors stay with the creation form.

![Team access: failed password update remains beside the affected sample account, with input retained and Cancel available.](/Users/pauldemers/Desktop/min_iss/docs/ui-ux-review/evidence/u3/team-feedback-desktop.png)

*U3 synthetic account fixture, scrolled to the affected row. Example names and addresses are test data.*

Label removal now explains its every-card consequence before confirmation. Cancel receives initial focus, and success returns focus to the label input. Existing permission boundaries remain in place.

## What the verification establishes

| Evidence | Recorded result |
| --- | --- |
| Full browser suite | **51 passed; 5 intentional skips** |
| Focused checks after feedback cleanup | **31 passed; 1 intentional duplicate skipped** |
| Final label-confirmation focus checks | **4 passed** |
| Domain, export, and sign-in return-path tests | **20 passed** |
| Static checks and production build | Lint, TypeScript, and build passed |
| Responsive checks | Seven widths from 320 to 1440 px; 200% text also exercised |
| Automated accessibility | Axe checks passed in tested board, label, editor, and Team states |
| Final production inspection | No horizontal overflow or page exceptions on board at 1440/390 px or Team at 320 px; original six cards unchanged |

The focused runs overlap the full suite and must not be added into one test total. Browser verification used Chromium, including mobile emulation, controlled failures, and real API persistence during recovery. It does not establish physical-device, Firefox/WebKit, screen-reader, or representative-user coverage. No measured productivity improvement or accessibility-conformance claim is made.

## What remains before and during the pilot

The product still uses **Backlog → Ready → In progress → Done**, with title-only capture and optional description, assignee, and labels. Review, QA, and discussion remain in the team’s existing tools. This upgrade introduced no framework change, database migration, or account-policy expansion.

| Stage | Needed action | Completion evidence |
| --- | --- | --- |
| Assign the pilot | Name an owner and operations contact; choose participants and dates. | Completed pilot details and a feedback-log location. |
| Prepare operations | Choose the TLS host, off-host backup destination, and retention period. | Healthy deployed service, successful backup and restore drill, inspected export. |
| Run for two weeks | Give a ten-minute introduction; observe on days 2, 7, and 14. | Concrete attempts, friction, workarounds, and repeated problems. |
| Decide the next change | Review capture, find, move, and saved-state confidence. | An evidence-based decision and at most one next product improvement. |

The pilot should answer whether participants can create, move, and find cards without help; whether they trust saved and shared state; and whether recurring workarounds reveal a missing capability. Operational defects or suspected data loss get immediate attention. Broader feature requests wait for evidence.

## Supporting records

- [Original review and milestone plan](../ui-ux-review/PLAN.md)
- [U1: editing and navigation delivery](../ui-ux-review/U1-DELIVERY.md)
- [U2: capture and scanning delivery](../ui-ux-review/U2-DELIVERY.md)
- [U3: recovery delivery and latest verification](../ui-ux-review/U3-DELIVERY.md)
- [Controlled layout measurements](../ui-ux-review/evidence/u2/comparison.json)
- [Final production check](../ui-ux-review/evidence/u3/production-check.json)
- [Two-week pilot checklist](../../PILOT.md) and [current roadmap](../../ROADMAP.md)

U1 and U2 records retain their historical next-step notes. U3 and the current roadmap establish that all three milestones are now complete locally. This overview summarizes existing project evidence as of 20 September 2026; preparing it did not rerun the application test suite or deploy the application.
