import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { DocumentConflictError, DocumentNotFoundError, createDocument, createDocumentTranslation, deleteDocument, getDocument, listDocuments, listRevisions, publishDocument, restoreRevision, updateDocument } from '../documents/service.ts';
import { InvalidMediaError, listMedia, uploadMedia } from '../media/service.ts';
import type { RuntimeEnv } from '../env.ts';
import { defaultLocale, isSupportedLocale, type SupportedLocale } from '../locales.ts';
import { renderDocumentContent } from '../starlight/render.ts';
import { adminHtml } from './html.ts';
import { createFolder, createFolderTranslation, deleteFolder, FolderNotFoundError, listTree, NavigationConflictError, replaceTreeChildren, updateFolder } from '../navigation/service.ts';

type AdminEnv = { Bindings: RuntimeEnv };
const app = new Hono<AdminEnv>();
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const noStore = { 'Cache-Control': 'no-store' };

function locale(c: Context<AdminEnv>): SupportedLocale {
  const value = c.req.query('locale') ?? defaultLocale;
  if (!isSupportedLocale(value)) throw new NavigationConflictError('Unsupported language');
  return value;
}

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
  const folders = await env.DB.prepare('SELECT id,parent_id,slug FROM folder').all<{ id:string; parent_id:string|null; slug:string }>();
  const parent = new Map(folders.results.map((row) => [row.id, row]));
  const path = (folderId: string | null, slug: string) => {
    const parts = [slug]; let cursor = folderId; const seen = new Set<string>();
    while (cursor) { if (seen.has(cursor)) throw new Error('Navigation cycle'); seen.add(cursor); const item = parent.get(cursor); if (!item) throw new Error('Missing folder'); parts.unshift(item.slug); cursor = item.parent_id; }
    return parts.join('/');
  };
  const rows = await env.DB.prepare(`
    SELECT d.id,d.folder_id,d.slug,d.sort_order,t.locale,r.title,r.description,r.content_json,
      t.created_at,t.updated_at,t.published_at
    FROM document d
    JOIN document_translation t ON t.document_id=d.id
    JOIN document_revision r ON r.id=t.published_revision_id
    ORDER BY t.locale,d.sort_order,d.slug`).all<{ id:string; folder_id:string|null; slug:string; sort_order:number; locale:SupportedLocale; title:string; description:string; content_json:string; created_at:number; updated_at:number; published_at:number }>();
  return {
    version: 3,
    documents: rows.results.map((row) => ({
      id: row.id, locale: row.locale, title: row.title, slug: path(row.folder_id, row.slug), description: row.description, section: '',
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
  if (error instanceof FolderNotFoundError) return c.json({ error: 'Folder not found' }, 404, jsonHeaders);
  if (error instanceof NavigationConflictError) return c.json({ error: error.message }, 409, jsonHeaders);
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
app.get('/admin/api/tree', async (c) => c.json(await listTree(c.env, locale(c)), 200, jsonHeaders));
app.post('/admin/api/folders', async (c) => c.json(await createFolder(c.env, await c.req.json(), locale(c)), 201, jsonHeaders));
app.put('/admin/api/folders/:id', async (c) => c.json(await updateFolder(c.env, c.req.param('id'), await c.req.json(), locale(c)), 200, jsonHeaders));
app.post('/admin/api/folders/:id/translations', async (c) => c.json(await createFolderTranslation(c.env, c.req.param('id'), locale(c), (await c.req.json<{ sourceLocale?: SupportedLocale }>()).sourceLocale ?? defaultLocale), 201, jsonHeaders));
app.delete('/admin/api/folders/:id', async (c) => { await deleteFolder(c.env, c.req.param('id')); return new Response(null, { status: 204, headers: noStore }); });
app.put('/admin/api/tree/children', async (c) => c.json(await replaceTreeChildren(c.env, await c.req.json()), 200, jsonHeaders));
app.get('/admin/api/documents', async (c) => c.json(await listDocuments(c.env, locale(c)), 200, jsonHeaders));
app.post('/admin/api/documents', async (c) => c.json(await createDocument(c.env, await c.req.json(), locale(c)), 201, jsonHeaders));
app.post('/admin/api/documents/:id/translations', async (c) => c.json(await createDocumentTranslation(c.env, c.req.param('id'), locale(c), (await c.req.json<{ sourceLocale?: SupportedLocale }>()).sourceLocale ?? defaultLocale), 201, jsonHeaders));
app.get('/admin/api/documents/:id', async (c) => c.json(await getDocument(c.env, c.req.param('id'), locale(c)), 200, jsonHeaders));
app.put('/admin/api/documents/:id', async (c) => c.json(await updateDocument(c.env, c.req.param('id'), await c.req.json(), locale(c)), 200, jsonHeaders));
app.delete('/admin/api/documents/:id', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  await deleteDocument(c.env, c.req.param('id'), version!, locale(c));
  return new Response(null, { status: 204, headers: noStore });
});
app.post('/admin/api/documents/:id/publish', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  return c.json(await publishDocument(c.env, c.req.param('id'), version!, locale(c)), 200, jsonHeaders);
});
app.get('/admin/api/documents/:id/revisions', async (c) => c.json(await listRevisions(c.env, c.req.param('id'), locale(c)), 200, jsonHeaders));
app.post('/admin/api/documents/:id/revisions/:revisionId/restore', async (c) => {
  const { version } = await c.req.json<{ version?: number }>();
  if (!Number.isInteger(version)) return c.json({ error: 'version is required' }, 400, jsonHeaders);
  return c.json(await restoreRevision(c.env, c.req.param('id'), c.req.param('revisionId'), version!, locale(c)), 200, jsonHeaders);
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
