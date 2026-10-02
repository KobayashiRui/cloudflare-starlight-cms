import { siteConfig } from '../src/site.config.ts';

export function buildOrigin() {
  const endpoint = process.env.CMS_EXPORT_URL || siteConfig.url;
  return endpoint ? new URL(endpoint).origin : null;
}

/** Credentials stay on the configured CMS origin; redirects are always rejected. */
export async function cmsRequest(origin, path, method = 'GET', allowMissing = false) {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('Both Access build secrets must be configured');
  const headers = { 'X-Requested-With': 'cloudflare-starlight-cms' };
  if (clientId && clientSecret) {
    headers['CF-Access-Client-Id'] = clientId;
    headers['CF-Access-Client-Secret'] = clientSecret;
  }
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error('CMS requests must use the configured origin');
  const response = await fetch(url, { method, headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  // Legacy Workers forward unknown Admin routes to ASSETS, which rejects POST with 405.
  const legacyBuildProbe = method === 'POST' && path === '/admin/api/publish/builds';
  if (allowMissing && (response.status === 404 || (legacyBuildProbe && response.status === 405))) return null;
  if (!response.ok) throw new Error(`CMS build operation failed (${response.status}: ${method} ${url.pathname})`);
  return response;
}

export async function buildRequest(origin, path, method = 'POST', allowMissing = false) {
  const response = await cmsRequest(origin, `/admin/api/publish/builds${path}`, method, allowMissing);
  return !response || response.status === 204 ? null : response.json();
}

export async function cleanupBuild(origin, id) {
  let revisionsDeleted = 0; let mediaDeleted = 0;
  for (;;) {
    const batch = await buildRequest(origin, `/${id}/cleanup`);
    revisionsDeleted += batch.revisionsDeleted; mediaDeleted += batch.mediaDeleted;
    if (batch.skipped) { console.log('Legacy production media remains protected; cleanup will run on a later build.'); return; }
    if (!batch.more) break;
  }
  console.log(`Storage cleanup complete: ${revisionsDeleted} revisions, ${mediaDeleted} media files removed.`);
}
