import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { historyLimit } from '../src/publish/cleanup.ts';

let mf: Miniflare;
let staticMedia = false;
let failDelete = false;
beforeAll(async () => {
  // Only the test wrapper can alter configuration or simulate an R2 outage.
  const bundle = await build({ stdin: { contents: `
    import worker from './src/index.ts';
    import { cmsConfig } from './src/cms.config.ts';
    export default { async fetch(request, env, ctx) {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/__test-media/')) {
        const key = path.slice('/__test-media/'.length);
        if (request.method === 'PUT') { await env.MEDIA.put(key, await request.arrayBuffer()); return new Response(null, { status: 204 }); }
        return new Response(null, { status: await env.MEDIA.head(key) ? 204 : 404 });
      }
      const limit = request.headers.get('x-test-limit');
      cmsConfig.maxPublicationRevisions = limit === null ? null : Number(limit);
      const media = request.headers.has('x-test-fail-delete') ? {
        delete() { throw new Error('Simulated R2 outage'); }
      } : env.MEDIA;
      return worker.fetch(request, { ...env, MEDIA: media }, ctx);
    }};`, resolveDir: process.cwd() }, loader: { '.sql': 'text' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'cleanup-test', modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['MEDIA'],  serviceBindings: { ASSETS: () => Response.json({ media: staticMedia ? 'static' : 'legacy' }) } }] }));
  expect((await mf.dispatchFetch('http://localhost/admin/export/snapshot')).status).toBe(200);
}, 30000);
afterAll(async () => { await mf?.dispose(); });

