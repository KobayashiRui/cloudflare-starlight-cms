import { z } from 'zod';
import type { RuntimeEnv } from '../env.ts';
import { defaultLocale } from '../locales.ts';
import { renderDocumentContent } from './render.ts';

const folderRow = z.object({ id: z.string(), parent_id: z.string().nullable(), slug: z.string(), sort_order: z.number() });
type Folder = z.infer<typeof folderRow>;
const labelRow = z.object({ folder_id: z.string(), locale: z.string(), name: z.string() });
const pageRow = z.object({ id: z.string(), folder_id: z.string().nullable(), slug: z.string(), sort_order: z.number(), locale: z.string(), title: z.string(), description: z.string(), content_json: z.string(), created_at: z.number(), updated_at: z.number(), published_at: z.number() });

export async function publishedSnapshot(env: RuntimeEnv) {
  const [folders, labels, pages] = await env.DB.batch([
    env.DB.prepare('SELECT id,parent_id,slug,sort_order FROM folder ORDER BY id'),
    env.DB.prepare('SELECT folder_id,locale,name FROM folder_translation ORDER BY folder_id,locale'),
    env.DB.prepare(`SELECT d.id,d.folder_id,d.slug,d.sort_order,t.locale,r.title,r.description,r.content_json,
      t.created_at,r.created_at AS updated_at,t.published_at
      FROM document d JOIN document_translation t ON t.document_id=d.id
      JOIN document_revision r ON r.id=t.published_revision_id
      ORDER BY t.locale,d.sort_order,d.slug,d.id`),
  ]);
  if (!folders || !labels || !pages) throw new Error('Incomplete published snapshot');
  const parent = new Map(z.array(folderRow).parse(folders.results).map((row) => [row.id, row]));
  const names = z.array(labelRow).parse(labels.results);
  return { version: 3, documents: z.array(pageRow).parse(pages.results).map((row) => {
    const ancestors: Folder[] = []; const seen = new Set<string>(); let cursor = row.folder_id;
    while (cursor) {
      if (seen.has(cursor)) throw new Error('Navigation cycle');
      seen.add(cursor);
      const folder = parent.get(cursor);
      if (!folder) throw new Error('Missing folder');
      ancestors.unshift(folder); cursor = folder.parent_id;
    }
    return {
      id: row.id, locale: row.locale, title: row.title,
      slug: [...ancestors.map((folder) => folder.slug), row.slug].join('/'),
      description: row.description, order: row.sort_order,
      navigation: ancestors.map((folder) => ({
        slug: folder.slug, order: folder.sort_order,
        label: names.find((name) => name.folder_id === folder.id && name.locale === defaultLocale)?.name ?? folder.slug,
        translations: Object.fromEntries(names.filter((name) => name.folder_id === folder.id).map((name) => [name.locale, name.name])),
      })),
      body: { format: 'markdown', value: renderDocumentContent(JSON.parse(row.content_json)) },
      status: 'published', createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(), publishedAt: new Date(row.published_at).toISOString(),
    };
  }) };
}
