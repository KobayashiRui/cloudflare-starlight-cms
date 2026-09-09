import { and, asc, desc, eq } from 'drizzle-orm';
import { database } from '../db/client.ts';
import { documentRevisions, documents } from '../db/schema.ts';
import type { RuntimeEnv } from '../env.ts';
import { documentInput, documentUpdate, parseContent, serializeContent, type DocumentInput } from './validation.ts';

export class DocumentConflictError extends Error {}
export class DocumentNotFoundError extends Error {}
const accessAuthor = { subject: 'cloudflare-access', email: 'access-protected-admin@local.invalid' };

export interface DocumentView {
  id: string; title: string; slug: string; description: string; section: string; order: number;
  contentJson: unknown; status: 'draft' | 'published'; version: number;
  createdAt: number; updatedAt: number; publishedAt: number | null;
  draftRevisionId: string; publishedRevisionId: string | null;
}

function toView(row: typeof documents.$inferSelect): DocumentView {
  return {
    id: row.id, title: row.title, slug: row.slug, description: row.description, section: row.section,
    order: row.order, contentJson: parseContent(row.contentJson), status: row.status, version: row.version,
    createdAt: row.createdAt, updatedAt: row.updatedAt, publishedAt: row.publishedAt,
    draftRevisionId: row.draftRevisionId, publishedRevisionId: row.publishedRevisionId,
  };
}

function revisionStatement(
  revisionId: string, documentId: string, input: DocumentInput, now: number,
  expectedVersion?: number,
) {
  if (expectedVersion === undefined) {
    return {
      sql: `INSERT INTO document_revisions (id, document_id, revision, title, slug, description, section, sort_order, content_json, created_at, author_subject, author_email) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [revisionId, documentId, input.title, input.slug, input.description, input.section, input.order, serializeContent(input.contentJson), now, accessAuthor.subject, accessAuthor.email],
    };
  }
  return {
    // Both statements in the D1 batch have the same expected document version,
    // so a stale write creates no revision. Publish changes the document version
    // but deliberately does not manufacture a content revision.
    sql: `INSERT INTO document_revisions (id, document_id, revision, title, slug, description, section, sort_order, content_json, created_at, author_subject, author_email) SELECT ?, id, (SELECT COALESCE(MAX(revision), 0) + 1 FROM document_revisions WHERE document_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ? FROM documents WHERE id = ? AND version = ?`,
    args: [revisionId, documentId, input.title, input.slug, input.description, input.section, input.order, serializeContent(input.contentJson), now, accessAuthor.subject, accessAuthor.email, documentId, expectedVersion],
  };
}

export async function listDocuments(env: RuntimeEnv): Promise<DocumentView[]> {
  const rows = await database(env).select().from(documents).orderBy(asc(documents.order), asc(documents.slug));
  return rows.map(toView);
}

export async function getDocument(env: RuntimeEnv, id: string): Promise<DocumentView> {
  const row = await database(env).select().from(documents).where(eq(documents.id, id)).get();
  if (!row) throw new DocumentNotFoundError();
  return toView(row);
}

export async function createDocument(env: RuntimeEnv, raw: unknown): Promise<DocumentView> {
  const input = documentInput.parse(raw);
  const id = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const now = Date.now();
  const revision = revisionStatement(revisionId, id, input, now);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO documents (id, title, slug, description, section, sort_order, content_json, draft_revision_id, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?)`)
        .bind(id, input.title, input.slug, input.description, input.section, input.order, serializeContent(input.contentJson), revisionId, now, now),
      env.DB.prepare(revision.sql).bind(...revision.args),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: documents.slug')) throw new DocumentConflictError('Slug already exists');
    throw error;
  }
  return getDocument(env, id);
}

export async function updateDocument(env: RuntimeEnv, id: string, raw: unknown): Promise<DocumentView> {
  const input = documentUpdate.parse(raw);
  const revisionId = crypto.randomUUID();
  const now = Date.now();
  const revision = revisionStatement(revisionId, id, input, now, input.version);
  try {
    const result = await env.DB.batch([
      env.DB.prepare(revision.sql).bind(...revision.args),
      env.DB.prepare(`UPDATE documents SET title = ?, slug = ?, description = ?, section = ?, sort_order = ?, content_json = ?, draft_revision_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
        .bind(input.title, input.slug, input.description, input.section, input.order, serializeContent(input.contentJson), revisionId, now, id, input.version),
    ]);
    if (result[1]?.meta.changes !== 1) throw new DocumentConflictError();
  } catch (error) {
    if (error instanceof DocumentConflictError) throw error;
    if (String(error).includes('UNIQUE constraint failed: documents.slug')) throw new DocumentConflictError('Slug already exists');
    throw error;
  }
  return getDocument(env, id);
}

export async function publishDocument(env: RuntimeEnv, id: string, version: number): Promise<DocumentView> {
  const now = Date.now();
  const result = await env.DB.prepare(`UPDATE documents SET published_revision_id = draft_revision_id, status = 'published', published_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
    .bind(now, now, id, version).run();
  if (result.meta.changes !== 1) throw new DocumentConflictError();
  return getDocument(env, id);
}

export async function listRevisions(env: RuntimeEnv, id: string) {
  return database(env).select().from(documentRevisions).where(eq(documentRevisions.documentId, id)).orderBy(desc(documentRevisions.revision));
}

export async function restoreRevision(env: RuntimeEnv, id: string, revisionId: string, version: number): Promise<DocumentView> {
  const revision = await database(env).select().from(documentRevisions)
    .where(and(eq(documentRevisions.id, revisionId), eq(documentRevisions.documentId, id))).get();
  if (!revision) throw new DocumentNotFoundError();
  return updateDocument(env, id, {
    title: revision.title, slug: revision.slug, description: revision.description, section: revision.section,
    order: revision.order, contentJson: parseContent(revision.contentJson), version,
  });
}

export async function deleteDocument(env: RuntimeEnv, id: string, version: number): Promise<void> {
  const result = await env.DB.prepare('DELETE FROM documents WHERE id = ? AND version = ?').bind(id, version).run();
  if (result.meta.changes !== 1) throw new DocumentConflictError();
}
