import { siteDeliveryStatement } from '../publish/record.ts';
import { defaultLocale, type SupportedLocale } from '../locales.ts';
import type { RuntimeEnv } from '../env.ts';
import { documentInput, documentUpdate, parseContent, serializeContent, type DocumentInput } from './validation.ts';

export class DocumentConflictError extends Error {}
export class DocumentNotFoundError extends Error {}

type TranslationRow = {
  id: string; document_id: string; locale: string; title: string; sidebar_label: string | null;
  description: string; content_json: string; published_revision_id: string | null; version: number;
  created_at: number; updated_at: number; published_at: number | null; folder_id: string | null;
  slug: string; sort_order: number;
};

export type DocumentView = {
  id: string; translationId: string; locale: string; folderId: string | null; title: string;
  sidebarLabel: string | null; slug: string; description: string; order: number; contentJson: unknown;
  status: 'draft' | 'published'; version: number; createdAt: number; updatedAt: number;
  publishedAt: number | null; publishedRevisionId: string | null;
};

/** A delivery is inserted in the same D1 batch as the published revision pointer. */
export type PendingPublishDelivery = { id: string; requestedAt: number };

const translationSelect = `
  SELECT t.id,t.document_id,t.locale,t.title,t.sidebar_label,t.description,t.content_json,
    t.published_revision_id,t.version,t.created_at,t.updated_at,t.published_at,
    d.folder_id,d.slug,d.sort_order
  FROM document_translation t JOIN document d ON d.id=t.document_id`;

function toView(row: TranslationRow): DocumentView {
  return {
    id: row.document_id, translationId: row.id, locale: row.locale, folderId: row.folder_id,
    title: row.title, sidebarLabel: row.sidebar_label, slug: row.slug, description: row.description,
    order: row.sort_order, contentJson: parseContent(row.content_json),
    status: row.published_revision_id ? 'published' : 'draft', version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at,
    publishedRevisionId: row.published_revision_id,
  };
}

async function assertSlugAvailable(env: RuntimeEnv, folderId: string | null, slug: string, exceptId = '') {
  const [folderMatch, documentMatch] = await Promise.all([
    env.DB.prepare('SELECT id FROM folder WHERE parent_id IS ? AND slug = ? LIMIT 1').bind(folderId, slug).first(),
    env.DB.prepare('SELECT id FROM document WHERE folder_id IS ? AND slug = ? AND id <> ? LIMIT 1').bind(folderId, slug, exceptId).first(),
  ]);
  if (folderMatch || documentMatch) throw new DocumentConflictError('A folder or page already uses this URL segment');
}

async function getTranslation(env: RuntimeEnv, documentId: string, locale: SupportedLocale): Promise<TranslationRow> {
  const row = await env.DB.prepare(`${translationSelect} WHERE t.document_id=? AND t.locale=?`)
    .bind(documentId, locale).first<TranslationRow>();
  if (!row) throw new DocumentNotFoundError();
  return row;
}

function snapshotStatement(env: RuntimeEnv, id: string, translationId: string, input: Pick<DocumentInput, 'title' | 'description' | 'contentJson'>, now: number, afterUpdate = false) {
  return env.DB.prepare(`
    INSERT INTO document_revision (id,document_translation_id,revision,title,sidebar_label,description,content_json,created_at)
    SELECT ?, id, COALESCE((SELECT MAX(revision) + 1 FROM document_revision WHERE document_translation_id = ?), 1), ?, sidebar_label, ?, ?, ?
    FROM document_translation WHERE id = ? ${afterUpdate ? 'AND changes()=1' : ''}`)
    .bind(id, translationId, input.title, input.description, serializeContent(input.contentJson), now, translationId);
}

async function snapshot(env: RuntimeEnv, translationId: string, input: Pick<DocumentInput, 'title' | 'description' | 'contentJson'>, now: number) {
  const id = crypto.randomUUID();
  await snapshotStatement(env, id, translationId, input, now).run();
  return id;
}

export async function listDocuments(env: RuntimeEnv, locale: SupportedLocale = defaultLocale) {
  const rows = await env.DB.prepare(`${translationSelect} WHERE t.locale=? ORDER BY d.sort_order,d.slug`)
    .bind(locale).all<TranslationRow>();
  return rows.results.map(toView);
}

export async function getDocument(env: RuntimeEnv, id: string, locale: SupportedLocale = defaultLocale) {
  return toView(await getTranslation(env, id, locale));
}

