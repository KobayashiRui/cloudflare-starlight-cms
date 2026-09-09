import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';

type Document = { id: string; title: string; slug: string; description: string; section: string; order: number; contentJson: object; status: string; version: number };
type Media = { id: string; fileName: string; contentType: string; url: string };
let current: Document | undefined;

const Callout = Node.create({ name: 'callout', group: 'block', content: 'block+', addAttributes: () => ({ title: { default: 'Note' } }), parseHTML: () => [{ tag: 'aside[data-callout]' }], renderHTML: ({ HTMLAttributes }) => ['aside', { 'data-callout': '', ...HTMLAttributes }, 0] });
const Steps = Node.create({ name: 'steps', group: 'block', content: 'listItem+', parseHTML: () => [{ tag: 'ol[data-steps]' }], renderHTML: () => ['ol', { 'data-steps': '' }, 0] });
const Tabs = Node.create({ name: 'tabs', group: 'block', content: 'tab+', parseHTML: () => [{ tag: 'section[data-tabs]' }], renderHTML: () => ['section', { 'data-tabs': '' }, 0] });
const Tab = Node.create({ name: 'tab', content: 'block+', addAttributes: () => ({ label: { default: 'Tab' } }), parseHTML: () => [{ tag: 'section[data-tab]' }], renderHTML: ({ HTMLAttributes }) => ['section', { 'data-tab': '', ...HTMLAttributes }, 0] });
const Video = Node.create({ name: 'video', group: 'block', atom: true, addAttributes: () => ({ src: { default: null }, mediaId: { default: null } }), parseHTML: () => [{ tag: 'video' }], renderHTML: ({ HTMLAttributes }) => ['video', { controls: '', ...HTMLAttributes }] });

const editor = new Editor({
  element: document.querySelector('#editor')!,
  extensions: [StarterKit, Image, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Callout, Steps, Tabs, Tab, Video],
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
});

const headers = (json = false) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'X-Requested-With': 'cloudflare-starlight-cms',
});
const notice = (message: string, error = false) => {
  const element = document.querySelector('#notice')!;
  element.textContent = message; element.className = error ? 'error' : 'muted';
};
async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`/admin/api${path}`, { ...init, headers: { ...headers(Boolean(init.body && !(init.body instanceof FormData))), ...init.headers } });
  if (response.status === 204) return undefined;
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}
function value(id: string): HTMLInputElement | HTMLTextAreaElement { return document.querySelector(`#${id}`)!; }
function payload() {
  return { title: value('title').value, slug: value('slug').value, description: value('description').value,
    section: value('section').value, order: Number(value('order').value || 0), contentJson: editor.getJSON(), version: current?.version };
}
function select(documentValue: Document) {
  current = documentValue;
  value('title').value = documentValue.title; value('slug').value = documentValue.slug;
  value('description').value = documentValue.description; value('section').value = documentValue.section;
  value('order').value = String(documentValue.order); editor.commands.setContent(documentValue.contentJson);
  (document.querySelector('#form') as HTMLElement).hidden = false;
  notice(`${documentValue.status} · revision ${documentValue.version}`);
}
async function refreshDocuments() {
  const docs = await api('/documents') as Document[];
  const list = document.querySelector('#documents')!; list.replaceChildren();
  for (const doc of docs) {
    const button = document.createElement('button'); button.textContent = `${doc.title} (${doc.status})`;
    button.onclick = async () => select(await api(`/documents/${encodeURIComponent(doc.id)}`) as Document); list.append(button);
  }
}
async function refreshMedia() {
  const media = await api('/media') as Media[];
  const list = document.querySelector('#media-list')!; list.replaceChildren();
  for (const item of media) {
    const button = document.createElement('button'); button.className = 'media'; button.textContent = item.fileName;
    button.onclick = () => {
      if (item.contentType.startsWith('image/')) editor.chain().focus().setImage({ src: item.url, alt: item.fileName, mediaId: item.id } as never).run();
      else editor.chain().focus().insertContent({ type: 'video', attrs: { src: item.url, mediaId: item.id } }).run();
    };
    list.append(button);
  }
}
document.querySelector('#new')!.addEventListener('click', () => select({ id: '', title: '', slug: '', description: '', section: '', order: 0, contentJson: { type: 'doc', content: [{ type: 'paragraph' }] }, status: 'draft', version: 0 }));
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((button) => button.onclick = () => {
  const command = button.dataset.command!;
  if (command === 'insertTable') editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  else if (command === 'callout') editor.chain().focus().insertContent({ type: 'callout', attrs: { title: 'Note' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Callout text' }] }] }).run();
  else if (command === 'steps') editor.chain().focus().insertContent({ type: 'steps', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First step' }] }] }] }).run();
  else if (command === 'tabs') editor.chain().focus().insertContent({ type: 'tabs', content: [{ type: 'tab', attrs: { label: 'Tab' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tab content' }] }] }] }).run();
  else (editor.chain().focus() as unknown as Record<string, () => { run: () => void }>)[`toggle${command[0]!.toUpperCase()}${command.slice(1)}`]?.().run();
});
document.querySelector('#image')!.addEventListener('click', () => notice('Upload or select an image from Media.'));
document.querySelector('#video')!.addEventListener('click', () => notice('Upload or select a video from Media.'));
document.querySelector('#save')!.addEventListener('click', async () => {
  try { const saved = current?.id ? await api(`/documents/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify(payload()) }) : await api('/documents', { method: 'POST', body: JSON.stringify(payload()) }); select(saved as Document); await refreshDocuments(); } catch (error) { notice(String(error), true); }
});
document.querySelector('#publish')!.addEventListener('click', async () => {
  if (!current?.id) return notice('Save the document first.', true);
  try { select(await api(`/documents/${encodeURIComponent(current.id)}/publish`, { method: 'POST', body: JSON.stringify({ version: current.version }) }) as Document); await refreshDocuments(); } catch (error) { notice(String(error), true); }
});
document.querySelector('#history')!.addEventListener('click', async () => {
  if (!current?.id) return;
  try { const revisions = await api(`/documents/${encodeURIComponent(current.id)}/revisions`) as Array<{ id: string; revision: number; createdAt: number }>;
    const area = document.querySelector('#revisions')!; area.replaceChildren();
    for (const revision of revisions) { const button = document.createElement('button'); button.textContent = `Restore revision ${revision.revision}`; button.onclick = async () => { if (!current) return; select(await api(`/documents/${current.id}/revisions/${revision.id}/restore`, { method: 'POST', body: JSON.stringify({ version: current.version }) }) as Document); await refreshDocuments(); }; area.append(button); }
  } catch (error) { notice(String(error), true); }
});
document.querySelector('#delete')!.addEventListener('click', async () => {
  if (!current?.id || !confirm(`Delete ${current.title}?`)) return;
  try { await api(`/documents/${encodeURIComponent(current.id)}`, { method: 'DELETE', body: JSON.stringify({ version: current.version }) }); current = undefined; (document.querySelector('#form') as HTMLElement).hidden = true; await refreshDocuments(); } catch (error) { notice(String(error), true); }
});
document.querySelector('#upload')!.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { const form = new FormData(); form.set('file', file); await api('/media', { method: 'POST', body: form }); await refreshMedia(); notice('Media uploaded. Select it to insert.'); } catch (error) { notice(String(error), true); }
});
Promise.all([refreshDocuments(), refreshMedia()]).then(() => notice('Ready.')).catch((error) => notice(String(error), true));
