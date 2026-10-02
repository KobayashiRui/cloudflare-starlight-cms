CREATE TABLE IF NOT EXISTS cms_build (
  id TEXT PRIMARY KEY,
  revision_ids TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_build_expiry ON cms_build (expires_at);
CREATE TABLE IF NOT EXISTS media_deletion (
  media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE
);
