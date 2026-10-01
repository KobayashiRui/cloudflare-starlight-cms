import { database } from '../db/client.ts';
import { media } from '../db/schema.ts';
import { mediaHasReferences } from './references.ts';
import type { RuntimeEnv } from '../env.ts';

const mediaTypes = new Map([
  ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp'], ['image/avif', 'avif'],
  ['video/mp4', 'mp4'], ['video/webm', 'webm'],
]);
/** Direct multipart parsing in a Worker is intentionally kept small. */
export const directUploadMaxBytes = 10 * 1024 * 1024;

export class InvalidMediaError extends Error {}
export class MediaNotFoundError extends Error {}
export class MediaInUseError extends Error {}

function mediaUrl(key: string): string {
  return `/admin/api/media/object/${key}`;
}

export function signatureMatches(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/avif' || type === 'video/mp4') return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  if (type === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

export async function listMedia(env: RuntimeEnv) {
  const rows = await env.DB.prepare(`SELECT media.id,object_key AS objectKey,file_name AS fileName,content_type AS contentType,size,created_at AS createdAt,
    CASE WHEN ${mediaHasReferences} THEN 1 ELSE 0 END AS isUsed FROM media
    WHERE NOT EXISTS (SELECT 1 FROM media_deletion x WHERE x.media_id=media.id) ORDER BY file_name`)
    .bind(Date.now()).all<{ id: string; objectKey: string; fileName: string; contentType: string; size: number; createdAt: number; isUsed: number }>();
  return rows.results.map((row) => ({ ...row, url: mediaUrl(row.objectKey), isUsed: Boolean(row.isUsed) }));
}

export async function uploadMedia(env: RuntimeEnv, request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > directUploadMaxBytes + 32 * 1024) {
    throw new InvalidMediaError('Media file exceeds the 10 MiB direct upload limit');
  }
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new InvalidMediaError('A file is required');
  const type = file.type.toLowerCase();
  const extension = mediaTypes.get(type);
  if (!extension) throw new InvalidMediaError('Unsupported media type');
  if (file.size === 0 || file.size > directUploadMaxBytes) throw new InvalidMediaError('Media file exceeds the 10 MiB direct upload limit');
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!signatureMatches(type, header)) throw new InvalidMediaError('Media bytes do not match the declared type');

  const id = crypto.randomUUID();
  const objectKey = `media/${id}.${extension}`;
  const now = Date.now();
  await env.MEDIA.put(objectKey, file.stream(), { httpMetadata: { contentType: type } });
  try {
    await database(env).insert(media).values({
      id, objectKey, fileName: file.name.slice(0, 255) || `${id}.${extension}`, contentType: type,
      size: file.size, createdAt: now,
    });
  } catch (error) {
    await env.MEDIA.delete(objectKey);
    throw error;
  }
  return { id, objectKey, fileName: file.name, contentType: type, size: file.size, url: mediaUrl(objectKey) };
}

export async function deleteUnusedMedia(env: RuntimeEnv, id: string): Promise<void> {
  const row = await env.DB.prepare('SELECT object_key FROM media WHERE id=?').bind(id).first<{ object_key: string }>();
  if (!row) throw new MediaNotFoundError();
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO media_deletion (media_id) SELECT id FROM media WHERE id=? AND NOT ${mediaHasReferences}`)
    .bind(id, Date.now()).run();
  const claimed = result.meta.changes > 0 || await env.DB.prepare('SELECT media_id FROM media_deletion WHERE media_id=?').bind(id).first();
  if (!claimed) throw new MediaInUseError('Media is still used by a draft, published page, revision, or build');
  await env.MEDIA.delete(row.object_key);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM media WHERE id=?').bind(id),
    env.DB.prepare('DELETE FROM media_deletion WHERE media_id=?').bind(id),
  ]);
}
