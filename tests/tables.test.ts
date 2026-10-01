import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { EditorState } from '@tiptap/pm/state';
import { CellSelection, toggleHeader, toggleHeaderCell, mergeCells, splitCell, TableMap } from '@tiptap/pm/tables';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { documentHeadings } from '../src/documents/links';
import { renderPreviewDocument } from '../src/starlight/preview-render';
import { tableHeaderState, tableExtensions } from '../src/admin/table-extensions';
import { contentJson } from '../src/documents/validation';
import { renderDocumentContent } from '../src/starlight/render';
import { renderPreviewContent } from '../src/starlight/preview-render';
import { designedTable, tableDocument } from './fixtures/table';

const schema = getSchema([StarterKit, ...tableExtensions]);
describe('official Tiptap tables and design attributes', () => {
  it('retains styles, alignment, spans, widths and rich blocks when reopened', () => {
    const node = schema.nodeFromJSON(tableDocument);
    node.check();
    const reopened = schema.nodeFromJSON(JSON.parse(JSON.stringify(node.toJSON())));
    expect(reopened.toJSON()).toEqual(node.toJSON());
    expect(reopened.firstChild?.attrs.tableStyle).toBe('striped');
    expect(reopened.firstChild?.firstChild?.firstChild?.attrs).toMatchObject({ colspan: 2, colwidth: [180, 220], align: 'center' });
    expect(contentJson.safeParse(reopened.toJSON()).success).toBe(true);
  });
  it('accepts unset widths represented by zero and retains horizontal overflow sizing', () => {
    const table = structuredClone(tableDocument);
    table.content[0]!.content[0]!.content[0]!.attrs.colwidth = [340, 0];
    expect(contentJson.safeParse(table).success).toBe(true);
    const html = renderDocumentContent(table);
    expect(html).toContain('min-width: 365px');
    expect(html).toContain('<col style="width: 340px"><col>');
  });
  it('keeps official cell selection, merge and split behavior', () => {
    const cell = () => ({ type: 'tableCell', content: [{ type: 'paragraph' }] });
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell(), cell()] }] }] });
    const map = TableMap.get(doc.firstChild!);
    let state = EditorState.create({ schema, doc, selection: CellSelection.create(doc, 1 + map.map[0]!, 1 + map.map[1]!) });
    expect(mergeCells(state, (tr) => { state = state.apply(tr); })).toBe(true);
    expect(state.doc.firstChild?.firstChild?.firstChild?.attrs.colspan).toBe(2);
    expect(splitCell(state, (tr) => { state = state.apply(tr); })).toBe(true);
    expect(state.doc.firstChild?.firstChild?.childCount).toBe(2);
  });
  it('renders the same safe table in Preview and actual Astro Markdown processing', async () => {
    const html = renderPreviewContent(tableDocument);
    expect(renderDocumentContent(tableDocument).trim()).toBe(html);
    const rendered = await (await createSatteriMarkdownProcessor({ syntaxHighlight: false })).render(renderDocumentContent(tableDocument));
    for (const fragment of ['data-table-style="striped"', 'colspan="2"', 'rowspan="2"', 'width: 180px', 'width: 220px', 'text-align: center', '<p>First paragraph</p><p>Second paragraph</p>', '<ul><li>', '**literal**', 'href="https://example.test/"']) expect(rendered.code).toContain(fragment);
    expect(rendered.code).toContain('&lt;script&gt;');
    expect(rendered.code).not.toContain('<script>');
    expect(html.match(/<th /g)).toHaveLength(1);
  });
  it('matches header labels to official first-row/column toggles even when a body cell is selected', () => {
    const cell = (type = 'tableCell') => ({ type, content: [{ type: 'paragraph' }] });
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
      { type: 'tableRow', content: [cell('tableHeader'), cell('tableHeader')] },
      { type: 'tableRow', content: [cell(), cell()] },
    ] }] });
    const map = TableMap.get(doc.firstChild!);
    let state = EditorState.create({ schema, doc, selection: CellSelection.create(doc, 1 + map.map[3]!) });
    expect(tableHeaderState(state)).toEqual({ row: true, column: false, cell: false });
    toggleHeader('row')(state, (tr) => { state = state.apply(tr); });
    expect(tableHeaderState(state).row).toBe(false);
    toggleHeader('column')(state, (tr) => { state = state.apply(tr); });
    expect(tableHeaderState(state).column).toBe(true);
    toggleHeaderCell(state, (tr) => { state = state.apply(tr); });
    expect(tableHeaderState(state).cell).toBe(true);
  });
  it('treats cell headings as table formatting without changing page anchors or TOC', async () => {
    const h = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] };
    const content = { type: 'doc', content: [h, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [h] }] }] }, h] };
    const rendered = await (await createSatteriMarkdownProcessor({ syntaxHighlight: false })).render(renderDocumentContent(content));
    const expected = documentHeadings(content);
    expect(expected.map((heading) => heading.id)).toEqual(['details', 'details-1']);
    expect(rendered.metadata.headings.map((heading) => heading.slug)).toEqual(expected.map((heading) => heading.id));
    expect(renderPreviewDocument(content).headings).toEqual(expected);
    expect(rendered.code).toContain('<h2>Details</h2>');
    for (const heading of expected) expect(rendered.code.match(new RegExp(`id="${heading.id}"`, 'g'))).toHaveLength(1);
  });
  it('rejects unsafe design values and malformed table attributes on save and rendering', () => {
    for (const attrs of [{ align: 'left; color:red' }, { colspan: -1 }, { rowspan: 1.5 }, { colwidth: [1, 2] }, { colwidth: ['100px'] }]) {
      const value = structuredClone(tableDocument);
      Object.assign(value.content[0]!.content[1]!.content[1]!.attrs!, attrs);
      expect(contentJson.safeParse(value).success).toBe(false);
      expect(() => renderDocumentContent(value)).toThrow();
    }
    expect(() => renderDocumentContent({ ...designedTable, attrs: { tableStyle: 'anything' } })).toThrow();
    expect(() => renderDocumentContent({ type: 'table', content: [{ type: 'paragraph' }] })).toThrow('Invalid table');
    expect(() => renderDocumentContent({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'script' }] }] })).toThrow('Invalid table row');
    expect(() => renderDocumentContent({ type: 'tableCell', content: [{ type: 'image', attrs: { src: '/admin/api/media/object/a.png' } }] })).toThrow('MEDIA_PUBLIC_URL');
  });
});
