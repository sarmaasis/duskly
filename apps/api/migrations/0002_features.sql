-- Feature matrix: plans, quotas, and product tables
ALTER TABLE workspace ADD COLUMN plan text NOT NULL DEFAULT 'standard';
ALTER TABLE workspace ADD COLUMN signature text;
ALTER TABLE workspace ADD COLUMN theme text NOT NULL DEFAULT 'light';

ALTER TABLE posts ADD COLUMN media_ids text;
ALTER TABLE posts ADD COLUMN signature_id text;
ALTER TABLE posts ADD COLUMN delay_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN repeat_rule text;
ALTER TABLE posts ADD COLUMN repeat_until integer;
ALTER TABLE posts ADD COLUMN parent_post_id text;
ALTER TABLE posts ADD COLUMN posting_set_id text;
ALTER TABLE posts ADD COLUMN comment_body text;
ALTER TABLE posts ADD COLUMN comment_delay_seconds integer NOT NULL DEFAULT 0;

ALTER TABLE social_account ADD COLUMN group_id text;
ALTER TABLE social_account ADD COLUMN credentials_json text;

CREATE TABLE IF NOT EXISTS customer_group (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS posting_set (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_ids text NOT NULL,
  template_body text,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS signature (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  is_default integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_counter (
  workspace_id text NOT NULL,
  period text NOT NULL,
  kind text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, period, kind)
);

CREATE TABLE IF NOT EXISTS api_token (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  created_at integer NOT NULL,
  last_used_at integer
);

CREATE TABLE IF NOT EXISTS outbound_webhook (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text NOT NULL,
  active integer NOT NULL DEFAULT 1,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS plug (
  id text PRIMARY KEY,
  workspace_id text,
  scope text NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL,
  action_json text NOT NULL,
  active integer NOT NULL DEFAULT 1,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_feed (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  url text NOT NULL,
  channel_ids text NOT NULL,
  last_guid text,
  active integer NOT NULL DEFAULT 1,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_run (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  result_json text NOT NULL,
  post_id text,
  status text NOT NULL,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_invite (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  created_at integer NOT NULL
);

ALTER TABLE media ADD COLUMN kind text NOT NULL DEFAULT 'image';
ALTER TABLE media ADD COLUMN meta_json text;

CREATE INDEX IF NOT EXISTS rss_feed_ws ON rss_feed(workspace_id);
CREATE INDEX IF NOT EXISTS plug_ws ON plug(workspace_id);
CREATE INDEX IF NOT EXISTS usage_ws ON usage_counter(workspace_id);
