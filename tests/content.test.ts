import { describe, expect, it } from 'vitest';
import { publishedDocuments } from '../src/starlight/schema.ts';
import { renderDocumentContent } from '../src/starlight/render.ts';

const published = {
  version: 2,
  documents: [{
    id: 'one', title: 'One', slug: 'one', description: '', section: '', order: 1,
    body: { format: 'markdown', value: '# One' }, status: 'published',
    createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z', publishedAt: '2026-09-09T00:00:00.000Z',
  }],
};

describe('published build boundary', () => {
  it('accepts a versioned published snapshot and rejects duplicate routes', () => {
    expect(publishedDocuments(published).map((doc) => doc.slug)).toEqual(['one']);
    expect(() => publishedDocuments({ ...published, documents: [...published.documents, { ...published.documents[0], id: 'two' }] })).toThrow('Duplicate');
  });
  it.each(['../secret', '/absolute', 'admin', 'admin/users', 'a//b', 'a?b'])('rejects reserved or invalid slug %s', (slug) => {
    expect(() => publishedDocuments({ ...published, documents: [{ ...published.documents[0], slug }] })).toThrow();
  });
});

describe('Tiptap renderer', () => {
  it('renders basic text, links, media and Docs blocks without executing content', () => {
    const markdown = renderDocumentContent({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Guide', marks: [{ type: 'bold' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Read ', marks: [] }, { type: 'text', text: 'this', marks: [{ type: 'link', attrs: { href: '/guide' } }] }] },
      { type: 'image', attrs: { src: '/media/image.png', alt: 'Image' } },
      { type: 'callout', attrs: { title: 'Note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Safe.' }] }] },
    ] });
    expect(markdown).toContain('## **Guide**');
    expect(markdown).toContain('[this](/guide)');
    expect(markdown).toContain('![Image](/media/image.png)');
    expect(markdown).toContain(':::note[Note]');
  });
  it('rejects unknown nodes and unsafe URLs instead of silently dropping them', () => {
    expect(() => renderDocumentContent({ type: 'doc', content: [{ type: 'script' }] })).toThrow('Unsupported');
    expect(() => renderDocumentContent({ type: 'image', attrs: { src: 'javascript:alert(1)' } })).toThrow('Unsafe');
    expect(() => renderDocumentContent({ type: 'image', attrs: { src: '/admin/api/media/object/media/example.png' } })).toThrow('MEDIA_PUBLIC_URL');
  });
});
