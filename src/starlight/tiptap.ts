import { z } from 'zod';

const tiptapNode = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  content: z.array(z.unknown()).optional(),
});

export type TiptapNode = z.infer<typeof tiptapNode>;

export function parseTiptapNode(value: unknown): TiptapNode {
  return tiptapNode.parse(value);
}

export function tiptapChildren(value: TiptapNode): TiptapNode[] {
  return (value.content ?? []).map(parseTiptapNode);
}

/** Reject URLs that cannot safely appear in a public document or preview. */
export function documentUrl(value: unknown): string {
  if (typeof value !== 'string' || (!/^https?:\/\//.test(value) && !value.startsWith('/'))) {
    throw new Error('Unsafe media or link URL');
  }
  if (value.startsWith('/admin/api/media/object/')) {
    throw new Error('Published media requires MEDIA_PUBLIC_URL');
  }
  return value.replace(/["<>]/g, '');
}

/** Normalize a supported YouTube URL to the privacy-enhanced embed endpoint. */
export function youtubeEmbedUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid YouTube URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid YouTube URL');
  }
  if (url.protocol !== 'https:') throw new Error('Invalid YouTube URL');

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId: string | null = null;
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) videoId = parts[1] ?? null;
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Invalid YouTube URL');
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** The only iframe emitted by the CMS renderer. Its source is normalized above. */
export function youtubeEmbedHtml(value: unknown): string {
  return `<iframe data-cms-youtube src="${youtubeEmbedUrl(value)}" title="YouTube video player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}
