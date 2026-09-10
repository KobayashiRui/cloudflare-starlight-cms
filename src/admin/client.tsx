import { Node, type JSONContent } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import type { Editor, Extensions } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SimpleEditor } from './components/tiptap-templates/simple/simple-editor';
import { NavigationTree, type NavigationItem } from './navigation-tree';
import { defaultLocale, supportedLocales, type SupportedLocale } from '../locales';
import './styles/_variables.scss';
import './styles/_keyframe-animations.scss';
import './admin.scss';

type DocumentRecord = {
  id: string; locale: SupportedLocale;
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
type Folder = { id: string; name: string; slug: string; parentId: string | null; order: number };
type DocumentFields = Pick<DocumentRecord, 'title' | 'slug' | 'description' | 'folderId' | 'order'>;
type ThemePreference = 'system' | 'light' | 'dark';

const emptyContent: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptyDocument: DocumentRecord = {
  id: '', locale: defaultLocale, title: '', slug: '', description: '', folderId: null, order: 0,
  contentJson: emptyContent, status: 'draft', version: 0,
};
const mediaTypes = 'image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm';
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlugInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 120);
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

async function api<T>(path: string, init: RequestInit = {}, locale?: SupportedLocale): Promise<T> {
  const isJson = Boolean(init.body && !(init.body instanceof FormData));
  const url = new URL(`/admin/api${path}`, window.location.origin);
  if (locale) url.searchParams.set('locale', locale);
  const response = await fetch(url, {
    ...init,
    headers: {
      'X-Requested-With': 'cloudflare-starlight-cms',
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API ${path} returned an invalid response (${response.status}). Restart the local dev server and reload.`);
  }
  const payload = JSON.parse(text) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

function documentFields(document: DocumentRecord): DocumentFields {
  const { title, slug, description, folderId, order } = document;
  return { title, slug, description, folderId, order };
}

function setEditorDocument(editor: Editor | null, content: JSONContent) {
  if (!editor || editor.isDestroyed) return;
  editor.commands.setContent(content || emptyContent, { emitUpdate: false });
}

function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [treeItems, setTreeItems] = useState<NavigationItem[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [current, setCurrent] = useState<DocumentRecord | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderSlug, setFolderSlug] = useState('');
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState({ name: '', slug: '' });
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
  const [locale, setLocale] = useState<SupportedLocale>(defaultLocale);
  const [missingDocumentId, setMissingDocumentId] = useState<string | null>(null);
  const [missingTranslationSource, setMissingTranslationSource] = useState<SupportedLocale | null>(null);
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

  const selectedFolder = treeItems.find((item) => item.kind === 'folder' && item.id === `folder:${selectedFolderId}`) ?? null;

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

  const selectDocument = useCallback(async (document: DocumentRecord, targetLocale: SupportedLocale = document.locale) => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    try {
      const loaded = document.id ? await api<DocumentRecord>(`/documents/${encodeURIComponent(document.id)}`, {}, targetLocale) : document;
      setCurrent(loaded);
      setLocale(loaded.locale);
      setMissingDocumentId(null);
      setMissingTranslationSource(null);
      setSelectedFolderId(null);
      setFields(documentFields(loaded));
      setRevisions([]);
      setIsRevisionOpen(false);
      setIsDirty(false);
      showNotice(`${loaded.status === 'published' ? 'Published' : 'Draft'} · revision ${loaded.version}`);
    } catch (error) {
      showNotice(String(error), true);
    }
  }, [editor, isDirty, showNotice]);

  const selectFolder = useCallback((folderId: string) => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    const folder = treeItems.find((item) => item.id === `folder:${folderId}`);
    if (!folder) return;
    setEditor(null);
    setCurrent(null);
    setLocale(defaultLocale);
    setMissingDocumentId(null);
    setMissingTranslationSource(null);
    setSelectedFolderId(folderId);
    setFolderName(folder.name);
    setFolderSlug(folder.slug);
    setIsDirty(false);
    showNotice(`Folder selected: ${folder.name}`);
  }, [isDirty, showNotice, treeItems]);
  const selectNavigationRoot = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    setEditor(null); setCurrent(null); setSelectedFolderId(null); setMissingDocumentId(null); setMissingTranslationSource(null);
    setLocale(defaultLocale); setIsDirty(false); showNotice('Navigation selected.');
  };

  const selectTreeDocument = (id: string) => {
    const treeItem = treeItems.find((item) => item.documentId === id);
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    if (source) { void selectDocument({ ...emptyDocument, id, locale: source }, source); return; }
    setEditor(null); setCurrent(null); setSelectedFolderId(null); setMissingDocumentId(id); setMissingTranslationSource(null); setIsDirty(false);
    showNotice('No translation exists for this page.');
  };
  const selectDocumentLocale = (targetLocale: SupportedLocale) => {
    if (!current?.id) return;
    const treeItem = treeItems.find((item) => item.documentId === current.id);
    if (treeItem?.translationLocales.includes(targetLocale)) {
      void selectDocument({ ...current, locale: targetLocale }, targetLocale);
      return;
    }
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    setEditor(null); setCurrent(null); setSelectedFolderId(null); setLocale(targetLocale);
    setMissingDocumentId(current.id); setMissingTranslationSource(source ?? null); setIsDirty(false);
    showNotice(`No ${targetLocale} translation yet.`);
  };
  const selectMissingDocumentLocale = (targetLocale: SupportedLocale) => {
    if (!missingDocumentId) return;
    const treeItem = treeItems.find((item) => item.documentId === missingDocumentId);
    if (treeItem?.translationLocales.includes(targetLocale)) {
      void selectDocument({ ...emptyDocument, id: missingDocumentId, locale: targetLocale }, targetLocale);
      return;
    }
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    setLocale(targetLocale);
    setMissingTranslationSource(source ?? null);
    showNotice(`No ${targetLocale} translation yet.`);
  };
  const createDocumentTranslation = async () => {
    if (!missingDocumentId) return;
    setIsSaving(true);
    try {
      if (!missingTranslationSource) throw new Error('No source translation is available.');
      const created = await api<DocumentRecord>(`/documents/${encodeURIComponent(missingDocumentId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale: missingTranslationSource }) }, locale);
      await Promise.all([refreshDocuments(), refreshTree()]);
      await selectDocument(created);
      showNotice(`${locale} translation created from ${missingTranslationSource}.`);
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const nextOrder = useCallback((parentId: string | null) => Math.max(-1, ...treeItems.filter((item) => item.parentId === (parentId ? `folder:${parentId}` : null)).map((item) => item.order)) + 1, [treeItems]);
  const startNewDocument = useCallback((folderId = selectedFolderId) => {
    setLocale(defaultLocale);
    void selectDocument({ ...emptyDocument, folderId, order: nextOrder(folderId) });
  }, [nextOrder, selectDocument, selectedFolderId]);
  const openNewFolder = useCallback((parentId = selectedFolderId) => {
    setSelectedFolderId(parentId);
    setFolderDraft({ name: '', slug: '' });
    setIsFolderDialogOpen(true);
  }, [selectedFolderId]);
  const createFolder = async () => {
    const name = folderDraft.name.trim();
    const slug = folderDraft.slug || slugify(name);
    if (!name || !slug) return showNotice('Folder name is required.', true);
    setIsSaving(true);
    try {
      const created = await api<Folder>('/folders', { method: 'POST', body: JSON.stringify({ name, slug, parentId: selectedFolderId, order: nextOrder(selectedFolderId) }) });
      await refreshTree();
      setIsFolderDialogOpen(false);
      setCurrent(null);
      setSelectedFolderId(created.id);
      setFolderName(created.name);
      setFolderSlug(created.slug);
      showNotice('Folder created.');
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const saveFolder = async () => {
    if (!selectedFolder) return;
    const name = folderName.trim(); const slug = folderSlug || slugify(name);
    if (!name || !slug) return showNotice('Folder name is required.', true);
    setIsSaving(true);
    try {
      await api<Folder>(`/folders/${encodeURIComponent(selectedFolderId!)}`, { method: 'PUT', body: JSON.stringify({ name, slug, parentId: selectedFolder.parentId ? selectedFolder.parentId.slice('folder:'.length) : null, order: selectedFolder.order }) });
      await refreshTree(); showNotice('Folder saved.');
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const deleteFolder = async () => {
    if (!selectedFolderId || !selectedFolder || !window.confirm(`Delete empty folder “${selectedFolder.name}”?`)) return;
    setIsSaving(true);
    try {
      await api<void>(`/folders/${encodeURIComponent(selectedFolderId)}`, { method: 'DELETE' });
      setSelectedFolderId(null); await refreshTree(); showNotice('Folder deleted.');
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const replaceTreeChildren = async (parentId: string | null, childIds: string[]) => {
    try {
      await api('/tree/children', { method: 'PUT', body: JSON.stringify({ parentId, childIds }) });
    } catch (error) { showNotice(String(error), true); throw error; }
  };
  const treeChanged = async () => {
    await Promise.all([refreshTree(), refreshDocuments()]);
    showNotice('Navigation updated.');
  };

  const updateField = (field: keyof DocumentFields, value: string | number | null) => {
    setFields((currentFields) => ({ ...currentFields, [field]: value }));
    setIsDirty(true);
  };
  const updateTitle = (title: string) => {
    const suggestedSlug = slugify(title);
    setFields((currentFields) => ({
      ...currentFields,
      title,
      // A title only suggests the initial URL segment. It never overwrites a
      // value chosen by the editor, and non-Latin titles leave it blank.
      slug: current?.id || currentFields.slug || !suggestedSlug ? currentFields.slug : suggestedSlug,
    }));
    setIsDirty(true);
  };
  const updateSlug = (slug: string) => {
    updateField('slug', normalizeSlugInput(slug));
  };

  const save = async (): Promise<DocumentRecord | undefined> => {
    if (!editor || !current) return undefined;
    if (!validSlug.test(fields.slug)) {
      showNotice('URL segment must use lowercase letters, numbers, and single hyphens.', true);
      return undefined;
    }
    setIsSaving(true);
    try {
      const body = { ...fields, contentJson: editor.getJSON(), version: current.version };
      const saved = current.id
        ? await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify(body) }, current.locale)
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
      }, documentToPublish.locale);
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
      setRevisions(await api<Revision[]>(`/documents/${encodeURIComponent(current.id)}/revisions`, {}, current.locale));
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
      }, current.locale);
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
      }, current.locale);
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

  const breadcrumbItems = (folderId: string | null, leaf?: string) => {
    const folders: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    let cursor = folderId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const folder = treeItems.find((item) => item.id === `folder:${cursor}`);
      if (!folder) break;
      folders.unshift({ id: cursor, name: folder.name });
      cursor = folder.parentId?.slice('folder:'.length) ?? null;
    }
    return leaf ? [...folders, { id: '', name: leaf }] : folders;
  };
  const renderBreadcrumb = (folderId: string | null, leaf?: string) => <nav className="cms-breadcrumb" aria-label="Navigation path">
    <button className="cms-breadcrumb-root" type="button" onClick={selectNavigationRoot} aria-label="Top level">/</button>
    {breadcrumbItems(folderId, leaf).map((item) => <span key={`${item.id}:${item.name}`}><b>/</b>{item.id ? <button type="button" onClick={() => selectFolder(item.id)}>{item.name}</button> : <strong>{item.name}</strong>}</span>)}
  </nav>;

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
        <div className="cms-navigation-actions"><button className="cms-new-document" type="button" onClick={() => startNewDocument()}>New page</button><button className="cms-new-folder" type="button" onClick={() => openNewFolder()}>New folder</button></div>
        <NavigationTree key={treeItems.map((item) => item.id).join(':')} items={treeItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))} selectedDocumentId={current?.id} selectedFolderId={selectedFolderId} onSelectDocument={selectTreeDocument} onSelectFolder={selectFolder} onChangeChildren={replaceTreeChildren} onTreeChanged={treeChanged} canReorder={!search.trim()} />
      </aside>

      <main className="cms-main">
        {selectedFolder ? <section className="cms-folder-panel" aria-label="Folder settings">{renderBreadcrumb(selectedFolderId)}<header><div><p>Folder</p><h1>{selectedFolder.name}</h1><span>Pages and nested folders inherit this location.</span></div><div className="cms-folder-panel-actions"><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument(selectedFolderId)}>New page</button><button className="cms-button" type="button" onClick={() => openNewFolder(selectedFolderId)}>New folder</button></div></header><div className="cms-folder-fields"><label className="cms-meta-field"><span>Name</span><input value={folderName} onChange={(event) => { setFolderName(event.target.value); setFolderSlug((value) => value || slugify(event.target.value)); }} /></label><label className="cms-meta-field"><span>URL segment</span><input value={folderSlug} onChange={(event) => setFolderSlug(slugify(event.target.value))} /></label></div><footer><button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void saveFolder()}>{isSaving ? 'Saving…' : 'Save folder'}</button><button className="cms-button cms-button-danger" type="button" disabled={isSaving} onClick={() => void deleteFolder()}>Delete folder</button></footer></section> : missingDocumentId ? <section className="cms-empty-state"><span className="cms-empty-icon">文</span><h1>Translation not created</h1><label className="cms-content-locale"><span>Language</span><select value={locale} onChange={(event) => selectMissingDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{item === 'en' ? 'English' : '日本語'}</option>)}</select></label><p>This page has no {locale} translation.{missingTranslationSource ? ` Create a draft by copying the ${missingTranslationSource} version.` : ''}</p>{missingTranslationSource && <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createDocumentTranslation()}>Create {locale} translation</button>}</section> : !current ? <section className="cms-empty-state"><span className="cms-empty-icon">✦</span><h1>Start a document</h1><p>Create a page or folder, then organize it in the navigation tree.</p><div className="cms-empty-actions"><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument()}>New page</button><button className="cms-button" type="button" onClick={() => openNewFolder()}>New folder</button></div></section> : <>
          {renderBreadcrumb(fields.folderId, fields.slug || 'new-document')}
          <section className="cms-editor-surface" aria-label="Document editor">
            <div className="cms-document-fields">
              <label className="cms-meta-field">
                <span>URL segment</span>
                <input className="cms-slug-input" value={fields.slug} onChange={(event) => updateSlug(event.target.value)} onBlur={() => updateField('slug', slugify(fields.slug))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} aria-invalid={Boolean(fields.slug) && !validSlug.test(fields.slug)} placeholder="getting-started" />
                <small className="cms-field-help">Required. Lowercase letters, numbers, and hyphens. English titles suggest a value while this field is empty.</small>
              </label>
              {current.id && <label className="cms-content-locale"><span>Language</span><select value={current.locale} onChange={(event) => selectDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{item === 'en' ? 'English' : '日本語'}</option>)}</select></label>}
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
    {isFolderDialogOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsFolderDialogOpen(false)}><section className="cms-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="new-folder-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h1 id="new-folder-title">New folder</h1><p>{selectedFolder ? `Create inside ${selectedFolder.name}.` : 'Create at the top level.'}</p></div><button type="button" className="cms-close-settings" onClick={() => setIsFolderDialogOpen(false)} aria-label="Close">×</button></header><label className="cms-meta-field"><span>Name</span><input autoFocus value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value, slug: draft.slug || slugify(event.target.value) }))} placeholder="Getting started" /></label><label className="cms-meta-field"><span>URL segment</span><input value={folderDraft.slug} onChange={(event) => setFolderDraft((draft) => ({ ...draft, slug: slugify(event.target.value) }))} placeholder="getting-started" /></label><footer><button className="cms-button" type="button" onClick={() => setIsFolderDialogOpen(false)}>Cancel</button><button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createFolder()}>Create folder</button></footer></section></div>}
  </div>;
}

const root = document.querySelector('#admin-root');
if (!root) throw new Error('Admin root is missing.');
createRoot(root).render(<App />);
