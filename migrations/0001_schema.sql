CREATE TABLE IF NOT EXISTS folder (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES folder(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS folder_translation (
  folder_id TEXT NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (folder_id, locale)
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES folder(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_translation (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  sidebar_label TEXT,
  description TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  published_revision_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  UNIQUE (document_id, locale)
);

CREATE TABLE IF NOT EXISTS document_revision (
  id TEXT PRIMARY KEY,
  document_translation_id TEXT NOT NULL REFERENCES document_translation(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  sidebar_label TEXT,
  description TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(document_translation_id, revision)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS folder_root_slug_unique ON folder(slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS folder_child_slug_unique ON folder(parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_root_slug_unique ON document(slug) WHERE folder_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_folder_slug_unique ON document(folder_id, slug) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS folder_parent_order_idx ON folder(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS document_folder_order_idx ON document(folder_id, sort_order);
CREATE INDEX IF NOT EXISTS folder_translation_locale_idx ON folder_translation(locale, name);
CREATE INDEX IF NOT EXISTS document_translation_locale_idx ON document_translation(locale, title);
CREATE INDEX IF NOT EXISTS document_revision_translation_idx ON document_revision(document_translation_id, revision DESC);
