# Use Tack

Tack gives a shared team four statuses: **Backlog**, **Ready**, **In progress**,
and **Done**. All active members can work on all boards. Administrators also
manage people, boards, and labels.

## Capture and update a card

Type a title in a column’s quick-capture field and press Enter. **New card**
opens capture; the board’s **C** shortcut starts it when you are not typing in
another field. The title is enough—descriptions, assignees, and labels are optional.

Open a card to add Markdown notes, assign a teammate, or select labels. Titles
and descriptions autosave. Check the save indicator before leaving. If a save
fails, your draft stays visible with retry/discard options. Changing status or
moving a card between boards waits for relevant edits to finish saving.

Move cards by dragging, using keyboard drag controls, or choosing a status in
the detail view. On a narrow screen, select a status to work in one column at a
time; that choice is remembered. Use [boards and keys](BOARDS.md) for board
switching, transfers, and permanent historical links.

## Find and share work

Search matches titles and exact card keys. Assignee and label filters can be
combined. Filters stay in the browser URL, so copy that URL to share the same
view. A card’s link includes its board and readable key, for example
`/?board=ENG&issue=ENG-42`.

A new card can be hidden by your filters. Tack identifies where it was created
and offers **Show card** or **Clear filters**. The board checks for shared
changes periodically and when the window regains focus. Open editors pause
background replacement; the freshness indicator explains that state.

## Archive and recover

Choose **Archive** in a card’s detail view. **Undo** restores a recently archived
card. Open **Options → Archive** to find and restore older cards. Archived cards
retain notes, labels, assignees, and former keys and can move between boards.

Tack does not provide permanent card deletion in the UI. Archive preserves the
shared history without keeping completed cards on the active board.

## Recover an interrupted session

If your session expires, follow the sign-in recovery link. It opens sign-in in
another tab so you can return to the original page and retry the pending task.
Failed capture/edit operations retain their draft and explicit recovery actions.
Avoid repeatedly submitting an operation whose response was lost: first refresh
and check whether it already completed.

## Administration

Administrators use the following entries in **Options**:

| Entry | Purpose |
| --- | --- |
| Team | Create local accounts, reset local passwords, change roles, disable/enable accounts, and export JSON/CSV |
| Manage boards | Create a board with an immutable short ID; remove it after all active and archived cards move out |
| Manage labels | Create, rename, recolor, and remove workspace-wide labels |

There are no email invitations. Give a new colleague their initial password
through your team’s normal private channel. Disabled users lose access. Local
password resets do not change a provider password. Exports include workspace
content and member profiles, so handle them as team data.

**Options → API keys** is available to every member. Create one scoped key per
agent and revoke it when no longer needed. Administrators can review and revoke
other users’ keys. See the [agent guide](agent-access/README.md).

## Scope and limits

Tack is a single shared workspace, not a multi-tenant service. Human accounts
share every board. API keys can narrow access to specific boards and operations.
Statuses are fixed; comments, notifications, sprints, estimates, custom fields,
and separate review/QA states are outside the current product.
