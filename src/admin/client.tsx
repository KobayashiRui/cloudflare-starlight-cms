import { Node, type JSONContent } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import type { Editor, Extensions } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SimpleEditor } from './components/tiptap-templates/simple/simple-editor';
import { NavigationTree, type NavigationItem } from './navigation-tree';
import './styles/_variables.scss';
import './styles/_keyframe-animations.scss';
import './admin.scss';

type DocumentRecord = {
  id: string;
  title: string;
  slug: string;
  description: string;
  folderId: string | null;
  order: number;
  contentJson: JSONContent;
  status: 'draft' | 'published';
  version: number;
};
type Media = { id: string; fileName: string; contentType: string; url: string };
type Revision = { id: string; revision: number; createdAt: number };
type DocumentFields = Pick<DocumentRecord, 'title' | 'slug' | 'description' | 'folderId' | 'order'>;
type ThemePreference = 'system' | 'light' | 'dark';

const emptyContent: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptyDocument: DocumentRecord = {
  id: '', title: '', slug: '', description: '', folderId: null, order: 0,
  contentJson: emptyContent, status: 'draft', version: 0,
};
const mediaTypes = 'image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm';

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+',
  addAttributes: () => ({ title: { default: 'Note' } }),
  parseHTML: () => [{ tag: 'aside[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', { 'data-callout': '', ...HTMLAttributes }, 0],
});
const Steps = Node.create({
  name: 'steps', group: 'block', content: 'listItem+',
  parseHTML: () => [{ tag: 'ol[data-steps]' }],
  renderHTML: () => ['ol', { 'data-steps': '' }, 0],
});
const Tabs = Node.create({
  name: 'tabs', group: 'block', content: 'tab+',
  parseHTML: () => [{ tag: 'section[data-tabs]' }],
  renderHTML: () => ['section', { 'data-tabs': '' }, 0],
});
const Tab = Node.create({
  name: 'tab', content: 'block+',
  addAttributes: () => ({ label: { default: 'Tab' } }),
  parseHTML: () => [{ tag: 'section[data-tab]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', { 'data-tab': '', ...HTMLAttributes }, 0],
});
const Video = Node.create({
  name: 'video', group: 'block', atom: true,
  addAttributes: () => ({ src: { default: null }, mediaId: { default: null } }),
  parseHTML: () => [{ tag: 'video' }],
  renderHTML: ({ HTMLAttributes }) => ['video', { controls: '', ...HTMLAttributes }],
});

const documentExtensions: Extensions = [
  Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
  Callout, Steps, Tabs, Tab, Video,
];

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isJson = Boolean(init.body && !(init.body instanceof FormData));
  const response = await fetch(`/admin/api${path}`, {
    ...init,
    headers: {
      'X-Requested-With': 'cloudflare-starlight-cms',
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

function documentFields(document: DocumentRecord): DocumentFields {
  const { title, slug, description, folderId, order } = document;
  return { title, slug, description, folderId, order };
}

function setEditorDocument(editor: Editor | null, content: JSONContent) {
  editor?.commands.setContent(content || emptyContent, { emitUpdate: false });
}

function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [treeItems, setTreeItems] = useState<NavigationItem[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [current, setCurrent] = useState<DocumentRecord | null>(null);
  const [fields, setFields] = useState<DocumentFields>(documentFields(emptyDocument));
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [notice, setNotice] = useState('Loading documents…');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem('docs-cms-theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  const showNotice = useCallback((message: string, error = false) => {
    setNotice(message);
    setNoticeIsError(error);
  }, []);
  const refreshDocuments = useCallback(async () => {
    setDocuments(await api<DocumentRecord[]>('/documents'));
  }, []);
  const refreshMedia = useCallback(async () => {
    setMedia(await api<Media[]>('/media'));
  }, []);
  const refreshTree = useCallback(async () => { setTreeItems(await api<NavigationItem[]>('/tree')); }, []);

  useEffect(() => {
    Promise.all([refreshDocuments(), refreshMedia(), refreshTree()])
      .then(() => showNotice('Ready.'))
      .catch((error: unknown) => showNotice(String(error), true));
  }, [refreshDocuments, refreshMedia, refreshTree, showNotice]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    window.localStorage.setItem('docs-cms-theme', theme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    if (!current || !editor) return;
    setEditorDocument(editor, current.contentJson);
  }, [current, editor]);

  const selectDocument = useCallback(async (document: DocumentRecord) => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    try {
      const loaded = document.id ? await api<DocumentRecord>(`/documents/${encodeURIComponent(document.id)}`) : document;
      setCurrent(loaded);
      setFields(documentFields(loaded));
      setRevisions([]);
      setIsRevisionOpen(false);
      setEditorDocument(editor, loaded.contentJson);
      setIsDirty(false);
      showNotice(`${loaded.status === 'published' ? 'Published' : 'Draft'} · revision ${loaded.version}`);
    } catch (error) {
      showNotice(String(error), true);
    }
  }, [editor, isDirty, showNotice]);

  const updateField = (field: keyof DocumentFields, value: string | number | null) => {
    setFields((currentFields) => ({ ...currentFields, [field]: value }));
    setIsDirty(true);
  };
  const updateTitle = (title: string) => {
    setFields((currentFields) => ({
      ...currentFields,
      title,
      slug: current?.id
        ? currentFields.slug
        : slugify(title) || currentFields.slug || `document-${crypto.randomUUID().slice(0, 8)}`,
    }));
    setIsDirty(true);
  };

  const save = async (): Promise<DocumentRecord | undefined> => {
    if (!editor || !current) return undefined;
    setIsSaving(true);
    try {
      const body = { ...fields, contentJson: editor.getJSON(), version: current.version };
      const saved = current.id
        ? await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api<DocumentRecord>('/documents', { method: 'POST', body: JSON.stringify(body) });
      setCurrent(saved);
      setFields(documentFields(saved));
      setIsDirty(false);
      await Promise.all([refreshDocuments(), refreshTree()]);
      showNotice('Draft saved.');
      return saved;
    } catch (error) {
      showNotice(String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const publish = async () => {
    if (!current?.id) return showNotice('Save the document before publishing.', true);
    let documentToPublish = current;
    if (isDirty) {
      const saved = await save();
      if (!saved) return;
      documentToPublish = saved;
    }
    setIsSaving(true);
    try {
      const saved = await api<DocumentRecord>(`/documents/${encodeURIComponent(documentToPublish.id)}/publish`, {
        method: 'POST', body: JSON.stringify({ version: documentToPublish.version }),
      });
      setCurrent(saved);
      setFields(documentFields(saved));
      await Promise.all([refreshDocuments(), refreshTree()]);
      showNotice('Published. A Workers Build can now publish this version.');
    } catch (error) {
      showNotice(String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const loadRevisions = async () => {
    if (!current?.id) return;
    try {
      setRevisions(await api<Revision[]>(`/documents/${encodeURIComponent(current.id)}/revisions`));
      setIsRevisionOpen(true);
    } catch (error) {
      showNotice(String(error), true);
    }
  };

  const restore = async (revision: Revision) => {
    if (!current?.id) return;
    try {
      const restored = await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}/revisions/${encodeURIComponent(revision.id)}/restore`, {
        method: 'POST', body: JSON.stringify({ version: current.version }),
      });
      setCurrent(restored);
      setFields(documentFields(restored));
      setEditorDocument(editor, restored.contentJson);
      setIsDirty(false);
      await Promise.all([refreshDocuments(), refreshTree()]);
      showNotice(`Revision ${revision.revision} restored as a draft.`);
    } catch (error) {
      showNotice(String(error), true);
    }
  };

  const remove = async () => {
    if (!current?.id || !window.confirm(`Delete “${current.title}”?`)) return;
    try {
      await api<void>(`/documents/${encodeURIComponent(current.id)}`, {
        method: 'DELETE', body: JSON.stringify({ version: current.version }),
      });
      setCurrent(null);
      setFields(documentFields(emptyDocument));
      setRevisions([]);
      setEditorDocument(editor, emptyContent);
      setIsDirty(false);
      await Promise.all([refreshDocuments(), refreshTree()]);
      showNotice('Document deleted.');
    } catch (error) {
      showNotice(String(error), true);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return undefined;
    try {
      const form = new FormData();
      form.set('file', file);
      const uploaded = await api<Media>('/media', { method: 'POST', body: form });
      await refreshMedia();
      showNotice('Media uploaded. Select it to insert it.');
      return uploaded;
    } catch (error) {
      showNotice(String(error), true);
      return undefined;
    }
  };

  const insertMedia = (item: Media) => {
    if (!editor) return;
    if (item.contentType.startsWith('image/')) {
      editor.chain().focus().setImage({ src: item.url, alt: item.fileName }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'video', attrs: { src: item.url, mediaId: item.id } }).run();
    }
    setIsDirty(true);
    setIsMediaPickerOpen(false);
    showNotice(`${item.fileName} inserted.`);
  };

  return <div className="cms-shell">
    <header className="cms-topbar">
      <a className="cms-brand" href="/admin" aria-label="Docs CMS home"><span className="cms-brand-mark">✦</span><span>Docs CMS</span></a>
      <div className="cms-topbar-controls">
        <label className="cms-theme-select"><span className="sr-only">Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)} aria-label="Theme"><option value="system">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      {current && <div className="cms-actions">
        <span className={`cms-status cms-status-${current.status}`}>{isDirty ? 'Unsaved' : current.status}</span>
        <span className={`cms-notice ${noticeIsError ? 'is-error' : ''}`} role="status">{notice}</span>
        <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void save()}>{isSaving ? 'Saving…' : 'Save draft'}</button>
        <button className="cms-button cms-button-publish" type="button" disabled={isSaving || !current.id} onClick={() => void publish()}>Publish</button>
        <button className="cms-button cms-button-danger" type="button" disabled={!current.id} onClick={() => void remove()}>Delete</button>
      </div>}
      </div>
    </header>

    <div className="cms-workspace">
      <aside className="cms-sidebar">
        <div className="cms-sidebar-heading"><span>Documents</span><span className="cms-count">{documents.length}</span></div>
        <label className="cms-search"><span className="sr-only">Search documents</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" /></label>
        <button className="cms-new-document" type="button" onClick={() => void selectDocument(emptyDocument)}>New document</button>
        <NavigationTree key={treeItems.map((item) => item.id).join(':')} items={treeItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))} selectedId={current?.id} onSelect={(id) => { const document = documents.find((item) => item.id === id); if (document) void selectDocument(document); }} />
      </aside>

      <main className="cms-main">
        {!current ? <section className="cms-empty-state"><span className="cms-empty-icon">✦</span><h1>Start a document</h1><p>Create a draft or choose a document from the sidebar.</p><button className="cms-button cms-button-primary" type="button" onClick={() => void selectDocument(emptyDocument)}>New document</button></section> : <>
          <div className="cms-breadcrumb"><span>Navigation</span><span>/</span><span>{fields.slug || 'new-document'}</span></div>
          <section className="cms-editor-surface" aria-label="Document editor">
            <div className="cms-document-fields">
              <label className="cms-meta-field">
                <span>Title</span>
                <input className="cms-title-input" value={fields.title} onChange={(event) => updateTitle(event.target.value)} placeholder="Untitled document" />
              </label>
              <label className="cms-meta-field">
                <span>Description</span>
                <textarea className="cms-description-input" value={fields.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Add a concise summary for your readers" rows={2} />
              </label>
            </div>
            <section className="cms-editor-field" aria-label="Content">
              <header className="cms-editor-field-header"><span>Content</span>{current.id && <button className="cms-history-button" type="button" onClick={() => void loadRevisions()} aria-expanded={isRevisionOpen}>{isRevisionOpen ? 'Refresh history' : 'Revision history'}</button>}</header>
              <div className="cms-simple-editor"><SimpleEditor content={emptyContent} extensions={documentExtensions} onEditorReady={setEditor} onUpdate={() => setIsDirty(true)} uploadImage={async (file) => {
                const uploaded = await upload(file);
                if (!uploaded) throw new Error('Image upload failed');
                return uploaded.url;
              }} /></div>
            </section>
            {isRevisionOpen && <section className="cms-revision-history" aria-label="Revision history"><header><h2>Revision history</h2><button type="button" onClick={() => setIsRevisionOpen(false)}>Close</button></header>{revisions.length === 0 ? <p>No saved revisions yet.</p> : <div className="cms-revisions">{revisions.map((revision) => <div className="cms-revision" key={revision.id}><span><strong>Revision {revision.revision}</strong><time>{new Date(revision.createdAt).toLocaleString()}</time></span><button type="button" onClick={() => void restore(revision)}>Restore</button></div>)}</div>}</section>}
          </section>
        </>}
      </main>
    </div>

    {isMediaPickerOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsMediaPickerOpen(false)}>
      <section className="cms-media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-library-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h1 id="media-library-title">Media library</h1><p>Select an image or video to add it at the cursor.</p></div><button type="button" className="cms-close-settings" onClick={() => setIsMediaPickerOpen(false)} aria-label="Close media library">×</button></header>
        <div className="cms-media-dialog-actions"><label className="cms-upload">Upload media<input type="file" accept={mediaTypes} onChange={(event) => void upload(event.currentTarget.files?.[0])} /></label></div>
        <div className="cms-media-grid">{media.length === 0 ? <p className="cms-media-empty">No media uploaded yet.</p> : media.map((item) => <button key={item.id} type="button" className="cms-media-card" onClick={() => insertMedia(item)}><span className="cms-media-preview">{item.contentType.startsWith('image/') ? <img src={item.url} alt="" /> : <video src={item.url} muted preload="metadata" />}</span><strong>{item.fileName}</strong><span>{item.contentType.startsWith('image/') ? 'Image' : 'Video'}</span></button>)}</div>
      </section>
    </div>}
  </div>;
}

const root = document.querySelector('#admin-root');
if (!root) throw new Error('Admin root is missing.');
createRoot(root).render(<App />);
