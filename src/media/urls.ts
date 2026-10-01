import type { JSONContent } from '@tiptap/core';

/** UUID object keys are stable across public domains and deployment versions. */
export function mediaObjectKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let path: string;
  try { path = new URL(value, 'https://cms.invalid').pathname; } catch { return null; }
  const published = /^\/_cms-media\/([a-z0-9-]+\.(?:png|jpg|webp|avif|mp4|webm))$/.exec(path);
  if (published) return `media/${published[1]}`;
  const match = /^(?:\/admin\/api\/media\/object)?\/(media\/[a-z0-9-]+\.(?:png|jpg|webp|avif|mp4|webm))$/.exec(path);
  return match?.[1] ?? null;
}

/** Resolve only registered originals; external media remains untouched. */
export function resolveContentMedia(content: JSONContent, keys: ReadonlySet<string>, target: 'admin' | 'public'): JSONContent;
export function resolveContentMedia(content: unknown, keys: ReadonlySet<string>, target: 'admin' | 'public'): unknown;
export function resolveContentMedia(content: unknown, keys: ReadonlySet<string>, target: 'admin' | 'public'): unknown {
  if (!content || typeof content !== 'object') return content;
  if (Array.isArray(content)) return content.map((item) => resolveContentMedia(item, keys, target));
  const value = { ...content };
  if ('attrs' in value && value.attrs && typeof value.attrs === 'object') {
    const attrs = { ...value.attrs };
    for (const [field, url] of Object.entries(attrs)) {
      if (!['src', 'href', 'poster'].includes(field)) continue;
      const key = mediaObjectKey(url);
      if (key && keys.has(key)) {
        Object.assign(attrs, { [field]: target === 'admin' ? `/admin/api/media/object/${key}` : `/_cms-media/${key.slice('media/'.length)}` });
      }
    }
    value.attrs = attrs;
  }
  if ('content' in value) value.content = resolveContentMedia(value.content, keys, target);
  if ('marks' in value) value.marks = resolveContentMedia(value.marks, keys, target);
  return value;
}
