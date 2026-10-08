# Tack Two-Week Pilot

Date: 2026-07-27

## Purpose

Use Tack as the team's shared view of work for two weeks and learn where basic
tracking fails. The pilot is testing whether a title-first, four-column board
is enough—not whether Tack can reproduce Jira.

Review, QA, release approval, technical discussion, and code history remain in
the team's existing tools. Do not add parallel Review or QA columns during the
pilot.

## Owner and dates

Fill these in before launch:

- Pilot owner:
- Operations contact:
- Start date:
- End date:
- Tack URL:
- Backup location:
- Feedback log location:

The pilot owner records observations and makes the end-of-pilot decision. This
does not require a project-management role or daily status reporting.

## Deployment preflight

- [ ] Choose the Docker host and configure a reverse proxy with TLS.
- [ ] Copy `.env.example` to `.env` on the host.
- [ ] Set a unique `POSTGRES_PASSWORD` and a random
      `BETTER_AUTH_SECRET` of at least 32 characters.
- [ ] Set `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` to the exact
      public HTTPS origin.
- [ ] Set the initial administrator email, name, and temporary password.
- [ ] Run `docker compose up -d --build`.
- [ ] Confirm both services are healthy with `docker compose ps`.
- [ ] Open `/api/health` and confirm `{"status":"ok"}`.
- [ ] Sign in as the initial administrator and change any temporary password
      that should not remain in deployment configuration.
- [ ] Create one local account per pilot participant from **Team**.
- [ ] Decide an off-host backup destination and retention period.
- [ ] Run `./scripts/backup.sh /secure/backups/tack-pre-pilot.dump`.
- [ ] Perform one restore drill before inviting the team.
- [ ] Download one JSON export from **Team** and inspect its issue, label, and
      user counts.
- [ ] Confirm no prototype import is required; if it is, stop and plan that
      migration explicitly.

## Ten-minute team introduction

Show only the workflow people need:

1. Open the board and create a card by typing a title and pressing Enter.
2. Explain the four states:
   **Backlog** is captured, **Ready** is a sensible next item,
   **In Progress** is active work, and **Done** means tracking is complete.
3. Open one card to show the optional description, assignee, and labels.
4. Move a card with the status selector. Mention that drag-and-drop is optional.
5. Show key/title search, filters, archive, and Undo.
6. State where review, QA, and discussion already happen; Tack only records the
   current tracking state.

Do not require assignees, labels, descriptions, estimates, or a daily grooming
ritual. A useful title is enough.

## Operating agreement

For the two weeks:

- Put newly discovered work on the board when it needs to be remembered.
- Keep one card in the state that best describes its current tracking state.
- Use card order as the lightweight priority signal.
- Add details only when they help another person understand or find the work.
- Archive completed or obsolete cards when Done becomes noisy.
- Report concrete friction, not feature names. For example, record “I could not
  tell which of these two items needed attention first” before proposing a
  priority field.
- Do not move review or QA activity into Tack.

## Feedback log

Record a line only when someone cannot complete a tracking task, repeats
avoidable work, loses confidence in saved state, or adopts a workaround.

| Date | Person | Attempted task | What happened | Workaround | Impact | Repeat count |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Name | Find an issue from chat | Example: key search did not find pasted text | Opened several cards | 3 minutes | 1 |

Keep the person's wording where possible. Do not use page views, card counts,
or individual activity as performance monitoring.

## Lightweight checks

At the end of days 2, 7, and 14, the pilot owner should check:

- Can each participant create, move, and find a card without help?
- Did any confirmed change disappear or overwrite another person's work?
- Are people using a field or external workaround repeatedly?
- Does one shared board remain understandable?
- Are the four states being interpreted consistently?
- Is the refresh delay causing mistaken decisions?
- Is important context being lost because discussion remains elsewhere?
- Are people avoiding Tack because capture feels slower than a note?

An operational defect or suspected data loss is fixed immediately. A feature
request waits for the end-of-pilot review unless it blocks continued use.

## End-of-pilot review

Ask each participant:

1. What did you try to track that Tack made awkward?
2. Which action, if any, took more explanation than expected?
3. Did you ever distrust whether a change was saved or current?
4. Did you need another board, status, or field to make a real decision?
5. What workaround did you repeat?
6. What could be removed without making tracking worse?

Then group observations by attempted task. Accept a product change only when
the problem is recurring, cannot be handled by the current title, description,
assignee, labels, order, status, search, or archive, and has a testable outcome.
Select at most one next product improvement.

## Completion and rollback

Before the review, an administrator downloads both JSON and CSV exports from
**Team** and records the backup path. JSON is the lossless portable snapshot;
CSV is an issue-oriented view for spreadsheet inspection. Neither export
contains password hashes, sessions, or tokens.

If the team stops using Tack:

```bash
./scripts/backup.sh /secure/backups/tack-final.dump
docker compose stop
```

The named database volume remains intact. To resume after a restore:

```bash
docker compose up -d db
./scripts/restore.sh /secure/backups/tack-final.dump --confirm
docker compose up -d app
```

Record the decision and evidence in `ROADMAP.md`, update the assumptions in
`RESEARCH.md`, and add any accepted architecture choice to `DECISIONS.md`.
