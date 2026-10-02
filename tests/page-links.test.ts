import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { StarterKit } from '@tiptap/starter-kit';
import { PageLink } from '../src/admin/page-links';
import { documentHeadings, navigationPath, resolveDocumentLinks, type LinkPage } from '../src/documents/links';
import { contentJson } from '../src/documents/validation';
import { renderPreviewDocument } from '../src/starlight/preview-render';
import { renderDocumentContent } from '../src/starlight/render';

const sourceId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';
const heading = (text: string, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const body = { type: 'doc', content: [heading('インストール'), heading('インストール'), heading('Details', 3)] };
const target: LinkPage = { id: targetId, locale: 'en', title: 'Setup', path: 'guide/setup', content: body };
const source = { id: sourceId, locale: 'en', title: 'Start' };
const link = (id = targetId, anchor: string | null = 'インストール') => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read', marks: [{ type: 'link', attrs: { href: '/old-path/', documentId: id, anchor } }] }] }] });

describe('CMS links using the official Tiptap Link schema', () => {
  it('retains reference attributes across JSON round trips and keeps ordinary URL links', () => {
    const schema = getSchema([StarterKit.configure({ link: false }), PageLink]);
    const node = schema.nodeFromJSON(link());
    expect(schema.nodeFromJSON(node.toJSON()).toJSON()).toEqual(node.toJSON());
    expect(node.firstChild?.firstChild?.marks[0]?.attrs).toMatchObject({ href: '/old-path/', documentId: targetId, anchor: 'インストール' });
    const ordinary = schema.marks.link!.create({ href: 'https://example.test/' });
    expect(ordinary.attrs.documentId).toBeNull();
  });
  it('permits draft references and local anchors but rejects malformed IDs and unsafe hrefs', () => {
    expect(contentJson.safeParse(link()).success).toBe(true);
    expect(contentJson.safeParse(link('invalid')).success).toBe(false);
    const value = link(); value.content[0]!.content[0]!.marks[0]!.attrs.href = 'javascript:alert(1)';
    expect(contentJson.safeParse(value).success).toBe(false);
    expect(renderDocumentContent(resolveDocumentLinks(link(sourceId), source, [{ ...target, id: sourceId }]))).toContain('(#%E3%82%A4');
  });
  it('resolves from current paths, uses protected draft Preview and rejects missing public targets', () => {
    expect(renderDocumentContent(resolveDocumentLinks(link(), source, [target]))).toContain('/guide/setup/#%E3%82%A4');
    expect(renderDocumentContent(resolveDocumentLinks(link(targetId, null), source, [{ ...target, path: 'moved/setup' }]))).toContain('/moved/setup/');
    expect(renderPreviewDocument(resolveDocumentLinks(link(), source, [target], true)).html).toContain(`/admin/preview/${targetId}?locale=en#`);
    expect(() => resolveDocumentLinks(link(), source, [])).toThrow('Start');
    expect(() => resolveDocumentLinks(link(targetId, 'removed'), source, [target])).toThrow('heading is unavailable');
    expect(renderPreviewDocument(resolveDocumentLinks(link(), source, [], true)).html).toBe('<p>Read</p>');
  });
  it('resolves H1 anchors in both public content and Preview', () => {
    const h1Target = { ...target, content: { type: 'doc', content: [heading('Introduction', 1)] } };
    expect(documentHeadings(h1Target.content)).toEqual([{ id: 'introduction', level: 1, text: 'Introduction' }]);
    expect(renderDocumentContent(resolveDocumentLinks(link(targetId, 'introduction'), source, [h1Target]))).toContain('/guide/setup/#introduction');
    expect(renderPreviewDocument(h1Target.content).html).toContain('<h1 id="introduction">Introduction</h1>');
  });
  it('uses same-language targets with default-language fallback', () => {
    expect(renderDocumentContent(resolveDocumentLinks(link(targetId, null), { ...source, locale: 'ja' }, [target]))).toContain('/guide/setup/');
    expect(renderDocumentContent(resolveDocumentLinks(link(targetId, null), { ...source, locale: 'ja' }, [target, { ...target, locale: 'ja' }]))).toContain('/ja/guide/setup/');
  });
  it('shares heading anchors with Preview, including duplicate headings and tab-label collisions', () => {
    const content = { type: 'doc', content: [heading('インストール'), { type: 'tabs', content: [{ type: 'tab', attrs: { label: 'Details' }, content: [heading('Details', 3)] }] }, heading('インストール')] };
    expect(documentHeadings(content)).toEqual(renderPreviewDocument(content).headings);
    expect(documentHeadings(content).map((h) => h.id)).toEqual(['インストール', 'details-1', 'インストール-1']);
    expect(navigationPath('page', [{ id: 'page', parentId: 'folder', slug: 'setup' }, { id: 'folder', parentId: null, slug: 'guide' }])).toBe('guide/setup');
  });
  it('matches Astro heading IDs and TOC metadata for literal text, formatting and line breaks', async () => {
    const content = { type: 'doc', content: [
      ...['  Hello  ', 'Hello #', 'A &amp; B', '[Title](https://example.com)', '**literal**', "User's name", '<script>alert(1)</script>'].map((text) => heading(text)),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Styled', marks: [{ type: 'bold' }, { type: 'italic' }] }, { type: 'hardBreak' }, { type: 'text', text: 'next', marks: [{ type: 'code' }] }] },
      heading('  Hello  '),
      { type: 'tabs', content: [{ type: 'tab', attrs: { label: ' Details # ' }, content: [heading(' Details # ')] }] },
    ] };
    const rendered = await (await createSatteriMarkdownProcessor({ syntaxHighlight: false })).render(renderDocumentContent(content));
    const expected = documentHeadings(content);
    expect(rendered.metadata.headings.filter((item) => item.depth !== 4).map((item) => ({ id: item.slug, level: item.depth, text: item.text }))).toEqual(expected);
    expect(renderPreviewDocument(content).headings).toEqual(expected);
    for (const item of expected) expect(rendered.code).toContain(`id="${item.id}"`);
    expect(rendered.code).not.toContain('<script>');
  });
  it('keeps headings in every Preview tab visible and resolves their links', () => {
    const content = { type: 'doc', content: [{ type: 'tabs', content: [
      { type: 'tab', attrs: { label: 'Basic' }, content: [heading('Basic setup')] },
      { type: 'tab', attrs: { label: 'Advanced' }, content: [heading('Advanced')] },
    ] }] };
    const html = renderPreviewDocument(content).html;
    expect(html).toContain('<h4 id="advanced">Advanced</h4><h2 id="advanced-1">Advanced</h2>');
    expect(html).not.toContain(' hidden');
    expect(html).not.toContain('role="tabpanel"');
    expect(renderPreviewDocument(resolveDocumentLinks(link(targetId, 'advanced-1'), source, [{ ...target, content }], true)).html).toContain('?locale=en#advanced-1');
  });
});
