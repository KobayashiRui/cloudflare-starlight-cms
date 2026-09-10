import { selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { useMemo } from 'react';

export type NavigationItem = { id: string; parentId: string | null; kind: 'folder' | 'document'; name: string; slug: string; order: number; documentId?: string };
const root: NavigationItem = { id: 'root', parentId: null, kind: 'folder', name: 'Navigation', slug: '', order: 0 };

export function NavigationTree({ items, selectedId, onSelect }: { items: NavigationItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  const byId = useMemo(() => new Map([root, ...items].map((item) => [item.id, item])), [items]);
  const children = useMemo(() => {
    const entries: [string, string[]][] = [['root', items.filter((item) => item.parentId === null).sort((a, b) => a.order - b.order).map((item) => item.id)]];
    for (const item of items) entries.push([item.id, items.filter((candidate) => candidate.parentId === item.id).sort((a, b) => a.order - b.order).map((candidate) => candidate.id)]);
    return new Map(entries);
  }, [items]);
  const tree = useTree<NavigationItem>({ rootItemId: 'root', getItemName: (item) => item.getItemData().name, isItemFolder: (item) => item.getItemData().kind === 'folder', onPrimaryAction: (item) => { const data = item.getItemData(); if (data.documentId) onSelect(data.documentId); }, dataLoader: { getItem: (id) => byId.get(id) ?? root, getChildren: (id) => children.get(id) ?? [] }, initialState: { expandedItems: ['root', ...items.filter((item) => item.kind === 'folder').map((item) => item.id)] }, features: [syncDataLoaderFeature, selectionFeature] });
  return <div {...tree.getContainerProps('Navigation tree')} className="cms-tree">{tree.getItems().filter((item) => item.getId() !== 'root').map((item) => { const data = item.getItemData(); return <button {...item.getProps()} key={item.getKey()} className={`cms-tree-item ${selectedId === data.documentId ? 'is-active' : ''}`} style={{ paddingLeft: `${12 + item.getItemMeta().level * 16}px` }}><span>{data.kind === 'folder' ? (item.isExpanded() ? '⌄' : '›') : '•'}</span>{data.name}</button>; })}</div>;
}
