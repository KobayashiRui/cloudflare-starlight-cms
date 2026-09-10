import { z } from 'zod';
import { defaultLocale, supportedLocales } from '../locales.ts';

export const documentSchema = z.object({
  id: z.string().min(1),
  locale: z.enum(supportedLocales).default(defaultLocale),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
    .refine((slug) => !['admin', 'api', 'auth', '_astro', 'pagefind', '404'].includes(slug.split('/')[0]!), 'Reserved route'),
  description: z.string().default(''),
  section: z.string().default(''),
  navigation: z.array(z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), label: z.string().min(1), order: z.number().int().nonnegative(), translations: z.record(z.string(), z.string()) })).default([]),
  order: z.number().int().nonnegative().default(0),
  body: z.object({ format: z.literal('markdown'), value: z.string() }).strict(),
  status: z.literal('published'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime(),
}).strict();
export const snapshotSchema = z.object({ version: z.union([z.literal(1), z.literal(2), z.literal(3)]), documents: z.array(documentSchema) }).strict();
export type Document = z.infer<typeof documentSchema>;

export function publishedDocuments(input: unknown): Document[] {
  const { documents } = snapshotSchema.parse(input);
  const ids = new Set<string>(); const routes = new Set<string>();
  for (const doc of documents) {
    if (doc.locale === defaultLocale && supportedLocales.some((locale) => locale !== defaultLocale && doc.slug.split('/')[0] === locale)) throw new Error('Published route conflicts with a language prefix');
    const id = `${doc.locale}:${doc.id}`;
    const route = doc.locale === defaultLocale ? doc.slug : `${doc.locale}/${doc.slug}`;
    if (ids.has(id) || routes.has(route)) throw new Error('Duplicate published id or route');
    ids.add(id); routes.add(route);
  }
  return documents.sort((a, b) => a.locale.localeCompare(b.locale) || a.order - b.order || a.slug.localeCompare(b.slug));
}
