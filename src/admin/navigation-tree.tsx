import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, keyboardDragAndDropFeature, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { AssistiveTreeDescription, useTree } from '@headless-tree/react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';

export type NavigationItem = { id: string; parentId: string | null; kind: 'folder' | 'document'; name: string; slug: string; order: number; hasTranslation: boolean; translationLocales: string[]; translationStates: { locale: string; state: 'draft' | 'changes' | 'published' }[]; documentId?: string };
const root: NavigationItem = { id: 'root', parentId: null, kind: 'folder', name: 'Navigation', slug: '', order: 0, hasTranslation: true, translationLocales: [], translationStates: [] };

export function NavigationTree({ items, selectedDocumentId, selectedFolderId, onSelectDocument, onSelectFolder, onChangeChildren, onTreeChanged, canReorder = true }: {
  items: NavigationItem[]; selectedDocumentId?: string; selectedFolderId: string | null;
  onSelectDocument: (id: string) => void; onSelectFolder: (id: string) => void;
  onChangeChildren: (parentId: string | null, childIds: string[]) => Promise<void>;
  onTreeChanged: () => Promise<void>;
  canReorder?: boolean;
}) {
  const saving = useRef(false);
  const byId = useMemo(() => new Map([root, ...items].map((item) => [item.id, item])), [items]);
  const children = useMemo(() => {
    const entries: [string, string[]][] = [['root', items.filter((item) => item.parentId === null).sort((a, b) => a.order - b.order).map((item) => item.id)]];
    for (const item of items) entries.push([item.id, items.filter((candidate) => candidate.parentId === item.id).sort((a, b) => a.order - b.order).map((candidate) => candidate.id)]);
    return new Map(entries);
  }, [items]);
  const tree = useTree<NavigationItem>({
    rootItemId: 'root', getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === 'folder',
    onPrimaryAction: (item) => {
      const data = item.getItemData();
      if (data.documentId) onSelectDocument(data.documentId);
      else if (data.id !== 'root') onSelectFolder(data.id.slice('folder:'.length));
    },
    dataLoader: { getItem: (id) => byId.get(id) ?? root, getChildren: (id) => children.get(id) ?? [] },
    initialState: { expandedItems: ['root', ...items.filter((item) => item.kind === 'folder').map((item) => item.id)] },
    canReorder,
    indent: 20,
    canDrag: (dragged) => !saving.current && canReorder && dragged.length === 1 && dragged[0]?.getId() !== 'root',
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
      const isSelected = data.documentId ? selectedDocumentId === data.documentId : selectedFolderId === data.id.slice('folder:'.length);
      const hasChanges = data.translationStates.some((entry) => entry.state === 'changes');
      const hasDraft = data.translationStates.some((entry) => entry.state === 'draft');
      const publicationLabel = hasChanges ? 'Changes' : hasDraft ? 'Draft' : null;
      const publicationTitle = data.translationStates.filter((entry) => entry.state !== 'published').map((entry) => `${entry.locale}: ${entry.state === 'changes' ? 'Changes' : 'Draft'}`).join(', ');
      return <button {...item.getProps()} key={item.getKey()} style={{ paddingLeft: `${item.getItemMeta().level * 20}px` }}>
        <div className={clsx('treeitem', {
          focused: item.isFocused(),
          expanded: item.isExpanded(),
          selected: isSelected,
          folder: item.isFolder(),
          drop: item.isDragTarget(),
        })}><span className="treeitem-name">{data.name}</span>{publicationLabel && <span className={clsx('treeitem-status', hasChanges ? 'changes' : 'draft')} title={publicationTitle}>{publicationLabel}</span>}</div>
      </button>;
    })}
    <div className="dragline" style={tree.getDragLineStyle()} />
  </div></div>;
}
