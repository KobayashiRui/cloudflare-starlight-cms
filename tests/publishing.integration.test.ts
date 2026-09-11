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

let mf: Miniflare;
let output: string;
beforeAll(async () => {
  output = await mkdtemp(join(tmpdir(), 'cms-publish-test-'));
  const bundle = await build({ entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'cms-test', modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['MEDIA_BUCKET'], serviceBindings: { ASSETS: () => new Response('Not found', { status: 404 }) } }] }));
  const db = await mf.getD1Database('DB');
  for (const file of ['0001_schema.sql', '0002_publish_delivery.sql']) {
    const sql = await readFile(`migrations/${file}`, 'utf8');
    await db.batch(sql.split(';').map((query) => query.trim()).filter(Boolean).map((query) => db.prepare(query)));
  }
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

it('redirects the bare admin path to the Access-protected admin path', async () => {
  const response = await mf.dispatchFetch('http://localhost/admin', { redirect: 'manual' });
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('/admin/');
});

it('keeps drafts private and exports folder labels/order; records public moves and deletion', async () => {
  const folder = z.object({ id: z.string() }).parse(await request('api/folders', 'POST', { name: 'Getting Started', slug: 'guides', order: 3 }));
  const input = { title: 'Install', slug: 'install', folderId: folder.id, order: 0, description: '', contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Public text' }] }] } };
  let page = identity.parse(await request('api/documents', 'POST', input));
  expect(publishedDocuments(await request('export/snapshot'))).toEqual([]);
  const result = z.object({ document: identity }).parse(await request(`api/documents/${page.id}/publish`, 'POST', { version: page.version }));
  page = result.document;
  const published = await request('export/snapshot');
  expect(cmsSidebar(published)[0]?.label).toBe('Getting Started');
  await buildDocs();
  expect(await readFile(join(output, 'guides/install/index.html'), 'utf8')).toContain('Getting Started');
  expect(await readFile(join(output, 'ja/guides/install/index.html'), 'utf8')).toContain('Public text');
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
