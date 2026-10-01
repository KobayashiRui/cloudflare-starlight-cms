import { z } from 'zod';
import GithubSlugger from 'github-slugger';
import { defaultLocale } from '../locales.ts';
import { parseTiptapNode, tiptapChildren, type TiptapNode } from '../starlight/tiptap.ts';

export type HeadingTarget = { id: string; level: number; text: string };
export type LinkPage = { id: string; locale: string; title: string; path: string; content: unknown };
const referenceSchema = z.object({ documentId: z.uuid(), anchor: z.string().max(500).nullable().optional() });
export function pageReference(attrs: Record<string, unknown> = {}) {
  if (attrs.documentId == null) return null;
  return referenceSchema.parse(attrs);
}
export function headingText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return tiptapChildren(node).map(headingText).join('');
}
/** Account for the tab labels emitted as Markdown headings by the public renderer. */
export function documentHeadings(content: unknown): HeadingTarget[] {
  const slugger = new GithubSlugger();
  const headings: HeadingTarget[] = [];
  function visit(node: TiptapNode) {
    // Cell headings are formatting within a table, not page sections in Astro.
    if (node.type === 'table') return;
    if (node.type === 'heading' || node.type === 'tab') {
      const text = node.type === 'tab' ? String(node.attrs?.label ?? 'Tab') : headingText(node);
      const id = slugger.slug(text);
      if (node.type === 'heading') headings.push({ id, level: Number(node.attrs?.level ?? 2), text });
    }
    tiptapChildren(node).forEach(visit);
  }
  visit(parseTiptapNode(content));
  return headings;
}
export function publicPageUrl(path: string, locale: string): string {
  return `/${locale === defaultLocale ? '' : `${locale}/`}${path}/`;
}
export function navigationPath(id: string, items: readonly { id: string; parentId: string | null; slug: string }[]): string {
  const segments: string[] = []; const seen = new Set<string>();
  let cursor: string | null = id;
  while (cursor) {
    if (seen.has(cursor)) throw new Error('Navigation cycle');
    seen.add(cursor);
    const item = items.find((entry) => entry.id === cursor);
    if (!item) throw new Error('Missing navigation item');
    segments.unshift(item.slug); cursor = item.parentId;
  }
  return segments.join('/');
}
/** Only the supplied content set is used: drafts for Preview, revisions for public export. */
export function resolveDocumentLinks(content: unknown, source: { id: string; locale: string; title: string }, pages: readonly LinkPage[], preview = false): unknown {
  function visit(node: TiptapNode): TiptapNode {
    const marks = Array.isArray(node.marks) ? node.marks : [];
    return { ...node, ...(Array.isArray(node.content) ? { content: tiptapChildren(node).map(visit) } : {}),
      ...(Array.isArray(node.marks) ? { marks: marks.flatMap((mark) => {
        if (!mark || typeof mark !== 'object' || !('type' in mark) || mark.type !== 'link') return [mark];
        const typed = z.looseObject({ type: z.literal('link'), attrs: z.record(z.string(), z.unknown()) }).parse(mark);
        const ref = pageReference(typed.attrs);
        if (!ref) return [mark];
        const target = pages.find((page) => page.id === ref.documentId && page.locale === source.locale)
          ?? pages.find((page) => page.id === ref.documentId && page.locale === defaultLocale);
        const validAnchor = !ref.anchor || target && documentHeadings(target.content).some((heading) => heading.id === ref.anchor);
        if (!target || !validAnchor) {
          if (preview) return []; // Deleted draft targets remain readable as ordinary text.
          throw new Error(`“${source.title}”: linked page or heading is unavailable (${ref.documentId}${ref.anchor ? `#${ref.anchor}` : ''}). Reselect the link target.`);
        }
        const hash = ref.anchor ? `#${encodeURIComponent(ref.anchor)}` : '';
        const samePage = source.id === target.id && source.locale === target.locale;
        const href = samePage && hash ? hash : preview
          ? `/admin/preview/${target.id}?locale=${encodeURIComponent(target.locale)}${hash}`
          : `${publicPageUrl(target.path, target.locale)}${hash}`;
        return [{ ...typed, attrs: { ...typed.attrs, href } }];
      }) } : {}) };
  }
  return visit(parseTiptapNode(content));
}
