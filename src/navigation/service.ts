import { z } from 'zod';
import { slug } from '../documents/validation.ts';
import type { RuntimeEnv } from '../env.ts';
import { defaultLocale } from '../locales.ts';

const folderInput = z.object({ name: z.string().trim().min(1).max(120), slug, parentId: z.string().uuid().nullable().default(null), order: z.number().int().min(0).max(100000).default(0) });
export class FolderNotFoundError extends Error {}
export class NavigationConflictError extends Error {}
export type TreeItem = { id: string; parentId: string | null; kind: 'folder' | 'document'; name: string; slug: string; order: number; documentId?: string };

async function assertAvailable(env: RuntimeEnv, parentId: string | null, slugValue: string, ignoreFolder = '', ignoreDocument = '') {
  const [folderMatch, documentMatch] = await Promise.all([
    env.DB.prepare('SELECT id FROM folder WHERE parent_id IS ? AND slug=? AND id<>? LIMIT 1').bind(parentId, slugValue, ignoreFolder).first(),
    env.DB.prepare('SELECT id FROM document WHERE folder_id IS ? AND slug=? AND id<>? LIMIT 1').bind(parentId, slugValue, ignoreDocument).first(),
  ]);
  if (folderMatch || documentMatch) throw new NavigationConflictError('A folder or page already uses this URL segment');
}
async function assertParentFolder(env: RuntimeEnv, parentId: string | null) {
  if (!parentId) return;
  if (!await env.DB.prepare('SELECT id FROM folder WHERE id=?').bind(parentId).first()) throw new NavigationConflictError('The destination folder no longer exists');
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
    env.DB.prepare('SELECT f.id,f.parent_id,t.name,f.slug,f.sort_order FROM folder f JOIN folder_translation t ON t.folder_id=f.id WHERE t.locale=? ORDER BY f.sort_order,f.slug').bind(defaultLocale).all<{ id:string; parent_id:string|null; name:string; slug:string; sort_order:number }>(),
    env.DB.prepare('SELECT d.id,d.folder_id,t.title,d.slug,d.sort_order FROM document d JOIN document_translation t ON t.document_id=d.id WHERE t.locale=? ORDER BY d.sort_order,d.slug').bind(defaultLocale).all<{ id:string; folder_id:string|null; title:string; slug:string; sort_order:number }>(),
  ]);
  return [
    ...folders.results.map((row) => ({ id: `folder:${row.id}`, parentId: row.parent_id ? `folder:${row.parent_id}` : null, kind: 'folder' as const, name: row.name, slug: row.slug, order: row.sort_order })),
    ...documents.results.map((row) => ({ id: `document:${row.id}`, parentId: row.folder_id ? `folder:${row.folder_id}` : null, kind: 'document' as const, name: row.title, slug: row.slug, order: row.sort_order, documentId: row.id })),
  ];
}

export async function createFolder(env: RuntimeEnv, raw: unknown) {
  const input = folderInput.parse(raw); await assertParentFolder(env, input.parentId); await assertAvailable(env, input.parentId, input.slug);
  const id = crypto.randomUUID(); const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO folder (id,parent_id,slug,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id, input.parentId, input.slug, input.order, now, now),
    env.DB.prepare('INSERT INTO folder_translation (folder_id,locale,name,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id, defaultLocale, input.name, now, now),
  ]);
  return { id, ...input, createdAt: now, updatedAt: now };
}

export async function updateFolder(env: RuntimeEnv, id: string, raw: unknown) {
  const input = folderInput.parse(raw);
  if (!await env.DB.prepare('SELECT id FROM folder WHERE id=?').bind(id).first()) throw new FolderNotFoundError();
  await assertNoFolderCycle(env, id, input.parentId); await assertAvailable(env, input.parentId, input.slug, id);
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare('UPDATE folder SET parent_id=?,slug=?,sort_order=?,updated_at=? WHERE id=?').bind(input.parentId, input.slug, input.order, now, id),
    env.DB.prepare('UPDATE folder_translation SET name=?,updated_at=? WHERE folder_id=? AND locale=?').bind(input.name, now, id, defaultLocale),
  ]);
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new FolderNotFoundError();
  return { id, ...input, updatedAt: now };
}

