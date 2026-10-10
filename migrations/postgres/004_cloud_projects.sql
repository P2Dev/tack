-- Deliberate, exclusive integration privilege. Existing key scopes are unchanged.
ALTER TABLE agent_keys DROP CONSTRAINT agent_keys_scopes_check;
ALTER TABLE agent_keys ADD CONSTRAINT agent_keys_scopes_check CHECK (
 (scopes <@ ARRAY['read','write','archive','transfer']::TEXT[] AND 'read'=ANY(scopes))
 OR (scopes=ARRAY['projects:sync']::TEXT[] AND board_ids IS NULL)
);
CREATE TABLE cloud_projects (
 cloud_project_id UUID PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug)<=80),
 code TEXT NOT NULL UNIQUE REFERENCES boards(id),
 revision BIGINT NOT NULL CHECK (revision>0 AND revision<=9007199254740991),
 payload JSONB,
 response JSONB,
 imported BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK ((payload IS NULL AND response IS NULL AND imported) OR (payload IS NOT NULL AND response IS NOT NULL))
);
-- Keep the most recent payload durably; no TTL/cache can permit a duplicate board.
-- Nullable imported payload means the operator provisioned a board, not a projection.
