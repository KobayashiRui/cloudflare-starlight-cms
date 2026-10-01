import { cmsConfig } from '../cms.config.ts';
import type { RuntimeEnv } from '../env.ts';
import { publishedSnapshot } from '../starlight/snapshot.ts';
import { mediaHasReferences } from '../media/references.ts';

export class BuildCleanupConflictError extends Error {}
const leaseMs = 24 * 60 * 60 * 1000;
// Fresh uploads may still be in somebody else's unsaved editor.
const uploadGraceMs = 24 * 60 * 60 * 1000;
const batchSize = 10;
export const buildManifestPath = '/admin/cms-build.json';

export function historyLimit(value: number | null): number | null {
  if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw new Error('maxPublicationRevisions must be null or a positive integer');
  return value;
}

export async function startBuild(env: RuntimeEnv) {
  historyLimit(cmsConfig.maxPublicationRevisions);
  const id = crypto.randomUUID(); const createdAt = Date.now();
  try {
    const snapshot = await publishedSnapshot(env, { id, createdAt, expiresAt: createdAt + leaseMs });
    return { id, snapshot };
  } catch (error) {
    await env.DB.prepare('DELETE FROM cms_build WHERE id=?').bind(id).run();
    throw error;
  }
}

export async function cancelBuild(env: RuntimeEnv, id: string) {
  await env.DB.prepare('DELETE FROM cms_build WHERE id=?').bind(id).run();
}

/** Legacy production may still read R2. Only a live static-media site permits GC. */
async function servesStaticMedia(env: RuntimeEnv): Promise<boolean> {
  const response = await env.ASSETS.fetch(new Request(`https://cms.invalid${buildManifestPath}`));
  if (!response.ok) return false;
  try {
    const manifest: unknown = await response.json();
    return Boolean(manifest && typeof manifest === 'object' && 'media' in manifest && manifest.media === 'static');
  } catch { return false; }
}

/** Bounded D1 work and at most ten R2 deletions per call; Node drives further batches. */
export async function cleanupBuild(env: RuntimeEnv, id: string) {
  if (!await servesStaticMedia(env)) return { revisionsDeleted: 0, mediaDeleted: 0, more: false, skipped: true };
  const now = Date.now();
  const build = await env.DB.prepare('SELECT created_at FROM cms_build WHERE id=? AND expires_at>?').bind(id, now).first<{ created_at: number }>();
  if (!build) throw new BuildCleanupConflictError('This build expired. Build again before cleanup.');
  await env.DB.prepare('DELETE FROM cms_build WHERE expires_at IS NULL OR expires_at<=?').bind(now).run();
  const limit = historyLimit(cmsConfig.maxPublicationRevisions);
  let revisionsDeleted = 0;
  if (limit !== null) {
    const result = await env.DB.prepare(`DELETE FROM document_revision WHERE id IN (
      SELECT r.id FROM document_revision r JOIN document_translation t ON t.id=r.document_translation_id
      WHERE r.created_at<=? AND r.id IS NOT t.published_revision_id
        AND (SELECT COUNT(*) FROM document_revision newer WHERE newer.document_translation_id=r.document_translation_id
          AND (newer.revision>r.revision OR newer.id=t.published_revision_id))>=?
        AND NOT EXISTS (SELECT 1 FROM cms_build b WHERE b.expires_at>? AND instr(b.revision_ids,r.id)>0)
      ORDER BY r.created_at,r.id LIMIT ${batchSize}
    ) AND EXISTS (SELECT 1 FROM cms_build WHERE id=? AND expires_at>?)`).bind(build.created_at, limit, now, id, now).run();
    revisionsDeleted = result.meta.changes;
  }
  const candidates = await env.DB.prepare(`SELECT id,object_key FROM media
    WHERE created_at<=? AND (EXISTS (SELECT 1 FROM media_deletion x WHERE x.media_id=media.id) OR NOT ${mediaHasReferences})
    ORDER BY created_at,id LIMIT ${batchSize}`).bind(build.created_at - uploadGraceMs, now).all<{ id: string; object_key: string }>();
  let mediaDeleted = 0;
  for (const candidate of candidates.results) {
    const claimed = await env.DB.prepare(`INSERT OR IGNORE INTO media_deletion (media_id)
      SELECT id FROM media WHERE id=? AND NOT ${mediaHasReferences}
      AND EXISTS (SELECT 1 FROM cms_build WHERE id=? AND expires_at>?)`)
      .bind(candidate.id, now, id, now).run();
    const pending = claimed.meta.changes > 0 || await env.DB.prepare('SELECT media_id FROM media_deletion WHERE media_id=?').bind(candidate.id).first();
    if (!pending) continue;
    // Never lose metadata before R2 succeeds. A failed delete remains claimed and is retried.
    await env.MEDIA.delete(candidate.object_key);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM media WHERE id=? AND EXISTS (SELECT 1 FROM media_deletion WHERE media_id=?)').bind(candidate.id, candidate.id),
      env.DB.prepare('DELETE FROM media_deletion WHERE media_id=?').bind(candidate.id),
    ]);
    mediaDeleted++;
  }
  return { revisionsDeleted, mediaDeleted, more: revisionsDeleted === batchSize || candidates.results.length === batchSize };
}
