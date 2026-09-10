CREATE TABLE IF NOT EXISTS publish_delivery (
  id TEXT PRIMARY KEY,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('document', 'site')),
  document_translation_id TEXT REFERENCES document_translation(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  build_id TEXT,
  already_exists INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  accepted_at INTEGER,
  next_retry_at INTEGER
);

CREATE INDEX IF NOT EXISTS publish_delivery_recent_idx ON publish_delivery(requested_at DESC);
CREATE INDEX IF NOT EXISTS publish_delivery_retry_idx ON publish_delivery(status, next_retry_at);