export async function deleteFolder(env: RuntimeEnv, id: string) {
  const [childFolder, childDocument] = await Promise.all([
    env.DB.prepare('SELECT id FROM folder WHERE parent_id=? LIMIT 1').bind(id).first(),
    env.DB.prepare('SELECT id FROM document WHERE folder_id=? LIMIT 1').bind(id).first(),
  ]);
  if (childFolder || childDocument) throw new NavigationConflictError('Move or delete the folder contents before deleting this folder');
  const deleted = await env.DB.prepare('DELETE FROM folder WHERE id=? RETURNING id').bind(id).first<{ id: string }>();
  if (!deleted) throw new FolderNotFoundError();
}

const treeChildId = z.string().regex(/^(folder|document):[0-9a-f-]{36}$/i);
const childrenInput = z.object({ parentId: z.string().uuid().nullable(), childIds: z.array(treeChildId).max(10_000) });
type NavigationRow = { id: string; kind: 'folder' | 'document'; slug: string; order: number };

async function siblings(env: RuntimeEnv, parentId: string | null, excluded: NavigationRow | null = null): Promise<NavigationRow[]> {
  const [folders, documents] = await Promise.all([
    env.DB.prepare('SELECT id,slug,sort_order FROM folder WHERE parent_id IS ?').bind(parentId).all<{ id: string; slug: string; sort_order: number }>(),
    env.DB.prepare('SELECT id,slug,sort_order FROM document WHERE folder_id IS ?').bind(parentId).all<{ id: string; slug: string; sort_order: number }>(),
  ]);
  return [
    ...folders.results.map((row) => ({ id: row.id, kind: 'folder' as const, slug: row.slug, order: row.sort_order })),
    ...documents.results.map((row) => ({ id: row.id, kind: 'document' as const, slug: row.slug, order: row.sort_order })),
  ].filter((row) => !excluded || row.kind !== excluded.kind || row.id !== excluded.id)
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

function reorderStatements(env: RuntimeEnv, entries: NavigationRow[], parentId: string | null, now: number) {
  return entries.map((entry, order) => env.DB.prepare(entry.kind === 'folder'
    ? 'UPDATE folder SET parent_id=?,sort_order=?,updated_at=? WHERE id=?'
    : 'UPDATE document SET folder_id=?,sort_order=?,updated_at=? WHERE id=?')
    .bind(parentId, order, now, entry.id));
}

export async function replaceTreeChildren(env: RuntimeEnv, raw: unknown) {
  const input = childrenInput.parse(raw);
  if (new Set(input.childIds).size !== input.childIds.length) throw new NavigationConflictError('A navigation item was included more than once');
  await assertParentFolder(env, input.parentId);
  const entries = await Promise.all(input.childIds.map(async (childId) => {
    const [kind, id] = childId.split(':') as ['folder' | 'document', string];
    const row = await env.DB.prepare(`SELECT slug FROM ${kind} WHERE id=?`).bind(id).first<{ slug: string }>();
    if (!row) throw new FolderNotFoundError();
    if (kind === 'folder') await assertNoFolderCycle(env, id, input.parentId);
    return { id, kind, slug: row.slug, order: 0 } as NavigationRow;
  }));

  const movedIds = new Set(entries.map((entry) => `${entry.kind}:${entry.id}`));
  const existing = await siblings(env, input.parentId);
  const usedSlugs = new Set(existing.filter((entry) => !movedIds.has(`${entry.kind}:${entry.id}`)).map((entry) => entry.slug));
  for (const entry of entries) {
    if (usedSlugs.has(entry.slug)) throw new NavigationConflictError('A folder or page already uses this URL segment');
    usedSlugs.add(entry.slug);
  }
  if (entries.length > 0) await env.DB.batch(reorderStatements(env, entries, input.parentId, Date.now()));
  return { parentId: input.parentId, childIds: input.childIds };
}
