import type { Loader } from 'astro/loaders';
import { publishedDocuments } from './schema.ts';

export function cmsLoader(options: { loadSnapshot: () => Promise<unknown> }): Loader {
  return {
    name: 'starlight-cms',
    async load({ store, parseData, renderMarkdown, generateDigest }) {
      const documents = publishedDocuments(await options.loadSnapshot());
      const entries = await Promise.all(documents.map(async (doc) => ({
        id: doc.slug, filePath: `src/content/docs/${doc.slug}.md`,
        data: await parseData({ id: doc.slug, data: { title: doc.title, description: doc.description, sidebar: { order: doc.order }, editUrl: false } }),
        body: doc.body.value, rendered: await renderMarkdown(doc.body.value), digest: generateDigest(doc),
      })));
      store.clear();
      for (const entry of entries) store.set(entry);
    },
  };
}
