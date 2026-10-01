import { tableHeaderState } from '../../table-extensions';
import { useEditorState, type Editor } from '@tiptap/react';
import { useAdminI18n } from '../../i18n';
import { useTiptapEditor } from '../../hooks/use-tiptap-editor';
import { Button } from '../tiptap-ui-primitive/button';
import { ChevronDownIcon } from '../tiptap-icons/chevron-down-icon';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from '../tiptap-ui-primitive/dropdown-menu';
import { tableStyles } from '../../../documents/tables';

const operations = [
  ['addRowBefore', 'Add row above'], ['addRowAfter', 'Add row below'], ['deleteRow', 'Delete row'],
  ['addColumnBefore', 'Add column before'], ['addColumnAfter', 'Add column after'], ['deleteColumn', 'Delete column'],
  ['toggleHeaderRow', 'Make first row a heading'], ['toggleHeaderColumn', 'Make first column a heading'], ['toggleHeaderCell', 'Make selected cells headings'],
  ['mergeCells', 'Merge cells'], ['splitCell', 'Split cell'], ['deleteTable', 'Delete table'],
] as const;
const styleLabels = { standard: 'Standard', striped: 'Striped', minimal: 'Minimal' };

function tableAvailability(editor: Editor | null) {
  return editor ? {
    inTable: editor.isActive('table'),
    tableStyle: editor.getAttributes('table').tableStyle,
    headers: tableHeaderState(editor.state),
    canInsert: editor.can().insertTable?.() ?? false,
    available: Object.fromEntries(operations.map(([command]) => [command, editor.can()[command]?.() ?? false])),
  } : null;
}

export function TableMenu() {
  const { editor } = useTiptapEditor();
  const { t } = useAdminI18n();
  const tableState = useEditorState({
    editor,
    selector: ({ editor }) => tableAvailability(editor),
  }) ?? tableAvailability(editor);
  if (!editor || !tableState || !editor.extensionManager.extensions.some((extension) => extension.name === 'table')) return null;
  const { inTable } = tableState;
  const itemClass = 'cms-table-menu-item';
  function operationLabel(command: string, label: string) {
    if (command === 'toggleHeaderRow' && tableState?.headers.row) return 'Make first row regular';
    if (command === 'toggleHeaderColumn' && tableState?.headers.column) return 'Make first column regular';
    if (command === 'toggleHeaderCell' && tableState?.headers.cell) return 'Make selected cells regular';
    return label;
  }
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" tooltip={t('Table')} aria-label={t('Table')} disabled={!editor.isEditable}>
        <svg className="tiptap-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
        <ChevronDownIcon className="tiptap-button-dropdown-small" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" style={{ maxWidth: 'calc(100vw - 16px)' }}>
      <DropdownMenuGroup>
        <DropdownMenuItem className={itemClass} disabled={inTable || !tableState.canInsert}
          onSelect={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }}>
          {t('Insert table (3 × 3)')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('Table structure')}</DropdownMenuLabel>
        {operations.map(([command, label]) => <DropdownMenuItem key={command} className={itemClass}
          disabled={!inTable || !tableState.available[command]}
          onSelect={() => { editor.chain().focus()[command]().run(); }}>{t(operationLabel(command, label))}</DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={itemClass} disabled={!inTable}>{t('Table style')} ›</DropdownMenuSubTrigger>
          <DropdownMenuPortal><DropdownMenuSubContent>
            {tableStyles.map((style) => <DropdownMenuItem key={style} className={itemClass}
              role="menuitemradio" aria-checked={tableState.tableStyle === style}
              onSelect={() => { editor.chain().focus().updateAttributes('table', { tableStyle: style }).run(); }}>
              {t(styleLabels[style])}{tableState.tableStyle === style ? ' ✓' : ''}
            </DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={itemClass} disabled={!inTable}>{t('Cell alignment')} ›</DropdownMenuSubTrigger>
          <DropdownMenuPortal><DropdownMenuSubContent>
            {(['left', 'center', 'right'] as const).map((align) => <DropdownMenuItem key={align} className={itemClass}
              onSelect={() => { editor.chain().focus().setCellAttribute('align', align).run(); }}>{t({ left: 'Align left', center: 'Align center', right: 'Align right' }[align])}</DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