export async function createDocument(env: RuntimeEnv, raw: unknown, locale: SupportedLocale = defaultLocale) {
  if (locale !== defaultLocale) throw new DocumentConflictError(`Create pages in ${defaultLocale}, then add a translation`);
  const input = documentInput.parse(raw);
  await assertSlugAvailable(env, input.folderId, input.slug);
  const id = crypto.randomUUID();
  const translationId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO document (id,folder_id,slug,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .bind(id, input.folderId, input.slug, input.order, now, now),
    env.DB.prepare('INSERT INTO document_translation (id,document_id,locale,title,sidebar_label,description,content_json,published_revision_id,version,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(translationId, id, locale, input.title, null, input.description, serializeContent(input.contentJson), null, 1, now, now, null),
  ]);
  await snapshot(env, translationId, input, now);
  return getDocument(env, id, locale);
}

export async function updateDocument(env: RuntimeEnv, id: string, raw: unknown, locale: SupportedLocale = defaultLocale) {
  const input = documentUpdate.parse(raw);
  await assertSlugAvailable(env, input.folderId, input.slug, id);
  const current = await getTranslation(env, id, locale);
  if (current.version !== input.version) throw new DocumentConflictError();
  const now = Date.now();
  const results = await env.DB.batch([
    siteDeliveryStatement(env, `EXISTS (SELECT 1 FROM document d JOIN document_translation t ON t.document_id=d.id
      WHERE d.id=? AND t.published_revision_id IS NOT NULL AND (d.folder_id IS NOT ? OR d.slug<>? OR d.sort_order<>?)
      AND EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=?))`, [id,input.folderId,input.slug,input.order,current.id,input.version]),
    env.DB.prepare('UPDATE document SET folder_id=?,slug=?,sort_order=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=?)')
      .bind(input.folderId, input.slug, input.order, now, id, current.id, input.version),
    env.DB.prepare('UPDATE document_translation SET title=?,description=?,content_json=?,updated_at=?,version=version+1 WHERE id=? AND version=?')
      .bind(input.title, input.description, serializeContent(input.contentJson), now, current.id, input.version),
    snapshotStatement(env, crypto.randomUUID(), current.id, input, now, true),
  ]);
  if (results[2]?.meta.changes !== 1) throw new DocumentConflictError();
  return getDocument(env, id, locale);
}

