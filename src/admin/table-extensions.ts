import { Table, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table';
import type { EditorState } from '@tiptap/pm/state';
import { isInTable, selectedRect } from '@tiptap/pm/tables';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { tableStyles } from '../documents/tables';

/** The official resizable view applies static HTMLAttributes only. Mirror the design attribute. */
class DocsTableView extends TableView {
  constructor(...args: ConstructorParameters<typeof TableView>) {
    super(...args);
    this.table.dataset.tableStyle = this.node.attrs.tableStyle;
  }
  update(node: ProseMirrorNode) {
    if (!super.update(node)) return false;
    this.table.dataset.tableStyle = node.attrs.tableStyle;
    return true;
  }
}

export const DocsTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableStyle: {
        default: 'standard',
        parseHTML: (element: HTMLElement) => tableStyles.find((value) => value === element.getAttribute('data-table-style')) ?? 'standard',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-table-style': attrs.tableStyle }),
      },
    };
  },
}).configure({ resizable: true, renderWrapper: true, View: DocsTableView });
export const tableExtensions = [DocsTable, TableRow, TableHeader, TableCell];

/** Matches the official first-row/first-column commands and selected-cell toggle. */
export function tableHeaderState(state: EditorState) {
  if (!isInTable(state)) return { row: false, column: false, cell: false };
  const rect = selectedRect(state);
  const header = (position: number) => rect.table.nodeAt(position)?.type.name === 'tableHeader';
  return {
    row: rect.map.cellsInRect({ left: 0, top: 0, right: rect.map.width, bottom: 1 }).every(header),
    column: rect.map.cellsInRect({ left: 0, top: 0, right: 1, bottom: rect.map.height }).every(header),
    cell: rect.map.cellsInRect(rect).some(header),
  };
}
