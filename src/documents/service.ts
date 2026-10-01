import { resolveContentMedia } from '../media/urls.ts';
import { managedMediaKeys, mediaWriteGuard } from '../media/references.ts';
import { assertPublishedLinks } from './link-pages.ts';
import { siteDeliveryStatement } from '../publish/record.ts';
import { defaultLocale, type SupportedLocale } from '../locales.ts';
import type { RuntimeEnv } from '../env.ts';
import { documentInput, documentUpdate, parseContent, serializeContent } from './validation.ts';
import { renderDocumentContent } from '../starlight/render.ts';

export class DocumentConflictError extends Error {}
export class DocumentVersionConflictError extends DocumentConflictError {}
export class DocumentContentError extends Error {}
export class DocumentNotFoundError extends Error {}

type TranslationRow = {
  id: string; document_id: string; locale: string; title: string; sidebar_label: string | null;
  description: string; content_json: string; published_revision_id: string | null; version: number;
  created_at: number; updated_at: number; published_at: number | null; folder_id: string | null;
  slug: string; sort_order: number;
  publication_state: 'draft' | 'changes' | 'published';
};

export type DocumentView = {
  id: string; translationId: string; locale: string; folderId: string | null; title: string;
  sidebarLabel: string | null; slug: string; description: string; order: number; contentJson: unknown;
  status: 'draft' | 'published'; version: number; createdAt: number; updatedAt: number;
  publishedAt: number | null; publishedRevisionId: string | null;
  publicationState: 'draft' | 'changes' | 'published';
};

/** A delivery is inserted in the same D1 batch as the published revision pointer. */
export type PendingPublishDelivery = { id: string; requestedAt: number };

function assertPublishable(contentJson: string) {
  try {
    const content = JSON.parse(contentJson);
    renderDocumentContent(resolveContentMedia(content, new Set(managedMediaKeys(content)), 'public'));
  }
  catch (error) { throw new DocumentContentError(error instanceof Error ? error.message : 'Invalid document content'); }
}

const translationSelect = `
  SELECT t.id,t.document_id,t.locale,t.title,t.sidebar_label,t.description,t.content_json,
    t.published_revision_id,t.version,t.created_at,t.updated_at,t.published_at,
    d.folder_id,d.slug,d.sort_order,
    CASE WHEN t.published_revision_id IS NULL THEN 'draft'
      WHEN r.title IS NOT t.title OR r.sidebar_label IS NOT t.sidebar_label
        OR r.description IS NOT t.description OR r.content_json IS NOT t.content_json THEN 'changes'
      ELSE 'published' END AS publication_state
  FROM document_translation t JOIN document d ON d.id=t.document_id
  LEFT JOIN document_revision r ON r.id=t.published_revision_id`;

