import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { z } from 'zod';
import { publishedDocuments } from '../src/starlight/schema.ts';
import { cmsSidebar } from '../src/starlight/sidebar.ts';
import { supportedLocales } from '../src/locales.ts';
import { tableDocument } from './fixtures/table';

let mf: Miniflare;
let output: string;
const previewShell = `<!doctype html><html><head><title>Preview</title><meta name="description" content=""><meta property="og:title" content="Preview"><link rel="canonical" href="https://example.test/cms-preview-shell/"></head><body><starlight-lang-select>Language</starlight-lang-select><h1 id="_top">Preview</h1><mobile-starlight-toc data-min-h="2" data-max-h="3"><ul class="isMobile toc"><li>Overview</li></ul></mobile-starlight-toc><starlight-toc data-min-h="2" data-max-h="3"><ul class="toc"><li>Overview</li></ul></starlight-toc><div class="sl-markdown-content"><div id="cms-preview-content"></div></div></body></html>`;
beforeAll(async () => {
  output = await mkdtemp(join(tmpdir(), 'cms-publish-test-'));
  const bundle = await build({ entryPoints: ['src/index.ts'], loader: { '.sql': 'text' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'cms-test', modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['MEDIA'], serviceBindings: { ASSETS: () => new Response(previewShell, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) } }] }));
  const db = await mf.getD1Database('DB');
  // An incompatible pre-existing table must fail closed, without recording
  // a completed migration. Repairing this disposable test DB permits retry.
  await db.prepare('CREATE TABLE folder (id TEXT PRIMARY KEY)').run();
  expect((await mf.dispatchFetch('http://localhost/admin/export/snapshot')).status).toBe(503);
  expect((await db.prepare('SELECT name FROM d1_migrations').all()).results).toHaveLength(0);
  await db.prepare('DROP TABLE folder').run();
  const responses = await Promise.all(Array.from({ length: 4 }, () => mf.dispatchFetch('http://localhost/admin/export/snapshot')));
  for (const response of responses) expect(response.status).toBe(200);
  expect((await db.prepare('SELECT name FROM d1_migrations').all()).results).toHaveLength(2);
}, 30000);
afterAll(async () => { await mf?.dispose(); if (output) await rm(output, { recursive: true, force: true }); });

async function request(path: string, method = 'GET', body?: unknown) {
  const response = await mf.dispatchFetch(`http://localhost/admin/${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function buildDocs() {
  const endpoint = new URL('/admin/export/snapshot', await mf.ready).href;
  await promisify(execFile)(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output], {
    env: { ...process.env, CMS_EXPORT_URL: endpoint }, maxBuffer: 4 * 1024 * 1024,
  });
}
const identity = z.object({ id: z.string(), version: z.number() });
const hasJapanese = (supportedLocales as readonly string[]).includes('ja');

it('redirects the bare admin path to the Access-protected admin path', async () => {
  const response = await mf.dispatchFetch('http://localhost/admin', { redirect: 'manual' });
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('/admin/');
});

it('rejects HTTP and private-network media before storing a document', async () => {
  const response = await mf.dispatchFetch('http://localhost/admin/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' },
    body: JSON.stringify({
      title: 'Unsafe media', slug: 'unsafe-media', folderId: null, order: 0, description: '',
      contentJson: { type: 'doc', content: [{ type: 'image', attrs: { src: 'http://192.168.40.198:5201/image.webp' } }] },
    }),
  });
  expect(response.status).toBe(400);
  expect(await response.text()).toContain('External document media URLs must use HTTPS');
});

it('repairs legacy insecure media while keeping new writes strict', async () => {
  const id = crypto.randomUUID();
  const translationId = crypto.randomUUID();
  const now = Date.now();
  const db = await mf.getD1Database('DB');
  await db.batch([
    db.prepare('INSERT INTO document (id,folder_id,slug,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .bind(id, null, 'legacy-media', 0, now, now),
    db.prepare('INSERT INTO document_translation (id,document_id,locale,title,sidebar_label,description,content_json,published_revision_id,version,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(translationId, id, 'en', 'Legacy media', null, '', JSON.stringify({ type: 'doc', content: [{ type: 'image', attrs: { src: 'http://192.168.40.198/image.webp', alt: 'Old diagram' } }] }), null, 1, now, now, null),
  ]);
  const response = await mf.dispatchFetch(`http://localhost/admin/api/documents/${id}?locale=en`);
  expect(response.status).toBe(200);
  const document = z.object({ contentJson: z.any(), version: z.number() }).parse(await response.json());
  expect(document.contentJson).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Media omitted because its source must use HTTPS.' }] }] });
  const saved = z.object({ contentJson: z.any() }).parse(await request(`api/documents/${id}`, 'PUT', {
    title: 'Legacy media', slug: 'legacy-media', folderId: null, order: 0, description: '',
    contentJson: document.contentJson, version: document.version,
  }));
  expect(saved.contentJson).toEqual(document.contentJson);
  expect((await db.prepare('SELECT content_json FROM document_translation WHERE id=?').bind(translationId).first<{ content_json: string }>())?.content_json)
    .not.toContain('http://192.168.40.198');
  await db.batch([
    db.prepare('DELETE FROM document_translation WHERE id=?').bind(translationId),
    db.prepare('DELETE FROM document WHERE id=?').bind(id),
  ]);
});

