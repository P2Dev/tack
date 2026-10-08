CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL CHECK (length(initials) BETWEEN 1 AND 3),
  color TEXT NOT NULL CHECK (
    color IN ('rust', 'blue', 'gold', 'green', 'slate', 'violet')
  ),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO users (
  id, email, display_name, initials, color, role, created_at
) VALUES
  (
    'member-alex-kim',
    'alex@example.local',
    'Alex Kim',
    'AK',
    'rust',
    'admin',
    '2026-07-27T00:00:00.000Z'
  ),
  (
    'member-maya-chen',
    'maya@example.local',
    'Maya Chen',
    'MC',
    'blue',
    'member',
    '2026-07-27T00:00:00.000Z'
  ),
  (
    'member-sam-rivera',
    'sam@example.local',
    'Sam Rivera',
    'SR',
    'green',
    'member',
    '2026-07-27T00:00:00.000Z'
  );

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (
    length(trim(name)) BETWEEN 1 AND 24
  ),
  color TEXT NOT NULL CHECK (
    color IN ('rust', 'blue', 'gold', 'green', 'slate', 'violet')
  ),
  created_at TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO labels (id, name, color, created_at) VALUES
  ('label-bug', 'Bug', 'rust', '2026-07-27T00:00:00.000Z'),
  ('label-feature', 'Feature', 'blue', '2026-07-27T00:00:00.000Z'),
  ('label-chore', 'Chore', 'slate', '2026-07-27T00:00:00.000Z'),
  ('label-blocked', 'Blocked', 'gold', '2026-07-27T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
) STRICT;

ALTER TABLE issues
ADD COLUMN assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issues_assignee
ON issues (assignee_id, archived_at);

CREATE INDEX IF NOT EXISTS issue_labels_by_label
ON issue_labels (label_id, issue_id);
