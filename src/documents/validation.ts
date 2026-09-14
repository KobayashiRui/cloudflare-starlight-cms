import { z } from 'zod';
import { assertDocumentContentUrls } from './content-urls.ts';
export const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase URL segments').refine((value) => !['admin', 'api', 'auth', '_astro', 'pagefind', '404'].includes(value), 'Reserved route');
const jsonNode = z.looseObject({ type: z.string().min(1) });
export const contentJson = z.looseObject({ type: z.literal('doc'), content: z.array(jsonNode).optional() }).superRefine((value, context) => {
  try {
    assertDocumentContentUrls(value);
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid document URL' });
  }
});
export const documentInput = z.object({ title: z.string().trim().min(1).max(200), slug, description: z.string().trim().max(300).default(''), contentJson, folderId: z.uuid().nullable().default(null), order: z.number().int().min(0).max(100000).default(0) });
export const documentUpdate = documentInput.extend({ version: z.number().int().positive() });
export type DocumentInput = z.infer<typeof documentInput>;
export function serializeContent(content: z.infer<typeof contentJson>) { return JSON.stringify(content); }
export function parseContent(input: string) { return contentJson.parse(JSON.parse(input)); }
