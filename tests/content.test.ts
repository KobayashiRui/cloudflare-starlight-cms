import { describe, expect, it } from 'vitest';
import { publishedDocuments } from '../src/starlight/schema.ts';
import { renderDocumentContent } from '../src/starlight/render.ts';
import { renderPreviewContent, renderPreviewDocument, renderPreviewTocItems } from '../src/starlight/preview-render.ts';
import { supportedLocales } from '../src/locales.ts';

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
    const alternateLocale = supportedLocales.find((locale) => locale !== 'en');
    expect(publishedDocuments({ ...published, version: 3, documents: alternateLocale ? [...published.documents, { ...published.documents[0], locale: alternateLocale }] : published.documents })).toHaveLength(alternateLocale ? 2 : 1);
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
      { type: 'youtube', attrs: { src: 'https://youtu.be/dQw4w9WgXcQ' } },
      { type: 'callout', attrs: { title: 'Note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Safe.' }] }] },
    ] });
    expect(markdown).toContain('## **Guide**');
    expect(markdown).toContain('[this](/guide)');
    expect(markdown).toContain('![Image](/media/image.png)');
    expect(markdown).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(markdown).toContain(':::note[Note]');
  });
  it('rejects unknown nodes and unsafe URLs instead of silently dropping them', () => {
    expect(() => renderDocumentContent({ type: 'doc', content: [{ type: 'script' }] })).toThrow('Unsupported');
    expect(() => renderDocumentContent({ type: 'image', attrs: { src: 'javascript:alert(1)' } })).toThrow('Unsafe');
    expect(() => renderDocumentContent({ type: 'image', attrs: { src: '/admin/api/media/object/media/example.png' } })).toThrow('MEDIA_PUBLIC_URL');
    expect(() => renderDocumentContent({ type: 'youtube', attrs: { src: 'https://example.com/video' } })).toThrow('Invalid YouTube URL');
  });
  it('renders task lists and rules created by the Simple Editor toolbar', () => {
    const markdown = renderDocumentContent({ type: 'doc', content: [
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install the CMS' }] }] }] },
      { type: 'horizontalRule' },
    ] });
    expect(markdown).toContain('- [x] Install the CMS');
    expect(markdown).toContain('---');
  });
  it('uses the supported CMS node set inside the generated Starlight shell', () => {
    const html = renderPreviewContent({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Draft <guide>' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Read ', marks: [] }, { type: 'text', text: 'this', marks: [{ type: 'link', attrs: { href: '/guide' } }] }] },
      { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
      { type: 'callout', attrs: { title: 'Note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Safe.' }] }] },
    ] });
    expect(html).toContain('<h2 id="draft-guide">Draft &lt;guide&gt;</h2>');
    expect(html).toContain('<a href="/guide">this</a>');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('starlight-aside--note');
    expect(() => renderPreviewContent({ type: 'doc', content: [{ type: 'script' }] })).toThrow('Unsupported');
    expect(() => renderPreviewContent({ type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] })).toThrow('Unsafe');
  });
  it('derives stable heading anchors and nested TOC entries from the same saved document', () => {
    const preview = renderPreviewDocument({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Getting Started' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Install' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Getting Started' }] },
      { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Ignored' }] },
    ] });
    expect(preview.html).toContain('<h2 id="getting-started">Getting Started</h2>');
    expect(preview.html).toContain('<h2 id="getting-started-1">Getting Started</h2>');
    expect(preview.headings.map(({ id }) => id)).toEqual(['getting-started', 'install', 'getting-started-1', 'ignored']);
    const toc = renderPreviewTocItems(preview.headings, 2, 3, 'toc');
    expect(toc).toContain('href="#getting-started"');
    expect(toc).toContain('href="#install"');
    expect(toc).toContain('style="--depth: 1;"');
    expect(toc).not.toContain('ignored');
  });
});
