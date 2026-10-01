import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOrigin, buildRequest, cmsRequest, cleanupBuild } from './build-client.mjs';
import { copyPublishedMedia } from './build-media.mjs';
import { snapshotSchema, publishedDocuments } from '../src/starlight/schema.ts';

const args = process.argv.slice(2);
const outDir = args.includes('--outDir') ? args[args.indexOf('--outDir') + 1] : 'dist';
const origin = process.env.CMS_INITIAL_EMPTY === '1' ? null : buildOrigin();
let build; let temporary;
function run(script, arguments_ = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...arguments_], { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('CMS build failed')));
  });
}
try {
  let env = process.env;
  if (origin) {
    // Existing Workers have export/media APIs but no build lease API. Skip GC on that first build.
    build = await buildRequest(origin, '', 'POST', true);
    const snapshot = snapshotSchema.parse(build?.snapshot ?? await (await cmsRequest(origin, '/admin/export/snapshot')).json());
    publishedDocuments(snapshot);
    const records = await (await cmsRequest(origin, '/admin/api/media')).json();
    if (!Array.isArray(records)) throw new Error('Invalid CMS media list');
    temporary = await mkdtemp(join(tmpdir(), 'cms-build-'));
    const prepared = await copyPublishedMedia(snapshot, records, join(temporary, 'media'), (path) => cmsRequest(origin, path));
    const file = join(temporary, 'snapshot.json');
    await writeFile(file, JSON.stringify(prepared));
    env = { ...process.env, CMS_SNAPSHOT_FILE: file };
  }
  await run('node_modules/astro/bin/astro.mjs', ['build', ...args], env);
  await run('scripts/build-admin.mjs', [], { ...process.env, ADMIN_ASSETS_DIR: process.env.ADMIN_ASSETS_DIR ?? outDir });
  if (temporary) await cp(join(temporary, 'media'), join(outDir, '_cms-media'), { recursive: true });
  await mkdir(join(outDir, 'admin'), { recursive: true });
  await writeFile(join(outDir, 'admin', 'cms-build.json'), JSON.stringify({ media: 'static' }));
  // All referenced files are now in the build output. Production already has its own static copies.
  if (build) {
    await cleanupBuild(origin, build.id);
    await buildRequest(origin, `/${build.id}`, 'DELETE');
    build = null;
  }
} catch (error) {
  if (build) await buildRequest(origin, `/${build.id}`, 'DELETE').catch(() => {});
  process.exitCode = 1;
  console.error(error instanceof Error ? error.message : 'CMS build failed');
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
