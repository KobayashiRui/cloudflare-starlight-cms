import { resolveContentMedia } from '../media/urls.ts';
import { registeredMediaKeys } from '../media/references.ts';
import { z } from 'zod';
import type { RuntimeEnv } from '../env.ts';
import { navigationPath, resolveDocumentLinks, type LinkPage } from './links.ts';
import { renderDocumentContent } from '../starlight/render.ts';

export type LinkOverride = { document_id: string; locale: string; title: string; content_json: string };
export async function loadLinkPages(env: RuntimeEnv, drafts = false, overrides: readonly LinkOverride[] = []): Promise<LinkPage[]> {
  const [folders, documents, translations] = await env.DB.batch([
    env.DB.prepare('SELECT id,parent_id,slug FROM folder'),
    env.DB.prepare('SELECT id,folder_id,slug FROM document'),
    env.DB.prepare(drafts
      ? 'SELECT document_id,locale,title,content_json FROM document_translation'
      : `SELECT t.document_id,t.locale,r.title,r.content_json FROM document_translation t JOIN document_revision r ON r.id=t.published_revision_id`),
  ]);
  if (!folders || !documents || !translations) throw new Error('Incomplete link content snapshot');
  const folderRows = z.array(z.object({ id: z.string(), parent_id: z.string().nullable(), slug: z.string() })).parse(folders.results);
  const documentRows = z.array(z.object({ id: z.string(), folder_id: z.string().nullable(), slug: z.string() })).parse(documents.results);
  const rows = z.array(z.object({ document_id: z.string(), locale: z.string(), title: z.string(), content_json: z.string() })).parse(translations.results);
  for (const row of overrides) {
    const index = rows.findIndex((entry) => entry.document_id === row.document_id && entry.locale === row.locale);
    if (index < 0) rows.push(row); else rows[index] = row;
  }
  const tree = [
    ...folderRows.map((row) => ({ id: `folder:${row.id}`, parentId: row.parent_id ? `folder:${row.parent_id}` : null, slug: row.slug })),
    ...documentRows.map((row) => ({ id: row.id, parentId: row.folder_id ? `folder:${row.folder_id}` : null, slug: row.slug })),
  ];
  return rows.map((row) => ({ id: row.document_id, locale: row.locale, title: row.title, content: JSON.parse(row.content_json), path: navigationPath(row.document_id, tree) }));
}
export async function assertPublishedLinks(env: RuntimeEnv, overrides: readonly LinkOverride[] = [], removed?: { id: string; locale: string }) {
  const pages = (await loadLinkPages(env, false, overrides)).filter((page) => !removed || page.id !== removed.id || page.locale !== removed.locale);
  const keys = await registeredMediaKeys(env.DB);
  for (const page of pages) renderDocumentContent(resolveContentMedia(resolveDocumentLinks(page.content, page, pages), keys, 'public'));
}
