CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  theme TEXT NOT NULL DEFAULT 'cyan',
  prompt TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (updated_at DESC);

-- Project deletion protection (also applied lazily by lib/project-protection.ts
-- at runtime, following this repo's ADD COLUMN IF NOT EXISTS convention, so
-- existing databases pick these up without a manual migration run).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by TEXT;

CREATE TABLE IF NOT EXISTS project_deletion_audit (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_title TEXT NOT NULL DEFAULT '',
  owner_id TEXT,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_deletion_audit_project_idx ON project_deletion_audit (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_backups (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS live_hosts (
  project_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS live_events_project_cursor_idx ON live_events (project_id, id);
