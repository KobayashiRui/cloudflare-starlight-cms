import { z } from 'zod';

export const documentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
    .refine((slug) => !['admin', 'api', 'auth', '_astro', 'pagefind', '404'].includes(slug.split('/')[0]!), 'Reserved route'),
  description: z.string().default(''),
  section: z.string().default(''),
  order: z.number().int().nonnegative().default(0),
  body: z.object({ format: z.literal('markdown'), value: z.string() }).strict(),
  status: z.literal('published'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime(),
}).strict();
export const snapshotSchema = z.object({ version: z.union([z.literal(1), z.literal(2)]), documents: z.array(documentSchema) }).strict();
export type Document = z.infer<typeof documentSchema>;

export function publishedDocuments(input: unknown): Document[] {
  const { documents } = snapshotSchema.parse(input);
  const ids = new Set<string>(); const slugs = new Set<string>();
  for (const doc of documents) {
    if (ids.has(doc.id) || slugs.has(doc.slug)) throw new Error('Duplicate published id or slug');
    ids.add(doc.id); slugs.add(doc.slug);
  }
  return documents.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
