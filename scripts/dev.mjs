import { spawn } from 'node:child_process';

const cmsPort = Number(process.env.CMS_PORT ?? 8787);
const docsPort = Number(process.env.DOCS_PORT ?? 4321);
const cmsUrl = `http://127.0.0.1:${cmsPort}/admin/export/snapshot`;
const children = new Set();
let stopping = false;
let timer;

function stop() {
  stopping = true;
  clearTimeout(timer);
  for (const child of children) child.kill('SIGTERM');
}
function start(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: 'inherit', env });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}
function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = start(command, args, env);
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}
function server(command, args, env) {
  const child = start(command, args, env);
  const failed = (message) => {
    if (stopping) return;
    console.error(message);
    process.exitCode = 1;
    stop();
  };
  child.once('error', (error) => failed(error.message));
  child.once('exit', () => failed(`${command} stopped unexpectedly`));
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function snapshot() {
  const response = await fetch(cmsUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`CMS export returned ${response.status}`);
  return response.text();
}
async function ready() {
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try { return await snapshot(); } catch { await wait(500); }
  }
  throw new Error('Local CMS did not become ready');
}
const cli = (name) => `node_modules/${name}/bin/${name === 'wrangler' ? 'wrangler.js' : 'astro.mjs'}`;
async function build() {
  await run(process.execPath, [cli('astro'), 'build'], { ...process.env, CMS_EXPORT_URL: cmsUrl });
  // Match production: both public and Admin assets are served from the configured
  // Static Assets directory. Astro clears dist, so recreate the Admin bundle after it.
  await run(process.execPath, ['scripts/build-admin.mjs']);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  if (![cmsPort, docsPort].every((port) => Number.isInteger(port) && port > 0 && port < 65536) || cmsPort === docsPort) throw new Error('CMS_PORT and DOCS_PORT must be distinct valid ports');
  // Local development always uses Miniflare state. Applying migrations is idempotent
  // and avoids a separate first-run command without touching a remote D1 database.
  await run(process.execPath, [cli('wrangler'), 'd1', 'migrations', 'apply', 'DB', '--local'], { ...process.env, CI: '1' });
  await run(process.execPath, ['scripts/build-admin.mjs']);
  server(process.execPath, ['scripts/build-admin.mjs', '--watch']);
  server(process.execPath, [cli('wrangler'), 'dev', '--local', '--log-level', 'warn', '--port', String(cmsPort), '--var', 'LOCAL_DEV_BUILD:true']);
  let completed = await ready();
  if (stopping) throw new Error('Development server stopped');
  await build();
  if (stopping) throw new Error('Development server stopped');
  server(process.execPath, [cli('astro'), 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(docsPort)], { ...process.env, ASTRO_PREVIEW_BACKGROUND: 'false' });
  console.log(`Admin: http://127.0.0.1:${cmsPort}/admin/\nPublished docs: http://127.0.0.1:${docsPort}/`);
  let failed;
  async function poll() {
    try {
      const next = await snapshot();
      if (next !== completed && next !== failed && !stopping) {
        console.log('Published content changed. Building docs…');
        try { await build(); completed = next; failed = undefined; console.log('Docs rebuilt. Refresh the public page.'); }
        catch (error) { failed = next; throw error; }
      }
    } catch (error) {
      if (!stopping) console.error('Local build/export failed. Fix the error and restart dev, or publish a new change.', error.message);
    } finally {
      if (!stopping) timer = setTimeout(poll, 1000);
    }
  }
  if (!stopping) timer = setTimeout(poll, 1000);
} catch (error) {
  if (!stopping) { console.error(error.message); process.exitCode = 1; }
  stop();
}
