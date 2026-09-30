ALTER TABLE media ADD COLUMN group_id TEXT;
CREATE INDEX IF NOT EXISTS media_ws_group ON media (workspace_id, group_id);