it('serves a saved Draft in the generated Starlight preview shell without requesting a build', async () => {
  const page = identity.parse(await request('api/documents', 'POST', {
    title: 'Draft <title>', slug: 'preview-document', folderId: null, order: 0, description: 'Draft description',
    contentJson: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Draft section' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Draft <body>' }] },
    ] },
  }));
  const response = await mf.dispatchFetch(`http://localhost/admin/preview/${page.id}?locale=en`);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  const html = await response.text();
  expect(html).toContain('<title>Draft &lt;title&gt; | Preview</title>');
  expect(html).toContain('<h1 id="_top">Draft &lt;title&gt;</h1>');
  expect(html).toContain('<h2 id="draft-section">Draft section</h2>');
  expect(html).toContain('<p>Draft &lt;body&gt;</p>');
  expect(html).toContain('<div id="cms-preview-content"><h2 id="draft-section">Draft section</h2><p>Draft &lt;body&gt;</p></div>');
  expect(html).toContain('href="#draft-section"');
  expect(html).not.toContain('Overview');
  expect(html).not.toContain('canonical');
  expect(html).not.toContain('starlight-lang-select');
  await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
});

it('keeps drafts private and exports folder labels/order; records public moves and deletion', async () => {
  const folder = z.object({ id: z.string() }).parse(await request('api/folders', 'POST', { name: 'Getting Started', slug: 'guides', order: 3 }));
  const input = { title: 'Install', slug: 'install', folderId: folder.id, order: 0, description: '', contentJson: { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Install steps' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Public text' }] },
    { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
  ] } };
  let page = identity.parse(await request('api/documents', 'POST', input));
  expect(publishedDocuments(await request('export/snapshot'))).toEqual([]);
  const result = z.object({ document: identity }).parse(await request(`api/documents/${page.id}/publish`, 'POST', { version: page.version }));
  page = result.document;
  const published = await request('export/snapshot');
  expect(cmsSidebar(published)[0]?.label).toBe('Getting Started');
  await buildDocs();
  await access(join(output, 'cms-preview-shell/index.html'));
  if (hasJapanese) await access(join(output, 'ja/cms-preview-shell/index.html'));
  const publicPage = await readFile(join(output, 'guides/install/index.html'), 'utf8');
  expect(publicPage).toContain('Getting Started');
  expect(publicPage).toContain('id="install-steps"');
  expect(publicPage).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
  if (hasJapanese) expect(await readFile(join(output, 'ja/guides/install/index.html'), 'utf8')).toContain('Public text');
  await access(join(output, 'pagefind/pagefind.js'));
  page = identity.parse(await request(`api/documents/${page.id}`, 'PUT', { ...input, title: 'Draft title', version: page.version }));
  expect(await request('export/snapshot')).toEqual(published);
  // A rejected save must not rename the published URL either.
  const conflict = await mf.dispatchFetch(`http://localhost/admin/api/documents/${page.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' }, body: JSON.stringify({ ...input, slug: 'wrong', version: page.version - 1 }) });
  expect(conflict.status).toBe(409);
  expect(await request('export/snapshot')).toEqual(published);
  await request('api/tree/children', 'PUT', { parentId: null, childIds: [`document:${page.id}`] });
  expect(publishedDocuments(await request('export/snapshot'))[0]?.slug).toBe('install');
  await buildDocs();
  await access(join(output, 'install/index.html'));
  await expect(access(join(output, 'guides/install/index.html'))).rejects.toThrow();
  await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
  expect(publishedDocuments(await request('export/snapshot'))).toEqual([]);
  const db = await mf.getD1Database('DB');
  const changes = await db.prepare("SELECT count(*) AS count FROM publish_delivery WHERE trigger_kind='site'").first<{ count: number }>();
  expect(changes?.count).toBe(2);
  await buildDocs();
  await expect(access(join(output, 'install/index.html'))).rejects.toThrow();
}, 30000);

it('publishes all saved changes through one site delivery', async () => {
  const first = identity.parse(await request('api/documents', 'POST', {
    title: 'Bulk first', slug: 'bulk-first', folderId: null, order: 0, description: '', contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  }));
  const second = identity.parse(await request('api/documents', 'POST', {
    title: 'Bulk second', slug: 'bulk-second', folderId: null, order: 1, description: '', contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  }));
  const db = await mf.getD1Database('DB');
  const before = await db.prepare("SELECT count(*) AS count FROM publish_delivery WHERE trigger_kind='site'").first<{ count: number }>();

  const result = z.object({ publishedCount: z.number(), delivery: z.object({ triggerKind: z.literal('site'), status: z.string() }).nullable() })
    .parse(await request('api/publish/changes', 'POST'));
  expect(result.publishedCount).toBe(2);
  expect(result.delivery).toMatchObject({ triggerKind: 'site', status: 'skipped' });
  const publishedIds = publishedDocuments(await request('export/snapshot')).map((document) => document.id);
  expect(publishedIds).toEqual(expect.arrayContaining([first.id, second.id]));
  const after = await db.prepare("SELECT count(*) AS count FROM publish_delivery WHERE trigger_kind='site'").first<{ count: number }>();
  expect(after?.count).toBe((before?.count ?? 0) + 1);

  expect(await request('api/publish/changes', 'POST')).toMatchObject({ publishedCount: 0, delivery: null });
});

it('rejects the editor version left stale by bulk publishing until the translation is reloaded', async () => {
  const input = {
    title: 'Version investigation', slug: 'version-investigation', folderId: null, order: 0,
    description: '', contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
  const page = identity.parse(await request('api/documents', 'POST', input));
  const locale = hasJapanese ? 'ja' : 'en';
  const opened = hasJapanese
    ? identity.parse(await request(`api/documents/${page.id}/translations?locale=ja`, 'POST', { sourceLocale: 'en' }))
    : page;
  await request('api/publish/changes', 'POST');
  const latest = identity.parse(await request(`api/documents/${page.id}?locale=${locale}`));
  expect(latest.version).toBe(opened.version + 1);
  const published = await request('export/snapshot');

  // The Admin refreshes the tree/list after bulk publishing, but Save draft
  // still sends the version of the document opened before that operation.
  for (let attempt = 0; attempt < 2; attempt++) {
    const rejected = await mf.dispatchFetch(`http://localhost/admin/api/documents/${page.id}?locale=${locale}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' },
      body: JSON.stringify({ ...input, title: 'New draft', version: opened.version }),
    });
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual({ error: 'The document changed. Reload it and try again.', code: 'version_conflict' });
  }
  const saved = identity.parse(await request(`api/documents/${page.id}?locale=${locale}`, 'PUT', {
    ...input, title: 'New draft', version: latest.version,
  }));
  expect(saved.version).toBe(latest.version + 1);
  expect(await request('export/snapshot')).toEqual(published);
  await request(`api/documents/${page.id}?locale=${locale}`, 'DELETE', { version: saved.version });
  if (hasJapanese) {
    await request(`api/documents/${page.id}`, 'DELETE', { version: page.version + 1 });
  }
});

