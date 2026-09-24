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