export async function publishDocument(env: RuntimeEnv, id: string, version: number, locale: SupportedLocale = defaultLocale, delivery?: PendingPublishDelivery) {
  const current = await getTranslation(env, id, locale);
  if (current.version !== version) throw new DocumentConflictError();
  const now = Date.now();
  const revisionId = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO document_revision (id,document_translation_id,revision,title,sidebar_label,description,content_json,created_at)
      SELECT ?,id,COALESCE((SELECT MAX(revision)+1 FROM document_revision WHERE document_translation_id=?),1),title,sidebar_label,description,content_json,?
      FROM document_translation WHERE id=? AND version=?`).bind(revisionId,current.id,now,current.id,version),
    env.DB.prepare('UPDATE document_translation SET published_revision_id=?,published_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?')
      .bind(revisionId, now, now, current.id, version),
    ...(delivery ? [env.DB.prepare(`
      INSERT INTO publish_delivery (id,trigger_kind,document_translation_id,status,attempts,already_exists,requested_at)
      SELECT ?,'document',id,'pending',0,0,? FROM document_translation WHERE id=? AND published_revision_id=?`).bind(delivery.id, delivery.requestedAt, current.id, revisionId)] : []),
  ]);
  if (results[1]?.meta.changes !== 1) {
    throw new DocumentConflictError();
  }
  return getDocument(env, id, locale);
}

type PublishableTranslation = { id: string; version: number };

/**
 * Publish every saved translation that differs from its current public revision.
 * One site delivery is recorded for the whole set, so Workers Builds runs once.
 */
export async function publishSavedChanges(env: RuntimeEnv, delivery: PendingPublishDelivery) {
  const candidates = await env.DB.prepare(`
    SELECT t.id,t.version
    FROM document_translation t
    LEFT JOIN document_revision r ON r.id=t.published_revision_id
    WHERE t.published_revision_id IS NULL
      OR r.title IS NOT t.title
      OR r.sidebar_label IS NOT t.sidebar_label
      OR r.description IS NOT t.description
      OR r.content_json IS NOT t.content_json
    ORDER BY t.updated_at,t.id`).all<PublishableTranslation>();
  if (candidates.results.length === 0) return 0;

  const now = Date.now();
  const statements = candidates.results.flatMap((candidate) => {
    const revisionId = crypto.randomUUID();
    return [
      env.DB.prepare(`INSERT INTO document_revision (id,document_translation_id,revision,title,sidebar_label,description,content_json,created_at)
        SELECT ?,id,COALESCE((SELECT MAX(revision)+1 FROM document_revision WHERE document_translation_id=?),1),title,sidebar_label,description,content_json,?
        FROM document_translation WHERE id=? AND version=?`)
        .bind(revisionId, candidate.id, now, candidate.id, candidate.version),
      env.DB.prepare('UPDATE document_translation SET published_revision_id=?,published_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?')
        .bind(revisionId, now, now, candidate.id, candidate.version),
    ];
  });
  statements.push(env.DB.prepare(`INSERT INTO publish_delivery
    (id,trigger_kind,status,attempts,already_exists,requested_at)
    VALUES (?,'site','pending',0,0,?)`).bind(delivery.id, delivery.requestedAt));

  const results = await env.DB.batch(statements);
  if (candidates.results.some((_, index) => results[index * 2 + 1]?.meta.changes !== 1)) {
    throw new DocumentConflictError();
  }
  return candidates.results.length;
}

export async function listRevisions(env: RuntimeEnv, id: string, locale: SupportedLocale = defaultLocale) {
  const current = await getTranslation(env, id, locale);
  const rows = await env.DB.prepare('SELECT id,revision,created_at FROM document_revision WHERE document_translation_id=? ORDER BY revision DESC')
    .bind(current.id).all<{ id: string; revision: number; created_at: number }>();
  return rows.results.map((row) => ({ id: row.id, revision: row.revision, createdAt: row.created_at }));
}

export async function restoreRevision(env: RuntimeEnv, id: string, revisionId: string, version: number, locale: SupportedLocale = defaultLocale) {
  const current = await getTranslation(env, id, locale);
  const revision = await env.DB.prepare('SELECT title,description,content_json FROM document_revision WHERE id=? AND document_translation_id=?')
    .bind(revisionId, current.id).first<{ title: string; description: string; content_json: string }>();
  if (!revision) throw new DocumentNotFoundError();
  return updateDocument(env, id, {
    title: revision.title, slug: current.slug, description: revision.description,
    contentJson: parseContent(revision.content_json), folderId: current.folder_id, order: current.sort_order, version,
  }, locale);
}

export async function deleteDocument(env: RuntimeEnv, id: string, version: number, locale: SupportedLocale = defaultLocale) {
  const current = await getTranslation(env, id, locale);
  const results = await env.DB.batch([
    siteDeliveryStatement(env, 'EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=? AND published_revision_id IS NOT NULL)', [current.id, version]),
    env.DB.prepare('DELETE FROM document_translation WHERE id=? AND version=? RETURNING id').bind(current.id, version),
    env.DB.prepare('DELETE FROM document WHERE id=? AND NOT EXISTS (SELECT 1 FROM document_translation WHERE document_id=?)').bind(id, id),
  ]);
  if (results[1]?.results.length !== 1) throw new DocumentConflictError();
}

export async function createDocumentTranslation(env: RuntimeEnv, documentId: string, locale: SupportedLocale, sourceLocale: SupportedLocale = defaultLocale) {
  if (locale === sourceLocale) throw new DocumentConflictError('Choose a different language');
  const source = await getTranslation(env, documentId, sourceLocale);
  const existing = await env.DB.prepare('SELECT id FROM document_translation WHERE document_id=? AND locale=?').bind(documentId, locale).first();
  if (existing) throw new DocumentConflictError('This translation already exists');
  const id = crypto.randomUUID(); const now = Date.now();
  await env.DB.prepare('INSERT INTO document_translation (id,document_id,locale,title,sidebar_label,description,content_json,published_revision_id,version,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, documentId, locale, source.title, source.sidebar_label, source.description, source.content_json, null, 1, now, now, null).run();
  await snapshot(env, id, { title: source.title, description: source.description, contentJson: parseContent(source.content_json) }, now);
  return getDocument(env, documentId, locale);
}
