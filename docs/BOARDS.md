# Boards and issue keys

Use the **Boards** panel on the left to switch boards. Each entry shows its name and ID, and the current board is highlighted. The panel button beside the Tack logo hides or shows navigation; desktop visibility is remembered in this browser. On narrower screens, navigation starts closed and opens as a panel from the left. Close it with its close button or Escape. Hiding navigation keeps the current board and any unfinished capture title in place.

Each board has an immutable ID such as `ENG` and a display name. IDs use 2–10 uppercase letters or numbers, starting with a letter. Administrators use **Options → Manage boards** to add or remove boards. All members can view and use all boards; board-level membership is outside this change. Team accounts and labels are workspace-wide.

A title-only card receives the next number in its board: `ENG-1`, `ENG-2`, and so on. Sequences are independent. The existing Engineering board migrates to `TCK`, retaining its cards, numbers, descriptions, assignments, labels, and archived state.

## Move a card

Open a card, expand **Move to another board or reorder**, and choose **Move to board**, review the consequence, then select **Move card**. Unsaved title/description edits must save successfully before the move proceeds. The destination opens with that card selected.

The card receives the next destination-board number. Its internal ID stays unchanged, as do its status, notes, assignee, labels, and archived state. Active cards go to the end of the destination status column; the source gap closes. Archived cards can be moved directly from their archived detail view.

Every former key remains an alias. A link to `TCK-12` follows the card after it becomes `ENG-3`, including after another move. Returning it to TCK gives it a new TCK number; previous numbers are never reused. Failed transfers retain the selected destination. Retrying the same destination after a lost response does not allocate another key. If another person has since moved the card somewhere else, a stale source-board mutation is rejected.

## Remove a board

Move every active **and archived** card out first. Then use **Manage boards → Remove ID → Confirm removal**. The server refuses removal of nonempty boards and the final remaining board. Removal hides the board but reserves its ID, so old keys cannot acquire an unrelated meaning. Current links to a removed board offer available boards; historical issue links still resolve to their current location.

Switching boards loads the destination in place without a full-page refresh, then starts a clean board view. The previous board remains visible with “Opening board…” while it loads, and controls pause until the transition completes. A pending write disables switching, and an unfinished quick-capture title prompts before it is discarded. Open editors keep the background navigation inactive until the edit is saved or explicitly discarded.

## Data and integration

- Board URLs use `/?board=ENG`; shared cards use `/?board=ENG&issue=ENG-3`. Authentication preserves those parameters.
- `GET /api/boards` lists available boards. Admin-only `POST /api/boards` takes `{ "id": "ENG", "name": "Engineering" }`; admin-only `DELETE /api/boards/ENG` removes an empty board.
- `GET /api/issues?board=ENG` returns that board's snapshot. `POST /api/issues` accepts `boardId` alongside title/status. Omitting it uses TCK when available, otherwise the first available board for backward compatibility.
- `POST /api/issues/:id/transfer` takes `{ "boardId": "ENG", "fromBoardId": "TCK" }`. It returns the moved card, including its new key. Existing item writes accept `?board=ID` to reject stale-board actions.
- The JSON export is now **formatVersion 2**, containing all boards (including reserved removed IDs), per-board counters, all active/archived cards, and previous keys. CSV adds `board_id` and `previous_keys`. Export remains administrator-only and excludes auth secrets.
- Migration `002_boards.sql` runs transactionally through the existing migration runner. The shared ordering lock serializes creation, moves, removal, archive, and restore. Both source/destination changes and key allocation commit together.

Back up before migrating an existing installation. The old single-board application is not compatible with duplicate per-board numbers: rollback requires the pre-migration database backup together with the previous application image, not merely an older app against the new schema.
