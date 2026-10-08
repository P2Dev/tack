CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_meta (key, value)
VALUES ('next_issue_number', '1')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  "banReason" TEXT,
  "banExpires" TIMESTAMPTZ,
  initials TEXT NOT NULL CHECK (char_length(initials) BETWEEN 1 AND 3),
  color TEXT NOT NULL CHECK (
    color IN ('rust', 'blue', 'gold', 'green', 'slate', 'violet')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique
ON "user" (LOWER(email));

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "impersonatedBy" TEXT
);

CREATE INDEX IF NOT EXISTS session_user_id
ON session ("userId");

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS account_user_id
ON account ("userId");

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS verification_identifier
ON verification (identifier);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  public_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (
    char_length(trim(title)) BETWEEN 1 AND 180
  ),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (
    status IN ('backlog', 'ready', 'in_progress', 'done')
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ,
  assignee_id TEXT REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS issues_board_order
ON issues (archived_at, status, position);

CREATE INDEX IF NOT EXISTS issues_archived_order
ON issues (archived_at DESC);

CREATE INDEX IF NOT EXISTS issues_assignee
ON issues (assignee_id, archived_at);

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (
    char_length(trim(name)) BETWEEN 1 AND 24
  ),
  color TEXT NOT NULL CHECK (
    color IN ('rust', 'blue', 'gold', 'green', 'slate', 'violet')
  ),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS labels_name_unique
ON labels (LOWER(name));

INSERT INTO labels (id, name, color, created_at) VALUES
  ('label-bug', 'Bug', 'rust', NOW()),
  ('label-feature', 'Feature', 'blue', NOW()),
  ('label-chore', 'Chore', 'slate', NOW()),
  ('label-blocked', 'Blocked', 'gold', NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE INDEX IF NOT EXISTS issue_labels_by_label
ON issue_labels (label_id, issue_id);
