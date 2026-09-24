CREATE TABLE IF NOT EXISTS short_link (
  code TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  url TEXT NOT NULL,
  post_id TEXT,
  created_at INTEGER NOT NULL
);
