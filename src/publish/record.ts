import type { RuntimeEnv } from '../env.ts';

/** Append this statement to the mutation's batch so a committed change is recoverable. */
export function siteDeliveryStatement(env: RuntimeEnv, condition: string, bindings: (string | number | null)[] = []) {
  return env.DB.prepare(`INSERT INTO publish_delivery
    (id,trigger_kind,status,attempts,already_exists,requested_at)
    SELECT ?,'site','pending',0,0,? WHERE ${condition}`)
    .bind(crypto.randomUUID(), Date.now(), ...bindings);
}

const publishedFolderCondition = `EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM folder WHERE id=?
      UNION SELECT f.id FROM folder f JOIN descendants p ON f.parent_id=p.id
    ) SELECT 1 FROM document d JOIN document_translation t ON t.document_id=d.id
      WHERE d.folder_id IN (SELECT id FROM descendants) AND t.published_revision_id IS NOT NULL
  )`;
export function folderDeliveryStatement(env: RuntimeEnv, folderId: string) {
  return siteDeliveryStatement(env, publishedFolderCondition, [folderId]);
}
