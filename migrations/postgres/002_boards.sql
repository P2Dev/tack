CREATE TABLE boards (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  next_issue_number INTEGER NOT NULL DEFAULT 1 CHECK (next_issue_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);
INSERT INTO boards (id, name, next_issue_number)
SELECT 'TCK', 'Engineering board', GREATEST(
  COALESCE((SELECT value::INTEGER FROM app_meta WHERE key = 'next_issue_number'), 1),
  COALESCE((SELECT MAX(public_number) + 1 FROM issues), 1)
);
ALTER TABLE issues ADD COLUMN board_id TEXT NOT NULL DEFAULT 'TCK' REFERENCES boards(id);
ALTER TABLE issues DROP CONSTRAINT issues_public_number_key;
ALTER TABLE issues ADD CONSTRAINT issues_board_number_unique UNIQUE (board_id, public_number);
CREATE INDEX issues_board_status_order ON issues (board_id, archived_at, status, position);
CREATE TABLE issue_keys (
  key TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE
);
CREATE INDEX issue_keys_issue ON issue_keys (issue_id);
INSERT INTO issue_keys (key, issue_id) SELECT 'TCK-' || public_number, id FROM issues;
