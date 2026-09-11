import { publicSiteUrl } from './public-url.ts';

async function fetchSnapshot(): Promise<unknown> {
  if (process.env.CMS_INITIAL_EMPTY === '1') return { version: 3, documents: [] };
  const endpoint = process.env.CMS_EXPORT_URL
    ?? (publicSiteUrl ? new URL('/admin/export/snapshot', publicSiteUrl).toString() : undefined);
  // A blank URL is the template's explicit bootstrap state. Once configured,
  // all build failures stay visible instead of publishing an empty fallback.
  if (!endpoint) return { version: 3, documents: [] };
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
