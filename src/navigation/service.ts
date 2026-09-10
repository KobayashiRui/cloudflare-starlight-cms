import { z } from 'zod';
import type { RuntimeEnv } from '../env.ts';
import { slug } from '../documents/validation.ts';

const folderInput = z.object({ name: z.string().trim().min(1).max(120), slug, parentId: z.string().uuid().nullable().default(null), order: z.number().int().min(0).max(100000).default(0) });
export class FolderNotFoundError extends Error {}
export class NavigationConflictError extends Error {}
export type TreeItem = { id: string; parentId: string | null; kind: 'folder' | 'document'; name: string; slug: string; order: number; documentId?: string };

async function assertAvailable(env: RuntimeEnv, parentId: string | null, slugValue: string, ignoreFolder = '') {
  const [folderMatch, documentMatch] = await Promise.all([
    env.DB.prepare('SELECT id FROM folder WHERE parent_id IS ? AND slug=? AND id<>? LIMIT 1').bind(parentId, slugValue, ignoreFolder).first(),
    env.DB.prepare('SELECT id FROM document WHERE folder_id IS ? AND slug=? LIMIT 1').bind(parentId, slugValue).first(),
  ]);
  if (folderMatch || documentMatch) throw new NavigationConflictError('A folder or page already uses this URL segment');
}
async function assertParentFolder(env: RuntimeEnv, parentId: string | null) {
  if (!parentId) return;
  const parent = await env.DB.prepare('SELECT id FROM folder WHERE id=?').bind(parentId).first();
  if (!parent) throw new NavigationConflictError('The destination folder no longer exists');
}
async function assertNoFolderCycle(env: RuntimeEnv, folderId: string, parentId: string | null) {
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === folderId || seen.has(cursor)) throw new NavigationConflictError('A folder cannot be moved into itself or one of its descendants');
    seen.add(cursor);
    const parent = await env.DB.prepare('SELECT parent_id FROM folder WHERE id=?').bind(cursor).first<{ parent_id: string | null }>();
    if (!parent) throw new NavigationConflictError('The destination folder no longer exists');
    cursor = parent.parent_id;
  }
}
export async function listTree(env: RuntimeEnv): Promise<TreeItem[]> {
  const [folders, documents] = await Promise.all([
    env.DB.prepare('SELECT id,parent_id,name,slug,sort_order FROM folder ORDER BY sort_order,slug').all<{ id:string; parent_id:string|null; name:string; slug:string; sort_order:number }>(),
    env.DB.prepare('SELECT id,folder_id,title,slug,sort_order FROM document ORDER BY sort_order,slug').all<{ id:string; folder_id:string|null; title:string; slug:string; sort_order:number }>(),
  ]);
  return [...folders.results.map((row) => ({ id: `folder:${row.id}`, parentId: row.parent_id ? `folder:${row.parent_id}` : null, kind: 'folder' as const, name: row.name, slug: row.slug, order: row.sort_order })), ...documents.results.map((row) => ({ id: `document:${row.id}`, parentId: row.folder_id ? `folder:${row.folder_id}` : null, kind: 'document' as const, name: row.title, slug: row.slug, order: row.sort_order, documentId: row.id }))];
}
export async function createFolder(env: RuntimeEnv, raw: unknown) { const input = folderInput.parse(raw); await assertParentFolder(env, input.parentId); await assertAvailable(env, input.parentId, input.slug); const id = crypto.randomUUID(); const now = Date.now(); await env.DB.prepare('INSERT INTO folder (id,parent_id,name,slug,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,input.parentId,input.name,input.slug,input.order,now,now).run(); return { id, ...input, createdAt: now, updatedAt: now }; }
export async function updateFolder(env: RuntimeEnv, id: string, raw: unknown) { const input = folderInput.parse(raw); const existing = await env.DB.prepare('SELECT id FROM folder WHERE id=?').bind(id).first(); if (!existing) throw new FolderNotFoundError(); await assertNoFolderCycle(env, id, input.parentId); await assertAvailable(env, input.parentId, input.slug, id); const now = Date.now(); const result = await env.DB.prepare('UPDATE folder SET parent_id=?,name=?,slug=?,sort_order=?,updated_at=? WHERE id=?').bind(input.parentId,input.name,input.slug,input.order,now,id).run(); if (result.meta.changes !== 1) throw new FolderNotFoundError(); return { id, ...input, updatedAt: now }; }
export async function deleteFolder(env: RuntimeEnv, id: string) { const [childFolder, childDocument] = await Promise.all([env.DB.prepare('SELECT id FROM folder WHERE parent_id=? LIMIT 1').bind(id).first(), env.DB.prepare('SELECT id FROM document WHERE folder_id=? LIMIT 1').bind(id).first()]); if (childFolder || childDocument) throw new NavigationConflictError('Move or delete the folder contents before deleting this folder'); const result = await env.DB.prepare('DELETE FROM folder WHERE id=?').bind(id).run(); if (result.meta.changes !== 1) throw new FolderNotFoundError(); }
const moveInput = z.object({ kind: z.enum(['folder', 'document']), id: z.string().uuid(), parentId: z.string().uuid().nullable(), order: z.number().int().min(0).max(100000), version: z.number().int().positive().optional() });
export async function moveTreeItem(env: RuntimeEnv, raw: unknown) { const input = moveInput.parse(raw); if (input.kind === 'folder') { const existing = await env.DB.prepare('SELECT name,slug FROM folder WHERE id=?').bind(input.id).first<{ name: string; slug: string }>(); if (!existing) throw new FolderNotFoundError(); return updateFolder(env, input.id, { ...existing, parentId: input.parentId, order: input.order }); } await assertParentFolder(env, input.parentId); const row = await env.DB.prepare('SELECT version FROM document WHERE id=?').bind(input.id).first<{version:number}>(); if (!row) throw new FolderNotFoundError(); const result = await env.DB.prepare('UPDATE document SET folder_id=?,sort_order=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(input.parentId,input.order,Date.now(),input.id,input.version ?? row.version).run(); if (result.meta.changes !== 1) throw new NavigationConflictError('The page changed. Reload the tree.'); return result; }
