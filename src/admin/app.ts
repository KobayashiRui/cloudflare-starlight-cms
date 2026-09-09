import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { DocumentConflictError, DocumentNotFoundError, createDocument, deleteDocument, getDocument, listDocuments, listRevisions, publishDocument, restoreRevision, updateDocument } from '../documents/service.ts';
import { InvalidMediaError, listMedia, uploadMedia } from '../media/service.ts';
import type { RuntimeEnv } from '../env.ts';
import { renderDocumentContent } from '../starlight/render.ts';
import { adminHtml } from './html.ts';

type AdminEnv = { Bindings: RuntimeEnv };
const app = new Hono<AdminEnv>();
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const noStore = { 'Cache-Control': 'no-store' };

function csrfAllowed(request: Request): boolean {
  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  return request.headers.get('x-requested-with') === 'cloudflare-starlight-cms' &&
    (!origin || origin === new URL(request.url).origin);
}

const csrf: MiddlewareHandler<AdminEnv> = async (c, next) => {
  if (!csrfAllowed(c.req.raw)) return c.json({ error: 'Cross-site request rejected' }, 403, jsonHeaders);
  await next();
};

async function publishedSnapshot(env: RuntimeEnv) {
  const rows = await env.DB.prepare(`SELECT d.id, r.title, r.slug, r.description, r.section, r.sort_order, r.content_json, d.created_at, d.updated_at, d.published_at FROM documents d JOIN document_revisions r ON r.id = d.published_revision_id WHERE d.status = 'published' ORDER BY r.sort_order ASC, r.slug ASC`).all<{
    id: string; title: string; slug: string; description: string; section: string; sort_order: number;
    content_json: string; created_at: number; updated_at: number; published_at: number;
  }>();
  return {
    version: 2,
    documents: rows.results.map((row) => ({
      id: row.id, title: row.title, slug: row.slug, description: row.description, section: row.section,
      order: row.sort_order, body: { format: 'markdown', value: renderDocumentContent(JSON.parse(row.content_json)) },
      status: 'published', createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
      publishedAt: new Date(row.published_at).toISOString(),
    })),
  };
}

app.onError((error, c) => {
  if (error instanceof DocumentNotFoundError) return c.json({ error: 'Not found' }, 404, jsonHeaders);
  if (error instanceof DocumentConflictError) return c.json({ error: error.message || 'The document changed. Reload it and try again.' }, 409, jsonHeaders);
  if (error instanceof InvalidMediaError) return c.json({ error: error.message }, 400, jsonHeaders);
  if (error instanceof z.ZodError) return c.json({ error: 'Invalid request', details: error.issues }, 400, jsonHeaders);
  console.error('Admin API error', error);
  return c.json({ error: 'Request failed' }, 500, jsonHeaders);
});

app.get('/admin/export/snapshot', async (c) => c.json(await publishedSnapshot(c.env), 200, jsonHeaders));
const adminHome = (c: Context<AdminEnv>) => {
  return c.html(adminHtml(), 200, { 'Cache-Control': 'no-store' });
};
app.get('/admin', adminHome);
app.get('/admin/', adminHome);
app.get('/admin/app.js', (c) => c.env.ASSETS.fetch(c.req.raw));

app.use('/admin/api/*', csrf);
app.get('/admin/api/documents', async (c) => c.json(await listDocuments(c.env), 200, jsonHeaders));
app.post('/admin/api/documents', async (c) => c.json(await createDocument(c.env, await c.req.json()), 201, jsonHeaders));
app.get('/admin/api/documents/:id', async (c) => c.json(await getDocument(c.env, c.req.param('id')), 200, jsonHeaders));
app.put('/admin/api/documents/:id', async (c) => c.json(await updateDocument(c.env, c.req.param('id'), await c.req.json()), 200, jsonHeaders));
app.delete('/admin/api/documents/:id', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  await deleteDocument(c.env, c.req.param('id'), version!);
  return new Response(null, { status: 204, headers: noStore });
});
app.post('/admin/api/documents/:id/publish', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  return c.json(await publishDocument(c.env, c.req.param('id'), version!), 200, jsonHeaders);
});
app.get('/admin/api/documents/:id/revisions', async (c) => c.json(await listRevisions(c.env, c.req.param('id')), 200, jsonHeaders));
app.post('/admin/api/documents/:id/revisions/:revisionId/restore', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  return c.json(await restoreRevision(c.env, c.req.param('id'), c.req.param('revisionId'), version!), 200, jsonHeaders);
});
app.get('/admin/api/media', async (c) => c.json(await listMedia(c.env), 200, jsonHeaders));
app.post('/admin/api/media', async (c) => c.json(await uploadMedia(c.env, c.req.raw), 201, jsonHeaders));
app.get('/admin/api/media/object/:key{.+}', async (c) => {
  const key = c.req.param('key');
  if (!/^media\/[a-z0-9-]+\.(png|jpg|webp|avif|mp4|webm)$/.test(key)) return c.json({ error: 'Not found' }, 404, jsonHeaders);
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404, jsonHeaders);
  const headers = new Headers(noStore);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
});

app.all('/admin/*', (c) => c.env.ASSETS.fetch(c.req.raw));

export { app as adminApp };
