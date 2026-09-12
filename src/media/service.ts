import { asc, eq } from 'drizzle-orm';
import { database } from '../db/client.ts';
import { documentRevision, documentTranslation, media } from '../db/schema.ts';
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

function mediaUrl(env: RuntimeEnv, key: string): string {
  const base = env.MEDIA_PUBLIC_URL?.replace(/\/$/, '');
  return base ? `${base}/${key}` : `/admin/api/media/object/${key}`;
}

export function signatureMatches(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/avif' || type === 'video/mp4') return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  if (type === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

function contentReferencesObjectKey(content: unknown, objectKey: string): boolean {
  if (!content || typeof content !== 'object') return false;
  if (Array.isArray(content)) return content.some((item) => contentReferencesObjectKey(item, objectKey));

  const node = content as { type?: unknown; attrs?: { src?: unknown }; content?: unknown };
  if ((node.type === 'image' || node.type === 'video') && typeof node.attrs?.src === 'string') {
    try {
      const { pathname } = new URL(node.attrs.src, 'https://cms.invalid');
      if (pathname === `/${objectKey}` || pathname.endsWith(`/${objectKey}`)) return true;
    } catch {
      // A malformed editor URL cannot identify a managed R2 object.
    }
  }
  return contentReferencesObjectKey(node.content, objectKey);
}

export function contentReferencesMediaObject(contentJson: string, objectKey: string): boolean {
  try {
    return contentReferencesObjectKey(JSON.parse(contentJson), objectKey);
  } catch {
    // Preserve media for malformed historical JSON: it cannot prove an asset is unused.
    return true;
  }
}

async function referencedObjectKeys(env: RuntimeEnv, objectKeys: readonly string[]): Promise<Set<string>> {
  if (objectKeys.length === 0) return new Set();
  const db = database(env);
  const [drafts, revisions] = await Promise.all([
    db.select({ contentJson: documentTranslation.contentJson }).from(documentTranslation),
    db.select({ contentJson: documentRevision.contentJson }).from(documentRevision),
  ]);
  const content = [...drafts, ...revisions].map((row) => row.contentJson);
  return new Set(objectKeys.filter((objectKey) => content.some((json) => contentReferencesMediaObject(json, objectKey))));
}

export async function listMedia(env: RuntimeEnv) {
  const rows = await database(env).select().from(media).orderBy(asc(media.fileName));
  const usedObjectKeys = await referencedObjectKeys(env, rows.map((row) => row.objectKey));
  return rows.map((row) => ({ ...row, url: mediaUrl(env, row.objectKey), isUsed: usedObjectKeys.has(row.objectKey) }));
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
  return { id, objectKey, fileName: file.name, contentType: type, size: file.size, url: mediaUrl(env, objectKey) };
}

export async function deleteUnusedMedia(env: RuntimeEnv, id: string): Promise<void> {
  const db = database(env);
  const row = await db.select().from(media).where(eq(media.id, id)).get();
  if (!row) throw new MediaNotFoundError();
  if ((await referencedObjectKeys(env, [row.objectKey])).has(row.objectKey)) {
    throw new MediaInUseError('Media is still used by a draft, published page, or revision');
  }

  await db.delete(media).where(eq(media.id, id));
  try {
    await env.MEDIA.delete(row.objectKey);
  } catch (error) {
    // Restore the row when R2 rejects deletion, leaving the object manageable.
    await db.insert(media).values(row);
    throw error;
  }
}
