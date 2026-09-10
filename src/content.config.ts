import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { cmsLoader } from './starlight/loader.ts';

async function snapshot(): Promise<unknown> {
  const endpoint = process.env.CMS_EXPORT_URL;
  if (!endpoint) {
    if (process.env.CMS_INITIAL_EMPTY === '1') return { version: 3, documents: [] };
    throw new Error('CMS_EXPORT_URL is required for a CMS build. Use CMS_INITIAL_EMPTY=1 only for an explicit empty initial build.');
  }
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be set together');
  const headers = clientId && clientSecret
    ? { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret }
    : undefined;
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`CMS export failed: ${response.status}`);
  return response.json();
}

export const collections = {
  docs: defineCollection({
    loader: cmsLoader({ loadSnapshot: snapshot }),
    schema: docsSchema(),
  }),
};
