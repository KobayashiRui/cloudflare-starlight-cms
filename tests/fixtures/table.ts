export const designedTable = {
  type: 'table', attrs: { tableStyle: 'striped' }, content: [
    { type: 'tableRow', content: [
      { type: 'tableHeader', attrs: { colspan: 2, rowspan: 1, colwidth: [180, 220], align: 'center' }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Header <script> | **literal**', marks: [{ type: 'bold' }] }] },
      ] },
    ] },
    { type: 'tableRow', content: [
      { type: 'tableCell', attrs: { colspan: 1, rowspan: 2, colwidth: [180], align: 'right' }, content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List item' }] }] }] },
      ] },
      { type: 'tableCell', attrs: { colwidth: [220] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read docs', marks: [{ type: 'link', attrs: { href: 'https://example.test/' } }] }] }] },
    ] },
    { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [220] }, content: [{ type: 'paragraph' }] }] },
  ],
};
export const tableDocument = { type: 'doc', content: [designedTable] };
