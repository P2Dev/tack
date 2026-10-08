-- Better Auth API-key 1.6.25 storage. Plaintext keys are never persisted.
CREATE TABLE apikey (
 id TEXT PRIMARY KEY,
 "configId" TEXT NOT NULL DEFAULT 'default', name TEXT, start TEXT,
 "referenceId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 prefix TEXT, key TEXT NOT NULL UNIQUE,
 "refillInterval" INTEGER, "refillAmount" INTEGER, "lastRefillAt" TIMESTAMPTZ,
 enabled BOOLEAN NOT NULL DEFAULT TRUE, "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
 "rateLimitTimeWindow" INTEGER DEFAULT 60000, "rateLimitMax" INTEGER DEFAULT 120,
 "requestCount" INTEGER NOT NULL DEFAULT 0, remaining INTEGER, "lastRequest" TIMESTAMPTZ,
 "expiresAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL,
 permissions TEXT, metadata TEXT
);
CREATE INDEX apikey_owner ON apikey("referenceId");
-- Retain lifecycle metadata when the plugin cleans up expired credentials.
CREATE TABLE agent_keys (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 name TEXT NOT NULL, prefix TEXT NOT NULL,
 scopes TEXT[] NOT NULL CHECK (scopes <@ ARRAY['read','write','archive','transfer']::TEXT[]),
 board_ids TEXT[],
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ
);
CREATE INDEX agent_keys_owner ON agent_keys(user_id);
ALTER TABLE issues ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE FUNCTION bump_issue_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END;
$$;
CREATE TRIGGER issue_revision BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION bump_issue_revision();
CREATE TABLE agent_requests (
 key_id TEXT NOT NULL REFERENCES agent_keys(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 response JSONB NOT NULL, status INTEGER NOT NULL,
 board_ids TEXT[] NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(key_id, request_key)
);
CREATE INDEX agent_requests_expiry ON agent_requests(expires_at);
CREATE TABLE agent_audit (
 id BIGSERIAL PRIMARY KEY, request_id TEXT NOT NULL,
 user_id TEXT NOT NULL, key_id TEXT NOT NULL,
 operation TEXT NOT NULL, target TEXT, outcome TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX agent_audit_created ON agent_audit(created_at);
