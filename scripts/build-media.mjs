import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseFragment } from 'parse5';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mediaObjectKey, mediaUrl } from '../src/media/urls.ts';

/** Parse destinations, never replace URLs in prose, code examples or alt text. */
export function staticMediaMarkdown(markdown, media, used) {
  const edits = [];
  function destination(url) {
    const key = mediaObjectKey(url);
    if (!key || !media.has(key)) {
      if (url.startsWith('/admin/api/media/object/') || url.startsWith('/_cms-media/')) throw new Error('Published media is missing from the CMS');
      return null;
    }
    used.add(key);
    return mediaUrl(key, 'public');
  }
  function html(node) {
    const offset = node.position.start.offset;
    function walk(value) {
      for (const attr of value.attrs ?? []) {
        if (!['src', 'href', 'poster'].includes(attr.name)) continue;
        const url = destination(attr.value);
        const location = value.sourceCodeLocation?.attrs?.[attr.name];
        if (url && location) edits.push({ start: offset + location.startOffset, end: offset + location.endOffset, value: `${attr.name}="${url}"` });
      }
      for (const child of value.childNodes ?? []) walk(child);
      if (value.content) walk(value.content);
    }
    walk(parseFragment(node.value, { sourceCodeLocationInfo: true }));
  }
  function walk(node) {
    if (['image', 'link', 'definition'].includes(node.type)) {
      const url = destination(node.url);
      if (url) {
        const start = node.position.start.offset;
        const end = node.position.end.offset;
        const segment = markdown.slice(start, end);
        // CMS renderer emits literal URL destinations; older snapshots use the same format.
        const index = segment.lastIndexOf(node.url);
        if (index < 0) throw new Error('Cannot resolve a published media destination');
        edits.push({ start: start + index, end: start + index + node.url.length, value: url });
      }
    }
    if (node.type === 'html') html(node);
    for (const child of node.children ?? []) walk(child);
  }
  walk(fromMarkdown(markdown));
  for (const edit of edits.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, edit.start) + edit.value + markdown.slice(edit.end);
  return markdown;
}

export async function copyPublishedMedia(snapshot, records, directory, request) {
  const media = new Map();
  for (const row of records) {
    if (mediaObjectKey(`/${row.objectKey}`) !== row.objectKey || !Number.isSafeInteger(row.size) || row.size <= 0) throw new Error('Invalid CMS media metadata');
    media.set(row.objectKey, row);
  }
  const used = new Set();
  const documents = snapshot.documents.map((document) => ({ ...document, body: {
    ...document.body, value: staticMediaMarkdown(document.body.value, media, used),
  } }));
  await mkdir(directory, { recursive: true });
  // Bound memory and requests; download once per immutable key, including shared locale media.
  for (const key of used) {
    const record = media.get(key);
    if (record.size > 25 * 1024 * 1024) throw new Error('Published media exceeds 25 MiB');
    const response = await request(mediaUrl(key, 'admin'));
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== record.size || response.headers.get('content-type')?.split(';')[0] !== record.contentType) throw new Error('CMS media does not match its metadata');
    await writeFile(join(directory, key.slice('media/'.length)), bytes);
  }
  return { ...snapshot, documents };
}