it('saves and reloads three uploaded images with a current translation version', async () => {
  const images = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  for (let index = 0; index < 3; index++) {
    const form = new FormData();
    form.set('file', new File([png], `image-${index}.png`, { type: 'image/png' }));
    // Encode multipart bytes before crossing Node/Miniflare's FormData realms.
    const multipart = new Request('http://localhost/admin/api/media', { method: 'POST', body: form });
    const response = await mf.dispatchFetch(multipart.url, {
      method: 'POST', headers: {
        'X-Requested-With': 'cloudflare-starlight-cms',
        'Content-Type': multipart.headers.get('content-type')!,
      }, body: await multipart.arrayBuffer(),
    });
    expect(response.status).toBe(201);
    images.push(z.object({ url: z.string() }).parse(await response.json()));
  }
  const input = {
    title: 'Three images', slug: 'three-images', folderId: null, order: 0, description: '',
    contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
  const page = identity.parse(await request('api/documents', 'POST', input));
  const locale = hasJapanese ? 'ja' : 'en';
  let opened = hasJapanese
    ? identity.parse(await request(`api/documents/${page.id}/translations?locale=ja`, 'POST', { sourceLocale: 'en' }))
    : page;
  const contentJson = {
    type: 'doc', content: images.map((image, index) => ({
      type: 'image', attrs: { src: image.url, alt: `Image ${index}`, title: null, width: null, height: null },
    })),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    opened = identity.parse(await request(`api/documents/${page.id}?locale=${locale}`, 'PUT', {
      ...input, contentJson, version: opened.version,
    }));
    expect(await request(`api/documents/${page.id}?locale=${locale}`)).toMatchObject({ contentJson });
  }
  expect(publishedDocuments(await request('export/snapshot')).some((document) => document.id === page.id)).toBe(false);
  const preview = await mf.dispatchFetch(`http://localhost/admin/preview/${page.id}?locale=${locale}`);
  expect(preview.status).toBe(200);
  const html = await preview.text();
  for (const image of images) expect(html).toContain(image.url);
  const rejectedPublish = await mf.dispatchFetch(`http://localhost/admin/api/documents/${page.id}/publish?locale=${locale}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' },
    body: JSON.stringify({ version: opened.version }),
  });
  expect(rejectedPublish.status).toBe(400);
  expect(await rejectedPublish.json()).toMatchObject({ error: expect.stringContaining('MEDIA_PUBLIC_URL') });
  await request(`api/documents/${page.id}?locale=${locale}`, 'DELETE', { version: opened.version });
  if (hasJapanese) await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
});

it('keeps only publication snapshots for new saves and restores, and returns bulk versions', async () => {
  const input = { title: 'History', slug: 'publication-history', description: '', folderId: null, order: 0,
    contentJson: { type: 'doc', content: [{ type: 'paragraph' }] } };
  let page = identity.parse(await request('api/documents', 'POST', input));
  expect(await request(`api/documents/${page.id}/revisions`)).toEqual([]);
  page = identity.parse(await request(`api/documents/${page.id}`, 'PUT', { ...input, version: page.version }));
  expect(await request(`api/documents/${page.id}/revisions`)).toEqual([]);
  const bulk = z.object({ documents: z.array(identity) }).parse(await request('api/publish/changes', 'POST'));
  const published = bulk.documents.find((document) => document.id === page.id);
  expect(published?.version).toBe(page.version + 1);
  page = identity.parse(published);
  expect(await request(`api/documents/${page.id}`)).toMatchObject({ publicationState: 'published', version: page.version });
  const snapshot = await request('export/snapshot');
  const revisions = z.array(z.object({ id: z.string() })).parse(await request(`api/documents/${page.id}/revisions`));
  expect(revisions).toHaveLength(1);
  page = identity.parse(await request(`api/documents/${page.id}`, 'PUT', { ...input, title: 'New draft', version: page.version }));
  expect(await request(`api/documents/${page.id}`)).toMatchObject({ publicationState: 'changes' });
  expect(await request('export/snapshot')).toEqual(snapshot);
  expect(await request(`api/documents/${page.id}/revisions`)).toHaveLength(1);
  page = identity.parse(await request(`api/documents/${page.id}/revisions/${revisions[0]!.id}/restore`, 'POST', { version: page.version }));
  expect(await request(`api/documents/${page.id}`)).toMatchObject({ title: input.title, publicationState: 'published' });
  expect(await request(`api/documents/${page.id}/revisions`)).toHaveLength(1);
  expect(await request('export/snapshot')).toEqual(snapshot);
  await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
});

it('rejects an unfinished image upload before changing the saved draft', async () => {
  const input = { title: 'Pending upload', slug: 'pending-upload', description: '', folderId: null, order: 0,
    contentJson: { type: 'doc', content: [{ type: 'paragraph' }] } };
  const page = identity.parse(await request('api/documents', 'POST', input));
  const rejected = await mf.dispatchFetch(`http://localhost/admin/api/documents/${page.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' },
    body: JSON.stringify({ ...input, version: page.version, contentJson: { type: 'doc', content: [{ type: 'imageUpload' }] } }),
  });
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({ error: expect.stringContaining('Finish uploading images') });
  expect(await request(`api/documents/${page.id}`)).toMatchObject({ contentJson: input.contentJson, version: page.version });
  await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
});

