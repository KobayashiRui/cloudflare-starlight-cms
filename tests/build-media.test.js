import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { staticMediaMarkdown, copyPublishedMedia } from '../scripts/build-media.mjs';
import { resolveContentMedia } from '../src/media/urls.ts';

const key = 'media/12345678-1234-1234-1234-123456789abc.png';
const old = `https://old-media.example.com/${key}`;
const publicUrl = '/_cms-media/12345678-1234-1234-1234-123456789abc.png';
const records = [{ objectKey: key, contentType: 'image/png', size: 4 }];
const media = new Map(records.map((record) => [record.objectKey, record]));
let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

it('resolves registered legacy originals without a public domain setting or changing stored JSON', () => {
  const original = { type: 'doc', content: [{ type: 'image', attrs: { src: old } }, { type: 'video', attrs: { src: 'https://external.example/video.mp4' } }] };
  const admin = resolveContentMedia(original, new Set([key]), 'admin');
  expect(admin.content[0].attrs.src).toBe(`/admin/api/media/object/${key}`);
  expect(admin.content[1]).toEqual(original.content[1]);
  expect(original.content[0].attrs.src).toBe(old);
  expect(resolveContentMedia(original, new Set([key]), 'public').content[0].attrs.src).toBe(publicUrl);
});

it('rewrites image, video, table and download destinations while preserving code and prose', () => {
  const markdown = `![image](${old}?v=1)\n\n[download](${old})\n\n<video src="${old}" poster="${old}"></video>\n\n<table><tr><td><img src="${old}"></td></tr></table>\n\n${old}\n\n\`${old}\`\n\n\`\`\`html\n<img src="${old}">\n\`\`\``;
  const used = new Set();
  const result = staticMediaMarkdown(markdown, media, used);
  expect(result).toContain(`![image](${publicUrl})`);
  expect(result).toContain(`[download](${publicUrl})`);
  expect(result).toContain(`<video src="${publicUrl}" poster="${publicUrl}">`);
  expect(result).toContain(`<td><img src="${publicUrl}">`);
  expect(result).toContain(`\`${old}\``);
  expect(result).toContain(`\n<img src="${old}">\n\`\`\``);
  expect(used).toEqual(new Set([key]));
  expect(staticMediaMarkdown('![external](https://external.example/image.png)', media, new Set())).toContain('https://external.example/image.png');
});

it('copies a shared original once and rejects incomplete or missing files', async () => {
  directory = await mkdtemp(join(tmpdir(), 'cms-media-test-'));
  const snapshot = { version: 3, documents: [{ body: { format: 'markdown', value: `![image](${old})` } }, { body: { format: 'markdown', value: `![image](${publicUrl})` } }] };
  const calls = [];
  const result = await copyPublishedMedia(snapshot, records, directory, async (path) => {
    calls.push(path);
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  });
  expect(calls).toEqual([`/admin/api/media/object/${key}`]);
  expect(await readFile(join(directory, key.slice('media/'.length)))).toEqual(Buffer.from([137, 80, 78, 71]));
  expect(result.documents[0].body.value).toContain(publicUrl);
  expect(snapshot.documents[0].body.value).toContain(old);
  await expect(copyPublishedMedia(snapshot, records, directory, async () => new Response('x', { headers: { 'content-type': 'image/png' } }))).rejects.toThrow('metadata');
  expect(() => staticMediaMarkdown('![gone](/admin/api/media/object/media/gone.png)', media, new Set())).toThrow('missing');
});

it('keeps credentials on the CMS origin and permits legacy fallback only for a missing build API', async () => {
  const { createServer } = await import('node:http');
  const { cmsRequest, buildRequest } = await import('../scripts/build-client.mjs');
  const calls = [];
  const server = createServer((request, response) => {
    calls.push(request.url);
    if (request.url === '/redirect') { response.writeHead(302, { location: '/stolen' }); response.end(); }
    else { response.writeHead(request.url.startsWith('/admin/api/publish/builds') ? 405 : Number(request.url.slice(1))); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    expect(await cmsRequest(origin, '/404', 'POST', true)).toBeNull();
    expect(await buildRequest(origin, '', 'POST', true)).toBeNull();
    await expect(cmsRequest(origin, '/405', 'POST', true)).rejects.toThrow('405');
    await expect(buildRequest(origin, '', 'GET', true)).rejects.toThrow('405');
    await expect(buildRequest(origin, '/lease/cleanup', 'POST', true)).rejects.toThrow('405');
    await expect(buildRequest(origin)).rejects.toThrow('405');
    await expect(cmsRequest(origin, '/401', 'POST', true)).rejects.toThrow('401');
    await expect(cmsRequest(origin, '/500', 'POST', true)).rejects.toThrow('500');
    await expect(cmsRequest(origin, '/redirect')).rejects.toThrow();
    await expect(cmsRequest(origin, 'https://external.example/admin/export/snapshot')).rejects.toThrow('configured origin');
    expect(calls).not.toContain('/stolen');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
