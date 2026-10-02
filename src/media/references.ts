import { mediaObjectKey } from './urls.ts';
import type { RuntimeEnv } from '../env.ts';

export async function registeredMediaKeys(db: RuntimeEnv['DB']): Promise<ReadonlySet<string>> {
  const media = await db.prepare('SELECT object_key FROM media').all<{ object_key: string }>();
  return new Set(media.results.map((row) => row.object_key));
}

/** Media objects owned by this CMS, including its protected local media route. */
export function managedMediaKeys(content: unknown): string[] {
  const keys = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if ('attrs' in value && value.attrs && typeof value.attrs === 'object') {
      for (const [field, src] of Object.entries(value.attrs)) {
        if (!['src', 'href', 'poster'].includes(field) || typeof src !== 'string') continue;
        const key = mediaObjectKey(src);
        const managedPath = src.startsWith('/admin/api/media/object/') || src.startsWith('/_cms-media/');
        const legacyKey = key && /^media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\./.test(key);
        if (key && (managedPath || legacyKey)) keys.add(key);
      }
    }
    if ('content' in value) visit(value.content);
    if ('marks' in value) visit(value.marks);
  }
  visit(content);
  return [...keys];
}

/** Used inside the same D1 mutation as a save: a claimed/deleted object cannot be referenced again. */
export const mediaWriteGuard = `NOT EXISTS (
  SELECT 1 FROM json_each(?) k LEFT JOIN media m ON m.object_key=k.value
  WHERE m.id IS NULL OR EXISTS (SELECT 1 FROM media_deletion x WHERE x.media_id=m.id)
)`;

/** Scan decoded JSON URLs in D1, rather than parsing all history in a Free-plan Worker.
 * Invalid historical content stays protected because absence of references cannot be proven.
 */
function containsMedia(column: string) {
  return `(NOT json_valid(${column}) OR EXISTS (
    SELECT 1 FROM json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END) j
    WHERE j.key IN ('src','href','poster') AND j.type='text' AND (instr(j.value,media.object_key)>0 OR instr(j.value,'/_cms-media/' || substr(media.object_key,7))>0)
  ))`;
}
export const mediaHasReferences = `(
  EXISTS (SELECT 1 FROM document_translation t WHERE ${containsMedia('t.content_json')})
  OR EXISTS (SELECT 1 FROM document_revision r WHERE ${containsMedia('r.content_json')})
  OR EXISTS (SELECT 1 FROM cms_build b WHERE b.expires_at>? AND ${containsMedia('b.content_json')})
)`;