it('keeps navigation shared while folder names are translated per locale', async () => {
  if (!hasJapanese) return;
  const folder = z.object({ id: z.string() }).parse(await request('api/folders', 'POST', { name: 'Guides', slug: 'translated-guides', order: 9 }));
  await request(`api/folders/${folder.id}/translations?locale=ja`, 'POST', { sourceLocale: 'en' });
  await request(`api/folders/${folder.id}?locale=ja`, 'PUT', { name: 'ガイド', slug: 'translated-guides', parentId: null, order: 9 });
  const japaneseTree = await request('api/tree?locale=ja') as Array<{ id: string; name: string; slug: string }>;
  const englishTree = await request('api/tree?locale=en') as Array<{ id: string; name: string; slug: string }>;
  expect(japaneseTree).toContainEqual(expect.objectContaining({ id: `folder:${folder.id}`, name: 'ガイド', slug: 'translated-guides' }));
  expect(englishTree).toContainEqual(expect.objectContaining({ id: `folder:${folder.id}`, name: 'Guides', slug: 'translated-guides' }));
});

it('recovers an interrupted delivery but rejects a retry while a sender holds the lease', async () => {
  const db = await mf.getD1Database('DB');
  await db.batch([
    db.prepare("INSERT INTO publish_delivery (id,trigger_kind,status,attempts,requested_at,next_retry_at) VALUES ('stale','site','pending',1,?,?)").bind(Date.now()-60000, Date.now()-1000),
    db.prepare("INSERT INTO publish_delivery (id,trigger_kind,status,attempts,requested_at,next_retry_at) VALUES ('active','site','pending',1,?,?)").bind(Date.now(), Date.now()+30000),
  ]);
  const response = z.object({ delivery: z.object({ status: z.string(), attempts: z.number() }) }).parse(await request('api/publish/deliveries/stale/retry', 'POST'));
  expect(response.delivery).toMatchObject({ status: 'skipped', attempts: 2 });
  const active = await mf.dispatchFetch('http://localhost/admin/api/publish/deliveries/active/retry', { method: 'POST', headers: { 'X-Requested-With': 'cloudflare-starlight-cms' } });
  expect(active.status).toBe(409);
});

