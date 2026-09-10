import type { RuntimeEnv } from '../env.ts';
import { triggerDeployHook } from './deploy-hook.ts';
import { publishDocument, type DocumentView } from '../documents/service.ts';
import type { SupportedLocale } from '../locales.ts';

export type PublishDeliveryStatus = 'pending' | 'accepted' | 'failed' | 'skipped';
export type PublishDeliveryKind = 'document' | 'site';

type DeliveryRow = {
  id: string;
  trigger_kind: PublishDeliveryKind;
  document_translation_id: string | null;
  status: PublishDeliveryStatus;
  attempts: number;
  build_id: string | null;
  already_exists: number;
  last_error: string | null;
  requested_at: number;
  accepted_at: number | null;
  next_retry_at: number | null;
};

export type PublishDelivery = {
  id: string;
  triggerKind: PublishDeliveryKind;
  documentTranslationId: string | null;
  status: PublishDeliveryStatus;
  attempts: number;
  buildId: string | null;
  alreadyExists: boolean;
  lastError: string | null;
  requestedAt: number;
  acceptedAt: number | null;
  nextRetryAt: number | null;
};

export class PublishDeliveryNotFoundError extends Error {}
export class PublishDeliveryConflictError extends Error {}

function toView(row: DeliveryRow): PublishDelivery {
  return {
    id: row.id, triggerKind: row.trigger_kind, documentTranslationId: row.document_translation_id,
    status: row.status, attempts: row.attempts, buildId: row.build_id,
    alreadyExists: Boolean(row.already_exists), lastError: row.last_error,
    requestedAt: row.requested_at, acceptedAt: row.accepted_at, nextRetryAt: row.next_retry_at,
  };
}

async function getDelivery(env: RuntimeEnv, id: string): Promise<DeliveryRow> {
  const delivery = await env.DB.prepare(`
    SELECT id,trigger_kind,document_translation_id,status,attempts,build_id,already_exists,last_error,
      requested_at,accepted_at,next_retry_at
    FROM publish_delivery WHERE id=?`).bind(id).first<DeliveryRow>();
  if (!delivery) throw new PublishDeliveryNotFoundError();
  return delivery;
}

export async function createPublishDelivery(env: RuntimeEnv, triggerKind: PublishDeliveryKind, documentTranslationId: string | null = null) {
  const id = crypto.randomUUID();
  const requestedAt = Date.now();
  await env.DB.prepare(`
    INSERT INTO publish_delivery (id,trigger_kind,document_translation_id,status,attempts,already_exists,requested_at)
    VALUES (?,?,?,'pending',0,0,?)`).bind(id, triggerKind, documentTranslationId, requestedAt).run();
  return getDelivery(env, id);
}

function retryAt(attempts: number) {
  return Date.now() + Math.min(60 * 60_000, 30_000 * (2 ** Math.max(0, attempts - 1)));
}

/** Send one already-persisted delivery. A request is never sent before its row exists. */
export async function deliverPublish(env: RuntimeEnv, id: string): Promise<PublishDelivery> {
  const current = await getDelivery(env, id);
  if (current.status === 'accepted' || current.status === 'skipped') return toView(current);
  if (current.status !== 'pending' && current.status !== 'failed') throw new PublishDeliveryConflictError('This build request cannot be retried');

  const attempts = current.attempts + 1;
  const started = await env.DB.prepare(`
    UPDATE publish_delivery SET status='pending',attempts=?,last_error=NULL,next_retry_at=NULL
    WHERE id=? AND status=? AND attempts=?`).bind(attempts, id, current.status, current.attempts).run();
  if (started.meta.changes !== 1) throw new PublishDeliveryConflictError('This build request changed. Reload and try again.');

  if (!env.WORKERS_DEPLOY_HOOK_URL) {
    await env.DB.prepare(`UPDATE publish_delivery SET status='skipped',last_error=? WHERE id=?`)
      .bind('WORKERS_DEPLOY_HOOK_URL is not configured', id).run();
    return toView(await getDelivery(env, id));
  }

  try {
    const hook = await triggerDeployHook(env.WORKERS_DEPLOY_HOOK_URL);
    await env.DB.prepare(`
      UPDATE publish_delivery
      SET status='accepted',build_id=?,already_exists=?,accepted_at=?,last_error=NULL,next_retry_at=NULL
      WHERE id=?`).bind(hook.buildId, hook.alreadyExists ? 1 : 0, Date.now(), id).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workers Deploy Hook request failed';
    await env.DB.prepare(`UPDATE publish_delivery SET status='failed',last_error=?,next_retry_at=? WHERE id=?`)
      .bind(message, retryAt(attempts), id).run();
  }
  return toView(await getDelivery(env, id));
}

export async function requestPublish(env: RuntimeEnv, triggerKind: PublishDeliveryKind, documentTranslationId: string | null = null) {
  const pending = await createPublishDelivery(env, triggerKind, documentTranslationId);
  return deliverPublish(env, pending.id);
}

/** Publish the selected translation and create its delivery in one D1 batch. */
export async function publishDocumentAndRequest(env: RuntimeEnv, id: string, version: number, locale: SupportedLocale): Promise<{ document: DocumentView; delivery: PublishDelivery }> {
  const pending = { id: crypto.randomUUID(), requestedAt: Date.now() };
  const document = await publishDocument(env, id, version, locale, pending);
  return { document, delivery: await deliverPublish(env, pending.id) };
}

export async function retryPublish(env: RuntimeEnv, id: string) {
  const delivery = await getDelivery(env, id);
  if (delivery.status !== 'failed') throw new PublishDeliveryConflictError('Only failed build requests can be retried');
  return deliverPublish(env, id);
}

export async function listPublishDeliveries(env: RuntimeEnv, limit = 10) {
  const rows = await env.DB.prepare(`
    SELECT id,trigger_kind,document_translation_id,status,attempts,build_id,already_exists,last_error,
      requested_at,accepted_at,next_retry_at
    FROM publish_delivery ORDER BY requested_at DESC LIMIT ?`).bind(limit).all<DeliveryRow>();
  return rows.results.map(toView);
}
