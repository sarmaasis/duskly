CREATE INDEX IF NOT EXISTS post_destination_post ON post_destination (post_id);
CREATE INDEX IF NOT EXISTS post_destination_account ON post_destination (social_account_id);
CREATE INDEX IF NOT EXISTS workspace_member_user ON workspace_member (user_id);
CREATE INDEX IF NOT EXISTS workspace_invite_email ON workspace_invite (email, status);
