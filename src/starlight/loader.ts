import type { Loader } from 'astro/loaders';
import { defaultLocale } from '../locales.ts';
import { publishedDocuments } from './schema.ts';

export function cmsLoader(options: { loadSnapshot: () => Promise<unknown> }): Loader {
  return {
    name: 'starlight-cms',
    async load({ store, parseData, renderMarkdown, generateDigest }) {
      const documents = publishedDocuments(await options.loadSnapshot());
      const entries = await Promise.all(documents.map(async (doc) => {
        const id = doc.locale === defaultLocale ? doc.slug : `${doc.locale}/${doc.slug}`;
        return {
        id, filePath: `src/content/docs/${id}.md`,
        data: await parseData({ id, data: { title: doc.title, description: doc.description, sidebar: { order: doc.order }, editUrl: false } }),
        body: doc.body.value, rendered: await renderMarkdown(doc.body.value), digest: generateDigest(doc),
      }; }));
      store.clear();
      for (const entry of entries) store.set(entry);
    },
  };
}
