ALTER TABLE account ADD COLUMN id_token TEXT;
ALTER TABLE account ADD COLUMN access_token_expires_at INTEGER;
ALTER TABLE account ADD COLUMN refresh_token_expires_at INTEGER;
ALTER TABLE account ADD COLUMN scope TEXT;
ALTER TABLE account ADD COLUMN password TEXT;