async function raw(path: string, method = 'GET', body?: unknown, limit?: number) {
  return mf.dispatchFetch(`http://localhost/admin/api/${path}`, { method, headers: {
    'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms',
    ...(limit === undefined ? {} : { 'x-test-limit': String(limit) }),
    ...(failDelete ? { 'x-test-fail-delete': '1' } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function api(path: string, method = 'GET', body?: unknown, limit?: number): Promise<any> {
  const response = await raw(path, method, body, limit);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
const input = (slug: string, contentJson: unknown = empty) => ({ title: slug, slug, folderId: null, order: 0, description: '', contentJson });
async function media(fresh = false) {
  const id = crypto.randomUUID(); const key = `media/${id}.png`;
  const db = await mf.getD1Database('DB');
  await db.prepare('INSERT INTO media(id,object_key,file_name,content_type,size,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id, key, 'image.png', 'image/png', 4, Date.now() - (fresh ? 0 : 48 * 60 * 60 * 1000)).run();
  expect((await mf.dispatchFetch(`http://localhost/__test-media/${key}`, { method: 'PUT', body: new Uint8Array([137, 80, 78, 71]) })).status).toBe(204);
  return { id, key, content: { type: 'doc', content: [{ type: 'image', attrs: { src: `https://media.example.test/${key}?v=1` } }] } };
}
async function exists(key: string) { return (await mf.dispatchFetch(`http://localhost/__test-media/${key}`)).status === 204; }
async function publish(page: any, slug: string, content = empty) {
  page = await api(`documents/${page.id}`, 'PUT', { ...input(slug, content), version: page.version });
  return (await api(`documents/${page.id}/publish`, 'POST', { version: page.version })).document;
}
async function buildLease(limit?: number) {
  const build = await api('publish/builds', 'POST', undefined, limit);
  return build.id as string;
}

it('accepts only unlimited or positive integral retention settings', () => {
  expect(historyLimit(null)).toBeNull(); expect(historyLimit(2)).toBe(2);
  for (const limit of [0, -1, 1.5, Infinity, NaN]) expect(() => historyLimit(limit)).toThrow();
});

it('skips collection while legacy production still uses R2, then collects before deployment', async () => {
  const unused = await media(); const fresh = await media(true);
  const id = await buildLease();
  expect(await api(`publish/builds/${id}/cleanup`, 'POST')).toMatchObject({ skipped: true, mediaDeleted: 0 });
  expect(await exists(unused.key)).toBe(true);
  staticMedia = true;
  expect(await api(`publish/builds/${id}/cleanup`, 'POST')).toMatchObject({ mediaDeleted: 1 });
  expect(await exists(unused.key)).toBe(false);
  expect(await exists(fresh.key)).toBe(true);
  await api(`publish/builds/${id}`, 'DELETE');
});

it('retains drafts and history; deletion releases media for the next build', async () => {
  const used = await media();
  let page = await api('documents', 'POST', input('cleanup-history', used.content));
  // Editor resolves the old public domain without needing MEDIA_PUBLIC_URL.
  expect(page.contentJson.content[0].attrs.src).toBe(`/admin/api/media/object/${used.key}`);
  page = (await api(`documents/${page.id}/publish`, 'POST', { version: page.version })).document;
  const flight = await buildLease();
  page = await publish(page, 'cleanup-history');
  const revisions = await api(`documents/${page.id}/revisions`);
  expect(revisions.map((r: any) => r.canDelete)).toEqual([false, false]);
  expect((await raw(`documents/${page.id}/revisions/${revisions[1].id}`, 'DELETE', { version: page.version })).status).toBe(409);
  await api(`publish/builds/${flight}`, 'DELETE');
  expect((await raw(`documents/${page.id}/revisions/${revisions[1].id}`, 'DELETE', { version: page.version - 1 })).status).toBe(409);
  await api(`documents/${page.id}/revisions/${revisions[1].id}`, 'DELETE', { version: page.version });
  const staticReference = { type: 'doc', content: [{ type: 'image', attrs: { src: `/_cms-media/${used.key.slice('media/'.length)}` } }] };
  const draft = await api('documents', 'POST', input('cleanup-draft', staticReference));
  const id = await buildLease();
  await api(`publish/builds/${id}/cleanup`, 'POST');
  expect(await exists(used.key)).toBe(true);
  await api(`documents/${draft.id}`, 'DELETE', { version: draft.version });
  await api(`publish/builds/${id}/cleanup`, 'POST');
  expect(await exists(used.key)).toBe(false);
  expect((await raw('documents', 'POST', input('deleted-media', used.content))).status).toBe(400);
  await api(`publish/builds/${id}`, 'DELETE');
});

it('caps history while protecting concurrent snapshots and rejects expired cleanup', async () => {
  const old = await media();
  let page = await api('documents', 'POST', input('cleanup-cap', old.content));
  page = (await api(`documents/${page.id}/publish`, 'POST', { version: page.version })).document;
  const flight = await buildLease();
  page = await publish(page, 'cleanup-cap');
  page = await publish(page, 'cleanup-cap');
  const id = await buildLease(2);
  await api(`publish/builds/${id}/cleanup`, 'POST', undefined, 2);
  expect((await api(`documents/${page.id}/revisions`))).toHaveLength(3);
  expect(await exists(old.key)).toBe(true);
  await api(`publish/builds/${flight}`, 'DELETE');
  await api(`publish/builds/${id}/cleanup`, 'POST', undefined, 2);
  expect((await api(`documents/${page.id}/revisions`))).toHaveLength(2);
  expect(await exists(old.key)).toBe(false);
  const db = await mf.getD1Database('DB');
  await db.prepare('UPDATE cms_build SET expires_at=0 WHERE id=?').bind(id).run();
  expect((await raw(`publish/builds/${id}/cleanup`, 'POST')).status).toBe(409);
});

it('retries an R2 failure without losing metadata and prevents references during deletion', async () => {
  const unused = await media(); const id = await buildLease();
  failDelete = true;
  expect((await raw(`publish/builds/${id}/cleanup`, 'POST')).status).toBe(500);
  failDelete = false;
  const db = await mf.getD1Database('DB');
  expect(await db.prepare('SELECT id FROM media WHERE id=?').bind(unused.id).first()).not.toBeNull();
  expect(await db.prepare('SELECT media_id FROM media_deletion WHERE media_id=?').bind(unused.id).first()).not.toBeNull();
  const page = await api('documents', 'POST', input('claim-save'));
  expect((await raw(`documents/${page.id}`, 'PUT', { ...input('claim-save', unused.content), version: page.version })).status).toBe(400);
  await api(`publish/builds/${id}/cleanup`, 'POST');
  expect(await exists(unused.key)).toBe(false);
  await api(`publish/builds/${id}`, 'DELETE');
});

it('collects through bounded batches and releases deleted-page originals after in-flight builds finish', async () => {
  const images = [];
  for (let index = 0; index < 11; index++) images.push(await media());
  const id = await buildLease();
  expect(await api(`publish/builds/${id}/cleanup`, 'POST')).toMatchObject({ mediaDeleted: 10, more: true });
  expect(await api(`publish/builds/${id}/cleanup`, 'POST')).toMatchObject({ mediaDeleted: 1, more: false });
  await api(`publish/builds/${id}`, 'DELETE');
  const image = await media();
  let page = await api('documents', 'POST', input('deleted-public-page', image.content));
  page = (await api(`documents/${page.id}/publish`, 'POST', { version: page.version })).document;
  const flight = await buildLease();
  await api(`documents/${page.id}`, 'DELETE', { version: page.version });
  const next = await buildLease();
  await api(`publish/builds/${next}/cleanup`, 'POST');
  expect(await exists(image.key)).toBe(true);
  await api(`publish/builds/${flight}`, 'DELETE');
  await api(`publish/builds/${next}/cleanup`, 'POST');
  expect(await exists(image.key)).toBe(false);
  await api(`publish/builds/${next}`, 'DELETE');
});

it('ignores plain text and conservatively retains malformed history references', async () => {
  const textOnly = await media(); const escaped = await media(); const malformed = await media();
  const page = await api('documents', 'POST', input('reference-json', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: textOnly.key }] }] }));
  const db = await mf.getD1Database('DB');
  const draft = await api('documents', 'POST', input('escaped-json', escaped.content));
  await db.prepare('UPDATE document_translation SET content_json=replace(content_json,?,?) WHERE document_id=?').bind('/', '\\/', draft.id).run();
  const broken = await api('documents', 'POST', input('malformed-json'));
  await db.prepare('UPDATE document_translation SET content_json=? WHERE document_id=?').bind('{broken', broken.id).run();
  const id = await buildLease();
  await api(`publish/builds/${id}/cleanup`, 'POST');
  expect(await exists(malformed.key)).toBe(true);
  await db.prepare('UPDATE document_translation SET content_json=? WHERE document_id=?').bind(JSON.stringify(empty), broken.id).run();
  await api(`publish/builds/${id}/cleanup`, 'POST');
  expect(await exists(textOnly.key)).toBe(false);
  expect(await exists(escaped.key)).toBe(true);
  expect(await exists(malformed.key)).toBe(false);
  await api(`documents/${page.id}`, 'DELETE', { version: page.version });
  await api(`publish/builds/${id}`, 'DELETE');
});