it('deletes only media that is absent from drafts, published pages, and revisions', async () => {
  const db = await mf.getD1Database('DB');
  const now = Date.now();
  const unused = { id: '00000000-0000-4000-8000-000000000001', objectKey: 'media/00000000-0000-4000-8000-000000000001.png' };
  await db.prepare('INSERT INTO media (id, object_key, file_name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(unused.id, unused.objectKey, 'unused.png', 'image/png', 4, now).run();
  const deleted = await mf.dispatchFetch(`http://localhost/admin/api/media/${unused.id}`, {
    method: 'DELETE', headers: { 'X-Requested-With': 'cloudflare-starlight-cms' },
  });
  expect(deleted.status).toBe(204);

  const used = { id: '00000000-0000-4000-8000-000000000002', objectKey: 'media/00000000-0000-4000-8000-000000000002.png' };
  await db.prepare('INSERT INTO media (id, object_key, file_name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(used.id, used.objectKey, 'used.png', 'image/png', 4, now).run();
  await request('api/documents', 'POST', {
    title: 'Media reference', slug: 'media-reference', folderId: null, order: 0, description: '',
    contentJson: { type: 'doc', content: [{ type: 'image', attrs: { src: `/admin/api/media/object/${used.objectKey}` } }] },
  });
  const rejected = await mf.dispatchFetch(`http://localhost/admin/api/media/${used.id}`, {
    method: 'DELETE', headers: { 'X-Requested-With': 'cloudflare-starlight-cms' },
  });
  expect(rejected.status).toBe(409);
  expect(await rejected.json()).toMatchObject({ error: expect.stringContaining('still used') });
});

// Keep Astro builds in one suite: parallel builds share the Vite dependency cache.
let linksMf: Miniflare;
let linksOutput: string;
beforeAll(async () => {
  linksOutput = await mkdtemp(join(tmpdir(), 'cms-linkIdentity-links-'));
  const bundle = await build({ entryPoints: ['src/index.ts'], loader: { '.sql': 'text' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  linksMf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'links-test', modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['MEDIA'], serviceBindings: { ASSETS: () => new Response('<html><head><title>Preview</title></head><body><div id="cms-preview-content"></div></body></html>', { headers: { 'Content-Type': 'text/html' } }) } }] }));
});
afterAll(async () => { await linksMf?.dispose(); if (linksOutput) await rm(linksOutput, { recursive: true, force: true }); });
const linkIdentity = z.object({ id: z.string(), version: z.number() });
async function fetchLinksAdmin(path: string, method = 'GET', body?: unknown) {
  return linksMf.dispatchFetch(`http://localhost/admin/${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'cloudflare-starlight-cms' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const linkHeading = (text: string, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const linksTargetBody = { type: 'doc', content: [linkHeading('Introduction', 1), linkHeading('  Hello  '), linkHeading('Hello #'), linkHeading('[Title](https://example.com)'), linkHeading('インストール'), linkHeading('インストール'), { type: 'tabs', content: [{ type: 'tab', attrs: { label: 'Details' }, content: [linkHeading('Details')] }] }] };
const linkFields = (title: string, slug: string, contentJson: unknown) => ({ title, slug, description: '', folderId: null, order: 0, contentJson });
it('links saved drafts, publishes together, builds working anchors, follows moves and rejects broken publications/deletion', async () => {
  const target = linkIdentity.parse(await (await fetchLinksAdmin('api/documents', 'POST', linkFields('Target', 'links-target', linksTargetBody))).json());
  const sourceBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read target', marks: [{ type: 'link', attrs: { href: '/stale/', documentId: target.id, anchor: 'インストール-1' } }] }, { type: 'text', text: 'Read details', marks: [{ type: 'link', attrs: { href: '/stale/', documentId: target.id, anchor: 'details-1' } }] }] }] };
  const source = linkIdentity.parse(await (await fetchLinksAdmin('api/documents', 'POST', linkFields('Source', 'links-source', sourceBody))).json());
  const preview = await fetchLinksAdmin(`preview/${source.id}?locale=en`);
  expect(preview.status).toBe(200);
  expect(await preview.text()).toContain(`/admin/preview/${target.id}?locale=en#`);
  expect(preview.headers.get('cache-control')).toBe('private, no-store');
  expect((await fetchLinksAdmin(`api/documents/${source.id}/publish`, 'POST', { version: source.version })).status).toBe(400);
  const publication = await fetchLinksAdmin('api/publish/changes', 'POST', {});
  expect(publication.status, await publication.text()).toBe(200);
  const snapshot = await (await fetchLinksAdmin('export/snapshot')).json();
  const docs = z.object({ documents: z.array(z.object({ id: z.string(), body: z.object({ value: z.string() }) })) }).parse(snapshot).documents;
  expect(docs.find((doc) => doc.id === source.id)!.body.value).toContain('/links-target/#');
  const endpoint = new URL('/admin/export/snapshot', await linksMf.ready).href;
  await promisify(execFile)(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', join(linksOutput, 'site')], { env: { ...process.env, CMS_EXPORT_URL: endpoint, CMS_INITIAL_EMPTY: undefined }, maxBuffer: 4 * 1024 * 1024 });
  const html = await readFile(join(linksOutput, 'site/links-target/index.html'), 'utf8');
  expect(html).toContain('id="introduction"');
  expect(html).toContain('id="--hello--"');
  expect(html).toContain('id="hello-"');
  expect(html).toContain('id="titlehttpsexamplecom"');
  // The explicit text also survives Starlight TOC generation.
  expect(html).toContain('href="#--hello--"');
  expect(html).toContain('id="インストール-1"');
  expect(html).toContain('id="details-1"');
  const latestTarget = linkIdentity.parse(await (await fetchLinksAdmin(`api/documents/${target.id}`)).json());
  const moved = await fetchLinksAdmin(`api/documents/${target.id}`, 'PUT', { ...linkFields('Target', 'links-moved', linksTargetBody), version: latestTarget.version });
  expect(moved.status).toBe(200);
  const movedPage = linkIdentity.parse(await moved.json());
  expect(await (await fetchLinksAdmin('export/snapshot')).text()).toContain('/links-moved/#');
  const edited = await fetchLinksAdmin(`api/documents/${target.id}`, 'PUT', { ...linkFields('Target', 'links-moved', { type: 'doc', content: [linkHeading('Renamed')] }), version: movedPage.version });
  expect(edited.status).toBe(200);
  // Saving drafts must leave public link targets and revision timestamps untouched.
  expect(await (await fetchLinksAdmin('export/snapshot')).text()).toContain('/links-moved/#');
  expect((await fetchLinksAdmin('api/publish/changes', 'POST', {})).status).toBe(400);
  const editedPage = linkIdentity.parse(await edited.json());
  expect((await fetchLinksAdmin(`api/documents/${target.id}`, 'DELETE', { version: editedPage.version })).status).toBe(400);
  expect((await fetchLinksAdmin(`api/documents/${source.id}`, 'DELETE', { version: source.version + 1 })).status).toBe(204);
  expect((await fetchLinksAdmin('api/publish/changes', 'POST', {})).status).toBe(200);
}, 60000);

 it('saves and reopens table designs, previews drafts and builds immutable published tables', async () => {
  const input = { title: 'Tables', slug: 'table-design-test', folderId: null, order: 0, description: '', contentJson: tableDocument };
  let page = identity.parse(await request('api/documents', 'POST', input));
  const reopened = z.object({ contentJson: z.unknown() }).parse(await request(`api/documents/${page.id}`));
  expect(reopened.contentJson).toEqual(tableDocument);
  const preview = await mf.dispatchFetch(`http://localhost/admin/preview/${page.id}?locale=en`);
  expect(await preview.text()).toContain('data-table-style="striped"');
  const publication = z.object({ document: identity }).parse(await request(`api/documents/${page.id}/publish`, 'POST', { version: page.version }));
  page = publication.document;
  const snapshot = await request('export/snapshot');
  const editedBody = structuredClone(tableDocument);
  editedBody.content[0]!.attrs.tableStyle = 'minimal';
  page = identity.parse(await request(`api/documents/${page.id}`, 'PUT', { ...input, contentJson: editedBody, version: page.version }));
  expect(await request('export/snapshot')).toEqual(snapshot);
  expect(await (await mf.dispatchFetch(`http://localhost/admin/preview/${page.id}?locale=en`)).text()).toContain('data-table-style="minimal"');
  await buildDocs();
  const html = await readFile(join(output, 'table-design-test/index.html'), 'utf8');
  for (const fragment of ['data-table-style="striped"', 'colspan="2"', 'rowspan="2"', 'width: 180px', 'text-align: center', '**literal**', 'Second paragraph', 'List item']) expect(html).toContain(fragment);
  expect(html).not.toContain('data-table-style="minimal"');
  await request(`api/documents/${page.id}`, 'DELETE', { version: page.version });
}, 30000);
