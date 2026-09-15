/**
 * URLs that end up in a document are rendered in both the public static site
 * and the HTTPS-only Admin preview. Keep this check independent from the
 * Starlight renderer so the API rejects an invalid document before it is
 * stored.
 */
function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const values = parts.map(Number);
  if (values.some((value) => value < 0 || value > 255)) return false;
  const first = values[0]!;
  const second = values[1]!;
  return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 ||
    first === 192 && second === 168 || first === 172 && second >= 16 && second <= 31 ||
    first === 100 && second >= 64 && second <= 127;
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local') ||
    normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') || isPrivateIpv4(normalized);
}

function documentPath(value: string, options: { allowAdminMediaProxy?: boolean } = {}): string | null {
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) throw new Error('Document URLs must not use protocol-relative paths');
  if (value.startsWith('/admin/api/media/object/') && !options.allowAdminMediaProxy) {
    throw new Error('Published media requires MEDIA_PUBLIC_URL');
  }
  return value;
}

/**
 * Validate a regular document link. Navigating to an HTTP target is permitted
 * by browsers; it is distinct from loading insecure media inside an HTTPS page.
 */
export function documentLinkUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || /[\s"<>]/.test(value)) {
    throw new Error('Document links must be an HTTP(S) URL or a site-relative path');
  }
  const path = documentPath(value);
  if (path) return path;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Document links must be an HTTP(S) URL or a site-relative path');
  }
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Document links must be an HTTP(S) URL or a site-relative path');
  }
  return url.toString();
}

/**
 * Validate an image or video source. A public HTTPS origin or a site-relative
 * path is valid. HTTP and private-network media cannot load inside an HTTPS
 * Docs page, causing Mixed Content and Private Network Access failures.
 */
export function documentMediaUrl(value: unknown, options: { allowAdminMediaProxy?: boolean } = {}): string {
  if (typeof value !== 'string' || value.length === 0 || /[\s"<>]/.test(value)) {
    throw new Error('Document media URLs must be a public HTTPS URL or a site-relative path');
  }
  const path = documentPath(value, options);
  if (path) return path;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Document media URLs must be a public HTTPS URL or a site-relative path');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('External document media URLs must use HTTPS');
  }
  if (isLocalHost(url.hostname)) throw new Error('Document media URLs cannot target local network hosts');
  return url.toString();
}

type ContentNode = {
  type?: unknown;
  attrs?: Record<string, unknown>;
  marks?: unknown;
  content?: unknown;
};

/**
 * Older CMS versions could persist HTTP or local-network media. Do not send
 * those nodes to the browser: they fail under HTTPS and make the whole page
 * impossible to save. Replace them with ordinary text; a later Save draft
 * persists the safe replacement.
 */
export function repairLegacyDocumentMedia(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(repairLegacyDocumentMedia);
  const node = value as ContentNode;
  if (node.type === 'image' || node.type === 'video') {
    try { documentMediaUrl(node.attrs?.src, { allowAdminMediaProxy: true }); }
    catch { return { type: 'paragraph', content: [{ type: 'text', text: 'Media omitted because its source must use HTTPS.' }] }; }
  }
  return { ...node, ...(Array.isArray(node.content) ? { content: node.content.map(repairLegacyDocumentMedia) } : {}) };
}

/** Validate URLs in the supported Tiptap node and mark shapes. */
export function assertDocumentContentUrls(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const node = value as ContentNode;
  if (node.type === 'image' || node.type === 'video') documentMediaUrl(node.attrs?.src, { allowAdminMediaProxy: true });
  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      if (!mark || typeof mark !== 'object' || Array.isArray(mark)) continue;
      const typed = mark as { type?: unknown; attrs?: Record<string, unknown> };
      if (typed.type === 'link') documentLinkUrl(typed.attrs?.href);
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) assertDocumentContentUrls(child);
  }
}
