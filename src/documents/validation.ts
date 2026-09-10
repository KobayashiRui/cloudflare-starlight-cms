import { z } from 'zod';
export const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase URL segments').refine((value) => !['admin', 'api', 'auth', '_astro', 'pagefind', '404'].includes(value), 'Reserved route');
const jsonNode = z.object({ type: z.string().min(1) }).passthrough();
export const contentJson = z.object({ type: z.literal('doc'), content: z.array(jsonNode).optional() }).passthrough();
export const documentInput = z.object({ title: z.string().trim().min(1).max(200), slug, description: z.string().trim().max(300).default(''), contentJson, folderId: z.string().uuid().nullable().default(null), order: z.number().int().min(0).max(100000).default(0) });
export const documentUpdate = documentInput.extend({ version: z.number().int().positive() });
export type DocumentInput = z.infer<typeof documentInput>;
export function serializeContent(content: z.infer<typeof contentJson>) { return JSON.stringify(content); }
export function parseContent(input: string) { return contentJson.parse(JSON.parse(input)); }
