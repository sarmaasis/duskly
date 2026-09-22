-- Indexes + RSS group targeting
ALTER TABLE rss_feed ADD COLUMN group_id text;

CREATE INDEX IF NOT EXISTS post_destination_post ON post_destination(post_id);
CREATE INDEX IF NOT EXISTS social_account_group ON social_account(group_id);
CREATE INDEX IF NOT EXISTS posts_ws_status ON posts(workspace_id, status);
