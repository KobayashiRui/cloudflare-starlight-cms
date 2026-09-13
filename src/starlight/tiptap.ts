import { z } from 'zod';

const tiptapNode = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  content: z.array(z.unknown()).optional(),
});

export type TiptapNode = z.infer<typeof tiptapNode>;

export function parseTiptapNode(value: unknown): TiptapNode {
  return tiptapNode.parse(value);
}

export function tiptapChildren(value: TiptapNode): TiptapNode[] {
  return (value.content ?? []).map(parseTiptapNode);
}

/** Reject URLs that cannot safely appear in a public document or preview. */
export function documentUrl(value: unknown): string {
  if (typeof value !== 'string' || (!/^https?:\/\//.test(value) && !value.startsWith('/'))) {
    throw new Error('Unsafe media or link URL');
  }
  if (value.startsWith('/admin/api/media/object/')) {
    throw new Error('Published media requires MEDIA_PUBLIC_URL');
  }
  return value.replace(/["<>]/g, '');
}
