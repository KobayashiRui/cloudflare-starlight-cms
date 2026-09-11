import { siteConfig } from '../site.config.ts';

async function fetchSnapshot(): Promise<unknown> {
  const endpoint = process.env.CMS_EXPORT_URL
    ?? (siteConfig.url ? new URL('/admin/export/snapshot', siteConfig.url).toString() : undefined);
  if (!endpoint) {
    if (process.env.CMS_INITIAL_EMPTY === '1') return { version: 3, documents: [] };
    throw new Error('Set siteConfig.url before a CMS build. Use CMS_INITIAL_EMPTY=1 only for an explicit empty initial build.');
  }
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be set together');
  const headers = clientId && clientSecret
    ? { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret }
    : undefined;
  const response = await fetch(endpoint, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`CMS export failed: ${response.status}`);
  return response.json();
}


// Astro config and the content loader must use the same export, even when bundled separately.
declare global { var cmsBuildSnapshot: Promise<unknown> | undefined; }
export function loadSnapshot(): Promise<unknown> {
  return globalThis.cmsBuildSnapshot ??= fetchSnapshot();
}