function toView(row: TranslationRow, keys: ReadonlySet<string> = new Set()): DocumentView {
  return {
    id: row.document_id, translationId: row.id, locale: row.locale, folderId: row.folder_id,
    title: row.title, sidebarLabel: row.sidebar_label, slug: row.slug, description: row.description,
    order: row.sort_order, contentJson: resolveContentMedia(parseContent(row.content_json), keys, 'admin'),
    status: row.published_revision_id ? 'published' : 'draft', version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at,
    publishedRevisionId: row.published_revision_id,
    publicationState: row.publication_state,
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

export async function listDocuments(env: RuntimeEnv, locale: SupportedLocale = defaultLocale) {
  const rows = await env.DB.prepare(`${translationSelect} WHERE t.locale=? ORDER BY d.sort_order,d.slug`)
    .bind(locale).all<TranslationRow>();
  const media = await env.DB.prepare('SELECT object_key FROM media').all<{ object_key: string }>();
  const keys = new Set(media.results.map((row) => row.object_key));
  return rows.results.map((row) => toView(row, keys));
}

export async function getDocument(env: RuntimeEnv, id: string, locale: SupportedLocale = defaultLocale) {
  const row = await getTranslation(env, id, locale);
  const media = await env.DB.prepare('SELECT object_key FROM media').all<{ object_key: string }>();
  return toView(row, new Set(media.results.map((item) => item.object_key)));
}

export async function createDocument(env: RuntimeEnv, raw: unknown, locale: SupportedLocale = defaultLocale) {
  if (locale !== defaultLocale) throw new DocumentConflictError(`Create pages in ${defaultLocale}, then add a translation`);
  const input = documentInput.parse(raw);
  await assertSlugAvailable(env, input.folderId, input.slug);
  const id = crypto.randomUUID();
  const translationId = crypto.randomUUID();
  const now = Date.now();
  const created = await env.DB.batch([
    env.DB.prepare(`INSERT INTO document (id,folder_id,slug,sort_order,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${mediaWriteGuard}`)
      .bind(id, input.folderId, input.slug, input.order, now, now, JSON.stringify(managedMediaKeys(input.contentJson))),
    env.DB.prepare(`INSERT INTO document_translation (id,document_id,locale,title,sidebar_label,description,content_json,published_revision_id,version,created_at,updated_at,published_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${mediaWriteGuard}`)
      .bind(translationId, id, locale, input.title, null, input.description, serializeContent(input.contentJson), null, 1, now, now, null, JSON.stringify(managedMediaKeys(input.contentJson))),
  ]);
  if (created[1]?.meta.changes !== 1) throw new DocumentContentError('A media file was removed. Upload it again before saving.');
  return getDocument(env, id, locale);
}

export async function updateDocument(env: RuntimeEnv, id: string, raw: unknown, locale: SupportedLocale = defaultLocale) {
  const input = documentUpdate.parse(raw);
  await assertSlugAvailable(env, input.folderId, input.slug, id);
  const current = await getTranslation(env, id, locale);
  if (current.version !== input.version) throw new DocumentVersionConflictError();
  const now = Date.now();
  const results = await env.DB.batch([
    siteDeliveryStatement(env, `EXISTS (SELECT 1 FROM document d JOIN document_translation t ON t.document_id=d.id
      WHERE d.id=? AND t.published_revision_id IS NOT NULL AND (d.folder_id IS NOT ? OR d.slug<>? OR d.sort_order<>?)
      AND EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=?)) AND ${mediaWriteGuard}`, [id,input.folderId,input.slug,input.order,current.id,input.version,JSON.stringify(managedMediaKeys(input.contentJson))]),
    env.DB.prepare(`UPDATE document SET folder_id=?,slug=?,sort_order=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=?) AND ${mediaWriteGuard}`)
      .bind(input.folderId, input.slug, input.order, now, id, current.id, input.version, JSON.stringify(managedMediaKeys(input.contentJson))),
    env.DB.prepare(`UPDATE document_translation SET title=?,description=?,content_json=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND ${mediaWriteGuard}`)
      .bind(input.title, input.description, serializeContent(input.contentJson), now, current.id, input.version, JSON.stringify(managedMediaKeys(input.contentJson))),
  ]);
  if (results[2]?.meta.changes !== 1) {
    const keys = managedMediaKeys(input.contentJson);
    const missing = await env.DB.prepare(`SELECT 1 WHERE NOT ${mediaWriteGuard}`).bind(JSON.stringify(keys)).first();
    if (missing) throw new DocumentContentError('A media file was removed. Upload it again before saving.');
    throw new DocumentVersionConflictError();
  }
  return getDocument(env, id, locale);
}

export async function publishDocument(env: RuntimeEnv, id: string, version: number, locale: SupportedLocale = defaultLocale, delivery?: PendingPublishDelivery) {
  const current = await getTranslation(env, id, locale);
  if (current.version !== version) throw new DocumentVersionConflictError();
  assertPublishable(current.content_json);
  try { await assertPublishedLinks(env, [current]); } catch (error) { throw new DocumentContentError(error instanceof Error ? error.message : 'Invalid page link'); }
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
    throw new DocumentVersionConflictError();
  }
  return getDocument(env, id, locale);
}

/**
 * Publish every saved translation that differs from its current public revision.
 * One site delivery is recorded for the whole set, so Workers Builds runs once.
 */
export async function publishSavedChanges(env: RuntimeEnv, delivery: PendingPublishDelivery) {
  const candidates = await env.DB.prepare(`
    ${translationSelect}
    WHERE t.published_revision_id IS NULL
      OR r.title IS NOT t.title
      OR r.sidebar_label IS NOT t.sidebar_label
      OR r.description IS NOT t.description
      OR r.content_json IS NOT t.content_json
    ORDER BY t.updated_at,t.id`).all<TranslationRow>();
  if (candidates.results.length === 0) return [];
  for (const candidate of candidates.results) assertPublishable(candidate.content_json);
  try { await assertPublishedLinks(env, candidates.results); } catch (error) { throw new DocumentContentError(error instanceof Error ? error.message : 'Invalid page link'); }

  const now = Date.now();
  const revisions = candidates.results.map(() => crypto.randomUUID());
  const statements = candidates.results.flatMap((candidate, index) => {
    const revisionId = revisions[index]!;
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
  // Return the exact snapshots/version written by this publication, rather
  // than a later read that might include somebody else's subsequent save.
  const media = await env.DB.prepare('SELECT object_key FROM media').all<{ object_key: string }>();
  const keys = new Set(media.results.map((row) => row.object_key));
  return candidates.results.map((candidate, index) => toView({
    ...candidate, version: candidate.version + 1, published_revision_id: revisions[index]!,
    published_at: now, updated_at: now, publication_state: 'published',
  }, keys));
}

export async function listRevisions(env: RuntimeEnv, id: string, locale: SupportedLocale = defaultLocale) {
  const current = await getTranslation(env, id, locale);
  const rows = await env.DB.prepare('SELECT r.id,r.revision,r.created_at,CASE WHEN EXISTS (SELECT 1 FROM document_translation t WHERE t.published_revision_id=r.id) OR EXISTS (SELECT 1 FROM cms_build b WHERE b.expires_at>? AND instr(b.revision_ids,r.id)>0) THEN 0 ELSE 1 END AS can_delete FROM document_revision r WHERE r.document_translation_id=? ORDER BY r.revision DESC')
    .bind(Date.now(), current.id).all<{ id: string; revision: number; created_at: number; can_delete: number }>();
  return rows.results.map((row) => ({ id: row.id, revision: row.revision, createdAt: row.created_at, canDelete: Boolean(row.can_delete) }));
}

export async function deleteRevision(env: RuntimeEnv, id: string, revisionId: string, version: number, locale: SupportedLocale = defaultLocale) {
  const current = await getTranslation(env, id, locale);
  if (current.version !== version) throw new DocumentVersionConflictError();
  const result = await env.DB.prepare(`DELETE FROM document_revision WHERE id=? AND document_translation_id=?
    AND EXISTS (SELECT 1 FROM document_translation WHERE id=? AND version=?)
    AND NOT EXISTS (SELECT 1 FROM document_translation WHERE published_revision_id=document_revision.id)
    AND NOT EXISTS (SELECT 1 FROM cms_build b WHERE b.expires_at>? AND instr(b.revision_ids,document_revision.id)>0)`)
    .bind(revisionId, current.id, current.id, version, Date.now()).run();
  if (result.meta.changes !== 1) throw new DocumentConflictError('This revision is published, used by a build, or no longer available.');
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
  if (current.version !== version) throw new DocumentVersionConflictError();
  try { await assertPublishedLinks(env, [], { id, locale }); } catch (error) { throw new DocumentContentError(error instanceof Error ? error.message : 'Page is linked from published content'); }
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
  const result = await env.DB.prepare(`INSERT INTO document_translation (id,document_id,locale,title,sidebar_label,description,content_json,published_revision_id,version,created_at,updated_at,published_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${mediaWriteGuard}`)
    .bind(id, documentId, locale, source.title, source.sidebar_label, source.description, source.content_json, null, 1, now, now, null, JSON.stringify(managedMediaKeys(parseContent(source.content_json)))).run();
  if (result.meta.changes !== 1) throw new DocumentContentError('A media file was removed. Upload it again before saving.');
  return getDocument(env, documentId, locale);
}
