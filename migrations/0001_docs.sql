CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  draft_revision_id TEXT NOT NULL,
  published_revision_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS document_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  author_subject TEXT,
  author_email TEXT,
  UNIQUE(document_id, revision)
);

CREATE INDEX IF NOT EXISTS document_revisions_document_idx ON document_revisions(document_id, revision DESC);
CREATE INDEX IF NOT EXISTS documents_published_idx ON documents(status, published_revision_id, sort_order, slug);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  author_subject TEXT,
  author_email TEXT
);
