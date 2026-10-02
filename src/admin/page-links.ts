import { createContext } from 'react';
import Link from '@tiptap/extension-link';
import type { LinkPage } from '../documents/links';

// Tiptap official extension points; keep the built-in link mark and commands.
export const PageLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      documentId: { default: null, parseHTML: (element) => element.getAttribute('data-document-id'), renderHTML: (attrs) => attrs.documentId ? { 'data-document-id': attrs.documentId } : {} },
      anchor: { default: null, parseHTML: (element) => element.getAttribute('data-anchor'), renderHTML: (attrs) => attrs.anchor ? { 'data-anchor': attrs.anchor } : {} },
    };
  },
}).configure({ openOnClick: false, enableClickSelection: true, HTMLAttributes: { target: null, rel: 'noopener noreferrer' } });

export type PageLinkOption = { id: string; title: string; path: string; locale: string; draft: boolean };
export const PageLinksContext = createContext<{ pages: PageLinkOption[]; loadPage: (id: string) => Promise<LinkPage> } | null>(null);
