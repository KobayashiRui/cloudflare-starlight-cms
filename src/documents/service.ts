import { and, asc, desc, eq } from 'drizzle-orm';
import { database } from '../db/client.ts';
import { document, documentRevision } from '../db/schema.ts';
import type { RuntimeEnv } from '../env.ts';
import { documentInput, documentUpdate, parseContent, serializeContent, type DocumentInput } from './validation.ts';

export class DocumentConflictError extends Error {}
export class DocumentNotFoundError extends Error {}
export type DocumentView = { id: string; folderId: string | null; title: string; slug: string; description: string; order: number; contentJson: unknown; status: 'draft' | 'published'; version: number; createdAt: number; updatedAt: number; publishedAt: number | null; publishedRevisionId: string | null };
const toView = (row: typeof document.$inferSelect): DocumentView => ({ id: row.id, folderId: row.folderId, title: row.title, slug: row.slug, description: row.description, order: row.order, contentJson: parseContent(row.contentJson), status: row.status, version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt, publishedAt: row.publishedAt, publishedRevisionId: row.publishedRevisionId });

async function assertSlugAvailable(env: RuntimeEnv, folderId: string | null, slug: string, exceptId = '') {
  const [folderMatch, documentMatch] = await Promise.all([
    env.DB.prepare('SELECT id FROM folder WHERE parent_id IS ? AND slug = ? LIMIT 1').bind(folderId, slug).first(),
    env.DB.prepare('SELECT id FROM document WHERE folder_id IS ? AND slug = ? AND id <> ? LIMIT 1').bind(folderId, slug, exceptId).first(),
  ]);
  if (folderMatch || documentMatch) throw new DocumentConflictError('A folder or page already uses this URL segment');
}
async function snapshot(env: RuntimeEnv, documentId: string, input: DocumentInput, now: number) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO document_revision (id, document_id, revision, title, slug, description, content_json, created_at) SELECT ?, id, COALESCE((SELECT MAX(revision) + 1 FROM document_revision WHERE document_id = ?), 1), ?, ?, ?, ?, ? FROM document WHERE id = ?')
    .bind(id, documentId, input.title, input.slug, input.description, serializeContent(input.contentJson), now, documentId).run();
  return id;
}
export async function listDocuments(env: RuntimeEnv) { return (await database(env).select().from(document).orderBy(asc(document.order), asc(document.slug))).map(toView); }
export async function getDocument(env: RuntimeEnv, id: string) { const row = await database(env).select().from(document).where(eq(document.id, id)).get(); if (!row) throw new DocumentNotFoundError(); return toView(row); }
export async function createDocument(env: RuntimeEnv, raw: unknown) { const input = documentInput.parse(raw); await assertSlugAvailable(env, input.folderId, input.slug); const id = crypto.randomUUID(); const now = Date.now(); await database(env).insert(document).values({ id, folderId: input.folderId, title: input.title, slug: input.slug, description: input.description, contentJson: serializeContent(input.contentJson), status: 'draft', version: 1, order: input.order, createdAt: now, updatedAt: now, publishedRevisionId: null, publishedAt: null }); await snapshot(env, id, input, now); return getDocument(env, id); }
export async function updateDocument(env: RuntimeEnv, id: string, raw: unknown) { const input = documentUpdate.parse(raw); await assertSlugAvailable(env, input.folderId, input.slug, id); const now = Date.now(); const result = await env.DB.prepare('UPDATE document SET folder_id=?, title=?, slug=?, description=?, content_json=?, sort_order=?, updated_at=?, version=version+1 WHERE id=? AND version=?').bind(input.folderId, input.title, input.slug, input.description, serializeContent(input.contentJson), input.order, now, id, input.version).run(); if (result.meta.changes !== 1) throw new DocumentConflictError(); await snapshot(env, id, input, now); return getDocument(env, id); }
export async function publishDocument(env: RuntimeEnv, id: string, version: number) { const view = await getDocument(env, id); if (view.version !== version) throw new DocumentConflictError(); const now = Date.now(); const revisionId = await snapshot(env, id, { title: view.title, slug: view.slug, description: view.description, contentJson: parseContent(JSON.stringify(view.contentJson)), folderId: view.folderId, order: view.order }, now); const result = await env.DB.prepare("UPDATE document SET published_revision_id=?, status='published', published_at=?, updated_at=?, version=version+1 WHERE id=? AND version=?").bind(revisionId, now, now, id, version).run(); if (result.meta.changes !== 1) throw new DocumentConflictError(); return getDocument(env, id); }
export async function listRevisions(env: RuntimeEnv, id: string) { return database(env).select().from(documentRevision).where(eq(documentRevision.documentId, id)).orderBy(desc(documentRevision.revision)); }
export async function restoreRevision(env: RuntimeEnv, id: string, revisionId: string, version: number) { const revision = await database(env).select().from(documentRevision).where(and(eq(documentRevision.id, revisionId), eq(documentRevision.documentId, id))).get(); const current = await getDocument(env, id); if (!revision) throw new DocumentNotFoundError(); return updateDocument(env, id, { title: revision.title, slug: revision.slug, description: revision.description, contentJson: parseContent(revision.contentJson), folderId: current.folderId, order: current.order, version }); }
export async function deleteDocument(env: RuntimeEnv, id: string, version: number) { const result = await env.DB.prepare('DELETE FROM document WHERE id=? AND version=?').bind(id, version).run(); if (result.meta.changes !== 1) throw new DocumentConflictError(); }
