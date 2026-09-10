import { defaultLocale } from '../locales.ts';
import { publishedDocuments } from './schema.ts';

type Entry = { label: string; translations?: Record<string, string>; slug?: string; items?: Entry[] };
type OrderedEntry = Entry & { order: number; key: string; items?: OrderedEntry[] };

/** Convert the shared CMS hierarchy into Starlight's built-in sidebar configuration. */
export function cmsSidebar(snapshot: unknown): Entry[] {
  const documents = publishedDocuments(snapshot);
  const roots: OrderedEntry[] = [];
  const pages = new Map<string, typeof documents>();
  for (const doc of documents) pages.set(doc.id, [...(pages.get(doc.id) ?? []), doc]);
  for (const translations of pages.values()) {
    const page = translations.find((doc) => doc.locale === defaultLocale) ?? translations[0]!;
    let items = roots;
    for (const folder of page.navigation) {
      let group = items.find((entry) => entry.key === folder.slug && entry.items);
      if (!group) {
        group = { key: folder.slug, label: folder.label, translations: folder.translations, order: folder.order, items: [] };
        items.push(group);
      }
      items = group.items!;
    }
    items.push({ key: page.slug, label: page.title, order: page.order,
      slug: page.locale === defaultLocale ? page.slug : `${page.locale}/${page.slug}`,
      translations: Object.fromEntries(translations.map((doc) => [doc.locale, doc.title])),
    });
  }
  function sorted(items: OrderedEntry[]): Entry[] {
    return items.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)).map(({ key, order, items, ...entry }) => ({
      ...entry, ...(items ? { items: sorted(items) } : {}),
    }));
  }
  return sorted(roots);
}
