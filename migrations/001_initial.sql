CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

INSERT OR IGNORE INTO app_meta (key, value)
VALUES ('next_issue_number', '1');

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  public_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (
    length(trim(title)) BETWEEN 1 AND 180
  ),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (
    status IN ('backlog', 'ready', 'in_progress', 'done')
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS issues_board_order
ON issues (archived_at, status, position);

CREATE INDEX IF NOT EXISTS issues_archived_order
ON issues (archived_at DESC);
