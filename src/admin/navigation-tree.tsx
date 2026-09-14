import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, keyboardDragAndDropFeature, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { AssistiveTreeDescription, useTree } from '@headless-tree/react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';

export type NavigationItem = { id: string; parentId: string | null; kind: 'folder' | 'document'; name: string; slug: string; order: number; hasTranslation: boolean; translationLocales: string[]; translationStates: { locale: string; state: 'draft' | 'changes' | 'published' }[]; documentId?: string; isTemporary?: boolean };
const root: NavigationItem = { id: 'root', parentId: null, kind: 'folder', name: 'Navigation', slug: '', order: 0, hasTranslation: true, translationLocales: [], translationStates: [] };

function TreeChevron({ expanded }: { expanded: boolean }) {
  return <span className={`treeitem-chevron${expanded ? ' is-expanded' : ''}`} aria-hidden="true" />;
}

export function NavigationTree({ items, selectedDocumentId, selectedFolderId, temporaryDocument, onSelectDocument, onSelectFolder, onChangeChildren, onTreeChanged, canReorder = true }: {
  items: NavigationItem[]; selectedDocumentId?: string; selectedFolderId: string | null;
  temporaryDocument?: { name: string; parentId: string | null };
  onSelectDocument: (id: string) => void; onSelectFolder: (id: string) => void;
  onChangeChildren: (parentId: string | null, childIds: string[]) => Promise<void>;
  onTreeChanged: () => Promise<void>;
  canReorder?: boolean;
}) {
  const saving = useRef(false);
  const visibleItems = useMemo(() => temporaryDocument ? [...items, {
    id: 'draft:new-page', parentId: temporaryDocument.parentId, kind: 'document' as const,
    name: temporaryDocument.name, slug: '', order: Number.MAX_SAFE_INTEGER, hasTranslation: true,
    translationLocales: [], translationStates: [], isTemporary: true,
  }] : items, [items, temporaryDocument]);
  const canPersistReorder = canReorder && !temporaryDocument;
  const byId = useMemo(() => new Map([root, ...visibleItems].map((item) => [item.id, item])), [visibleItems]);
  const children = useMemo(() => {
    const entries: [string, string[]][] = [['root', visibleItems.filter((item) => item.parentId === null).sort((a, b) => a.order - b.order).map((item) => item.id)]];
    for (const item of visibleItems) entries.push([item.id, visibleItems.filter((candidate) => candidate.parentId === item.id).sort((a, b) => a.order - b.order).map((candidate) => candidate.id)]);
    return new Map(entries);
  }, [visibleItems]);
  const tree = useTree<NavigationItem>({
    rootItemId: 'root', getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === 'folder',
    onPrimaryAction: (item) => {
      const data = item.getItemData();
      if (data.isTemporary) return;
      if (data.documentId) onSelectDocument(data.documentId);
      else if (data.id !== 'root') onSelectFolder(data.id.slice('folder:'.length));
    },
    dataLoader: { getItem: (id) => byId.get(id) ?? root, getChildren: (id) => children.get(id) ?? [] },
    initialState: { expandedItems: ['root', ...visibleItems.filter((item) => item.kind === 'folder').map((item) => item.id)] },
    canReorder: canPersistReorder,
    indent: 20,
    canDrag: (dragged) => !saving.current && canPersistReorder && dragged.length === 1 && dragged[0]?.getId() !== 'root',
    // The sync loader must see the removal before the helper inserts the item.
    // Persist only the final destination, never the intermediate removal.
    onDrop: async (dragged, target) => {
      if (saving.current) return;
      saving.current = true;
      const before = new Map(children);
      try {
        await createOnDropHandler<NavigationItem>((parent, childIds) => {
          children.set(parent.getId(), childIds);
        })(dragged, target);
        const parentId = target.item.getId();
        await onChangeChildren(parentId === 'root' ? null : parentId.slice('folder:'.length), children.get(parentId) ?? []);
        await onTreeChanged();
      } catch {
        // The API caller displays the error; put the visible tree back as well.
        children.clear();
        for (const [id, ids] of before) children.set(id, ids);
        tree.rebuildTree();
      } finally {
        saving.current = false;
      }
    },
    features: [syncDataLoaderFeature, selectionFeature, dragAndDropFeature, hotkeysCoreFeature, keyboardDragAndDropFeature],
  });
  useEffect(() => { tree.rebuildTree(); }, [children, tree]);
  return <div className="navigation-tree-scroll"><div {...tree.getContainerProps('Navigation tree')} className="tree">
    <AssistiveTreeDescription tree={tree} />
    {tree.getItems().filter((item) => item.getId() !== 'root').map((item) => {
      const data = item.getItemData();
      const isSelected = data.isTemporary || (data.documentId ? selectedDocumentId === data.documentId : selectedFolderId === data.id.slice('folder:'.length));
      const hasChanges = data.translationStates.some((entry) => entry.state === 'changes');
      const hasDraft = data.translationStates.some((entry) => entry.state === 'draft');
      const publicationLabel = data.isTemporary ? 'Unsaved' : hasChanges ? 'Changes' : hasDraft ? 'Draft' : null;
      const publicationTitle = data.isTemporary ? 'Save draft to create this page' : data.translationStates.filter((entry) => entry.state !== 'published').map((entry) => `${entry.locale}: ${entry.state === 'changes' ? 'Changes' : 'Draft'}`).join(', ');
      return <button {...item.getProps()} key={item.getKey()} style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}>
        <div className={clsx('treeitem', {
          focused: item.isFocused(),
          expanded: item.isExpanded(),
          selected: isSelected,
          folder: item.isFolder(),
          drop: item.isDragTarget(),
        })}>{item.isFolder() && <TreeChevron expanded={item.isExpanded()} />}<span className="treeitem-name">{data.name}</span>{publicationLabel && <span className={clsx('treeitem-status', data.isTemporary ? 'unsaved' : hasChanges ? 'changes' : 'draft')} title={publicationTitle}>{publicationLabel}</span>}</div>
      </button>;
    })}
    <div className="dragline" style={tree.getDragLineStyle()} />
  </div></div>;
}
