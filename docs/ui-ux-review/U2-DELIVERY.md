# U2 — Capture and scanning

Delivered in the local workspace on 2026-09-20. This implements the second
milestone in [the UI/UX plan](PLAN.md), authorized by “proceed.” The warm visual
direction and the four-status, title-only product boundary are retained.

## Changed experience

- A compact Engineering board heading replaces the recurring explanatory hero.
  The primary New card action stays labeled on phones. Archive, Team, labels,
  account identity, and sign-out are grouped under Options.
- Four columns appear from 1180 CSS pixels upward. Smaller widths show an
  explicit status selector and one column, avoiding the former two-by-two layout.
- Capture precedes each column's list. New card and C select Backlog without
  clearing search, assignee, or label filters. Creation reports its destination.
  A newly created card hidden by filters has a persistent Show card / Clear
  filters notice, with an explicit dismiss action.
- A chosen empty column stays selected for the current filter view. Its empty
  state names the column and offers Clear filters. New filter views can initially
  select a matching column. Shared refreshes do not override an explicit choice.
- Phone filters collapse behind a labeled control with an active count; removable
  chips keep selected values visible. Native controls and shareable URLs remain.
- Card titles, secondary metadata, and status controls are larger; “Title only”
  is removed. Drag handles and native status controls remain available.
- The editor puts Title and Description together before Status, Assignee, Labels,
  and ordering. Save/recovery feedback remains outside the scrolling body.

## Evidence

The original six-card board is preserved in the before/after comparison. The
browser suite uses its disposable schema and a separate long-title, many-card
fixture. The baseline was a development render; the final same-data captures
come from the production build. Development indicators are excluded from product
judgment. Before/after pairs use the same widths and 900 px height; a separate 390 × 844
capture verifies the phone acceptance target. Capture positions refer to the
selected In progress column. Measurements are rounded to the nearest CSS pixel.

| Width | Column top before → after | Capture top before → after |
| --- | --- | --- |
| 1440 | 353 → 248 | 606 → 333 |
| 900 | 360 → 335 | 1149 → 420 |
| 390 | 589 → 310 | 912 → 391 |
| 320 | 596 → 355 | 919 → 436 |

At 390 × 844, capture and the first card are visible together. At 1440 × 900,
the column starts within the planned 250 px target. At 900 px the header no
longer overlaps, and In progress is immediately available in the selected column.
No horizontal overflow was detected at the seven tested widths: 320, 390, 700,
860, 900, 1180, and 1440.

- Full browser suite: **37 passed, 5 intentional skips**. The skips are mobile
  duplicates of desktop-only drag/concurrency and the width matrix.
- After final enlarged-text styling: **7 focused U2 checks passed, 1 intentional
  duplicate skipped**. This includes a check for overflowing status-button text
  and actual capture with enlarged text, in addition to document-width checks.
- **20 domain/export/return-path tests passed.** Typecheck, lint, and production
  build passed.
- Axe checks passed for the board, labels, restored editor, and disclosed filters
  in the authored desktop/mobile contexts. Native disclosure keyboard operation,
  Escape, drawer focus return, and existing move/archive/Undo flows passed.
- Inspected responsive, filtered-empty, Options, editor, and 200% text renders.
  Final read-only production capture reported no page exceptions.

The initial test run exposed an obsolete drag-fixture viewport assumption and
new test-selector/timing issues. Those were corrected before the passing full
run. Visual inspection also caught crowded enlarged status text; it now reflows
into fewer columns, with content-sized counts.

## Review the result

- Desktop: [before](evidence/board-1440.png) · [after](evidence/u2/board-1440.png)
- Phone: [before](evidence/board-390.png) · [after](evidence/u2/board-390.png)
- Tablet: [before](evidence/board-900.png) · [after](evidence/u2/board-900.png)
- [390 × 844 phone](evidence/u2/board-390x844.png)
- [Filtered empty column](evidence/u2/filtered-empty-390.png)
- [Editor](evidence/u2/fixture-editor-390.png)
- [200% text](evidence/u2/fixture-text-200-percent.png)
- [Same-data measurements](evidence/u2/comparison.json)

U2 is complete for local delivery. No further work is required for this target.
The next proposed milestone is U3.

## Boundaries

This is a local source delivery, with no deployment. The viewport and interaction
checks use Chromium, including a mobile emulation; they do not establish
screen-reader, Firefox/WebKit, or physical-device coverage. There has been no
representative-user study or measured task-time improvement. U3's shared-state
freshness and administrative recovery work remains separate, as do pilot hosting,
backup, and participant inputs.
