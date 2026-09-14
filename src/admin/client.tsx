import { siteConfig } from '../site.config.ts';
import { assertDocumentContentUrls, documentMediaUrl } from '../documents/content-urls.ts';
import { Node, type JSONContent } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Youtube from '@tiptap/extension-youtube';
import type { Editor, Extensions } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SimpleEditor } from './components/tiptap-templates/simple/simple-editor';
import { NavigationTree, type NavigationItem } from './navigation-tree';
import { listLocalDocumentDrafts, localDocumentKey, readLocalDocumentDraft, removeLocalDocumentDraft, writeLocalDocumentDraft, type LocalDocumentDraft } from './local-drafts';
import { localeLabel, defaultLocale, isSupportedLocale, supportedLocales, type SupportedLocale } from '../locales';
import logoUrl from '../assets/logo.svg';
import './styles/_variables.scss';
import './styles/_keyframe-animations.scss';
import './styles/_cms-theme.scss';
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
type Media = { id: string; fileName: string; contentType: string; url: string; isUsed: boolean };
type Revision = { id: string; revision: number; createdAt: number };
type Folder = { id: string; name: string; slug: string; parentId: string | null; order: number };
type FolderTranslation = Pick<Folder, 'id' | 'name'>;
type PublishDelivery = {
  id: string;
  status: 'pending' | 'accepted' | 'failed' | 'skipped';
  attempts: number;
  buildId: string | null;
  alreadyExists: boolean;
  lastError: string | null;
  requestedAt: number;
  acceptedAt: number | null;
  nextRetryAt: number | null;
};
type PublishDocumentResponse = { document: DocumentRecord; delivery: PublishDelivery };
type PublishChangesResponse = { publishedCount: number; delivery: PublishDelivery | null };
type PublishDeliveryResponse = { delivery: PublishDelivery };
type DocumentFields = Pick<DocumentRecord, 'title' | 'slug' | 'description' | 'folderId' | 'order'>;
type ThemePreference = 'system' | 'light' | 'dark';

const emptyContent: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptyDocument: DocumentRecord = {
  id: '', locale: defaultLocale, title: '', slug: '', description: '', folderId: null, order: 0,
  contentJson: emptyContent, status: 'draft', version: 0,
};
const mediaTypes = 'image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm';
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isAllowedPastedMediaUrl(url: string) {
  try {
    documentMediaUrl(url);
    return true;
  } catch {
    return false;
  }
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>;
}

function ChevronRightIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 1.5M3.1 12a8.9 8.9 0 1 0 2.1-5.8M3.1 4.8v4.1h4.1" /></svg>;
}

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
  Youtube.configure({ nocookie: true, width: 640, height: 360 }),
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

function hasDocumentChanges(document: DocumentRecord, fields: DocumentFields, contentJson: JSONContent) {
  return document.title !== fields.title || document.slug !== fields.slug || document.description !== fields.description ||
    document.folderId !== fields.folderId || document.order !== fields.order || JSON.stringify(document.contentJson) !== JSON.stringify(contentJson);
}

function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [treeItems, setTreeItems] = useState<NavigationItem[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [current, setCurrent] = useState<DocumentRecord | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderSlug, setFolderSlug] = useState('');
  const [folderLocale, setFolderLocale] = useState<SupportedLocale>(defaultLocale);
  const [missingFolderTranslationSource, setMissingFolderTranslationSource] = useState<SupportedLocale | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState({ name: '', slug: '' });
  const [fields, setFields] = useState<DocumentFields>(documentFields(emptyDocument));
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [notice, setNotice] = useState('Loading documents…');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [localSaveState, setLocalSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localDraftConflict, setLocalDraftConflict] = useState<LocalDocumentDraft | null>(null);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    const saved = window.localStorage.getItem('docs-cms-locale');
    return saved && isSupportedLocale(saved) ? saved : defaultLocale;
  });
  const [missingDocumentId, setMissingDocumentId] = useState<string | null>(null);
  const [missingTranslationSource, setMissingTranslationSource] = useState<SupportedLocale | null>(null);
  const [latestDelivery, setLatestDelivery] = useState<PublishDelivery | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const saved = window.localStorage.getItem('docs-cms-theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const pendingLocalDraft = useRef<LocalDocumentDraft | null>(null);
  const localDraftTimer = useRef<number | null>(null);
  const localWrite = useRef(Promise.resolve());
  const selectionVersion = useRef(0);
  const savedDocument = useRef<DocumentRecord | null>(null);
  const fieldsRef = useRef(fields);
  const editVersion = useRef(0);

  const showNotice = useCallback((message: string, error = false) => {
    setNotice(message);
    setNoticeIsError(error);
  }, []);
  const applyFields = (nextFields: DocumentFields) => {
    fieldsRef.current = nextFields;
    setFields(nextFields);
  };
  const setEditingLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    setFolderLocale(nextLocale);
    window.localStorage.setItem('docs-cms-locale', nextLocale);
  };
  const removeQueuedLocalDraft = async (documentId: string, draftLocale: SupportedLocale) => {
    localWrite.current = localWrite.current
      .catch(() => undefined)
      .then(() => removeLocalDocumentDraft(documentId, draftLocale))
      .then(() => undefined);
    await localWrite.current;
  };
  const flushLocalDraft = async () => {
    if (localDraftTimer.current !== null) {
      window.clearTimeout(localDraftTimer.current);
      localDraftTimer.current = null;
    }
    const draft = pendingLocalDraft.current;
    pendingLocalDraft.current = null;
    if (!draft) return true;
    try {
      localWrite.current = localWrite.current.catch(() => undefined).then(() => writeLocalDocumentDraft(draft)).then(() => undefined);
      await localWrite.current;
      if (!pendingLocalDraft.current) setLocalSaveState('saved');
      return true;
    } catch (error) {
      setLocalSaveState('error');
      showNotice(`Local save failed: ${error instanceof Error ? error.message : String(error)}`, true);
      return false;
    }
  };
  const queueLocalDraft = (document: DocumentRecord, nextFields: DocumentFields, nextContent: JSONContent) => {
    const baseline = savedDocument.current ?? document;
    if (!baseline.id) return;
    if (!hasDocumentChanges(baseline, nextFields, nextContent)) {
      pendingLocalDraft.current = null;
      if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
      localDraftTimer.current = null;
      localWrite.current = localWrite.current.catch(() => undefined).then(() => removeLocalDocumentDraft(baseline.id, baseline.locale));
      setLocalSaveState('idle');
      return;
    }
    pendingLocalDraft.current = {
      key: localDocumentKey(baseline.id, baseline.locale), documentId: baseline.id, locale: baseline.locale,
      baseVersion: baseline.version, ...nextFields, contentJson: nextContent, updatedAt: Date.now(),
    };
    setLocalSaveState('saving');
    if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
    localDraftTimer.current = window.setTimeout(() => { void flushLocalDraft(); }, 350);
  };
  const refreshDocuments = useCallback(async () => {
    setDocuments(await api<DocumentRecord[]>('/documents'));
  }, []);
  const refreshMedia = useCallback(async () => {
    const [serverMedia, localDrafts] = await Promise.all([
      api<Media[]>('/media'),
      listLocalDocumentDrafts().catch(() => []),
    ]);
    const localContent = localDrafts.map((draft) => JSON.stringify(draft.contentJson));
    setMedia(serverMedia.map((item) => ({
      ...item,
      isUsed: item.isUsed || localContent.some((content) => content.includes(item.url)),
    })));
  }, []);
  const refreshTree = useCallback(async () => { setTreeItems(await api<NavigationItem[]>('/tree')); }, []);
  const refreshDeliveries = useCallback(async () => {
    const deliveries = await api<PublishDelivery[]>('/publish/deliveries');
    setLatestDelivery(deliveries.find((item) => item.status === 'failed' || (item.status === 'pending' && (!item.nextRetryAt || item.nextRetryAt <= Date.now()))) ?? deliveries[0] ?? null);
  }, []);
  useEffect(() => {
    const refresh = () => { void refreshDeliveries().catch((error) => showNotice(String(error), true)); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refreshDeliveries, showNotice]);

  const selectedFolder = treeItems.find((item) => item.kind === 'folder' && item.id === `folder:${selectedFolderId}`) ?? null;
  const missingDocument = missingDocumentId ? treeItems.find((item) => item.documentId === missingDocumentId) : undefined;
  const activeParentFolderId = selectedFolderId ?? current?.folderId ?? (missingDocument?.parentId ? missingDocument.parentId.slice('folder:'.length) : null);
  const folderParent = treeItems.find((item) => item.kind === 'folder' && item.id === `folder:${folderParentId}`) ?? null;
  const savedChangeCount = treeItems.reduce((count, item) => count + item.translationStates.filter((entry) => entry.state !== 'published').length, 0);
  const currentPublicationState = current
    ? treeItems.find((item) => item.documentId === current.id)?.translationStates.find((entry) => entry.locale === current.locale)?.state
    : undefined;

  useEffect(() => {
    Promise.all([refreshDocuments(), refreshMedia(), refreshTree(), refreshDeliveries()])
      .then(() => showNotice('Ready.'))
      .catch((error: unknown) => showNotice(String(error), true));
  }, [refreshDeliveries, refreshDocuments, refreshMedia, refreshTree, showNotice]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      setSystemPrefersDark(mediaQuery.matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    window.localStorage.setItem('docs-cms-theme', theme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    if (!isSupportedLocale(locale)) setEditingLocale(defaultLocale);
  }, [locale]);

  useEffect(() => () => {
    void flushLocalDraft();
  }, []);

  const displayedTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    if (!current || !editor) return;
    setEditorDocument(editor, current.contentJson);
  }, [current, editor]);

  useEffect(() => {
    if (!isRevisionOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRevisionOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isRevisionOpen]);

  const selectDocument = async (document: DocumentRecord, targetLocale: SupportedLocale = document.locale) => {
    const selection = ++selectionVersion.current;
    if (!await flushLocalDraft()) return;
    if (!document.id) {
      savedDocument.current = null;
      setCurrent(document);
      setMissingDocumentId(null);
      setMissingTranslationSource(null);
      setSelectedFolderId(null);
      applyFields(documentFields(document));
      setRevisions([]);
      setIsRevisionOpen(false);
      setIsDirty(false);
      setLocalSaveState('idle');
      setLocalDraftConflict(null);
      showNotice('New page. Save draft to keep it.');
      return;
    }
    try {
      const loaded = await api<DocumentRecord>(`/documents/${encodeURIComponent(document.id)}`, {}, targetLocale);
      let localDraft: LocalDocumentDraft | undefined;
      try {
        localDraft = await readLocalDocumentDraft(loaded.id, loaded.locale);
      } catch (error) {
        setLocalSaveState('error');
        showNotice(`Browser storage is unavailable: ${error instanceof Error ? error.message : String(error)}`, true);
      }
      if (selection !== selectionVersion.current) return;
      savedDocument.current = loaded;
      const canRestore = localDraft?.baseVersion === loaded.version;
      const displayed = canRestore && localDraft ? {
        ...loaded, title: localDraft.title, slug: localDraft.slug, description: localDraft.description,
        folderId: localDraft.folderId, order: localDraft.order, contentJson: localDraft.contentJson,
      } : loaded;
      setCurrent(displayed);
      setMissingDocumentId(null);
      setMissingTranslationSource(null);
      setSelectedFolderId(null);
      applyFields(documentFields(displayed));
      setRevisions([]);
      setIsRevisionOpen(false);
      setLocalDraftConflict(localDraft && !canRestore ? localDraft : null);
      setIsDirty(Boolean(canRestore));
      setLocalSaveState(canRestore ? 'saved' : 'idle');
      showNotice(canRestore ? 'Local changes restored.' : `${loaded.status === 'published' ? 'Published' : 'Draft'} · revision ${loaded.version}`);
    } catch (error) {
      showNotice(String(error), true);
    }
  };

  const selectFolder = async (folderId: string) => {
    const selection = ++selectionVersion.current;
    if (!await flushLocalDraft()) return;
    const folder = treeItems.find((item) => item.id === `folder:${folderId}`);
    if (!folder) return;
    setEditor(null);
    setCurrent(null);
    savedDocument.current = null;
    setMissingFolderTranslationSource(null);
    setMissingDocumentId(null);
    setMissingTranslationSource(null);
    setSelectedFolderId(folderId);
    setFolderName(folder.name);
    setFolderSlug(folder.slug);
    setIsDirty(false);
    setLocalSaveState('idle');
    setLocalDraftConflict(null);
    setFolderLocale(locale);
    if (!folder.translationLocales.includes(locale)) {
      const source = folder.translationLocales.includes(defaultLocale) ? defaultLocale : folder.translationLocales[0] as SupportedLocale | undefined;
      setMissingFolderTranslationSource(source ?? null);
    } else if (locale !== defaultLocale) {
      try {
        const localizedTree = await api<NavigationItem[]>('/tree', {}, locale);
        if (selection !== selectionVersion.current) return;
        const localizedFolder = localizedTree.find((item) => item.id === `folder:${folderId}`);
        if (localizedFolder) setFolderName(localizedFolder.name);
      } catch (error) {
        showNotice(String(error), true);
      }
    }
    showNotice('Folder selected.');
  };
  const selectNavigationRoot = async () => {
    selectionVersion.current += 1;
    if (!await flushLocalDraft()) return;
    setEditor(null); setCurrent(null); setSelectedFolderId(null); setMissingDocumentId(null); setMissingTranslationSource(null); setMissingFolderTranslationSource(null);
    savedDocument.current = null;
    setIsDirty(false); setLocalSaveState('idle'); setLocalDraftConflict(null); showNotice('');
  };

  const selectTreeDocument = async (id: string) => {
    const treeItem = treeItems.find((item) => item.documentId === id);
    if (treeItem?.translationLocales.includes(locale)) { void selectDocument({ ...emptyDocument, id, locale }, locale); return; }
    selectionVersion.current += 1;
    if (!await flushLocalDraft()) return;
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    setEditor(null); setCurrent(null); setSelectedFolderId(null); setMissingDocumentId(id); setMissingTranslationSource(null); setIsDirty(false);
    savedDocument.current = null;
    setMissingTranslationSource(source ?? null);
    showNotice(`No ${locale} translation yet.`);
  };
  const selectDocumentLocale = async (targetLocale: SupportedLocale) => {
    if (!current?.id) return;
    const selection = selectionVersion.current;
    if (!await flushLocalDraft()) return;
    if (selection !== selectionVersion.current) return;
    const treeItem = treeItems.find((item) => item.documentId === current.id);
    if (treeItem?.translationLocales.includes(targetLocale)) {
      setEditingLocale(targetLocale);
      void selectDocument({ ...current, locale: targetLocale }, targetLocale);
      return;
    }
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    selectionVersion.current += 1;
    setEditor(null); setCurrent(null); setSelectedFolderId(null); savedDocument.current = null; setEditingLocale(targetLocale);
    setMissingDocumentId(current.id); setMissingTranslationSource(source ?? null); setIsDirty(false);
    showNotice(`No ${targetLocale} translation yet.`);
  };
  const selectMissingDocumentLocale = (targetLocale: SupportedLocale) => {
    if (!missingDocumentId) return;
    const treeItem = treeItems.find((item) => item.documentId === missingDocumentId);
    if (treeItem?.translationLocales.includes(targetLocale)) {
      setEditingLocale(targetLocale);
      void selectDocument({ ...emptyDocument, id: missingDocumentId, locale: targetLocale }, targetLocale);
      return;
    }
    const source = treeItem?.translationLocales.includes(defaultLocale) ? defaultLocale : treeItem?.translationLocales[0] as SupportedLocale | undefined;
    setEditingLocale(targetLocale);
    selectionVersion.current += 1;
    setMissingTranslationSource(source ?? null);
    showNotice(`No ${targetLocale} translation yet.`);
  };
  const createDocumentTranslation = async () => {
    if (!missingDocumentId) return;
    setIsSaving(true);
    try {
      if (!missingTranslationSource) throw new Error('No source translation is available.');
      const created = await api<DocumentRecord>(`/documents/${encodeURIComponent(missingDocumentId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale: missingTranslationSource }) }, locale);
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      await selectDocument(created);
      showNotice(`${locale} translation created from ${missingTranslationSource}.`);
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const nextOrder = useCallback((parentId: string | null) => Math.max(-1, ...treeItems.filter((item) => item.parentId === (parentId ? `folder:${parentId}` : null)).map((item) => item.order)) + 1, [treeItems]);
  const startNewDocument = useCallback((folderId = activeParentFolderId) => {
    void selectDocument({ ...emptyDocument, folderId, order: nextOrder(folderId) });
  }, [activeParentFolderId, nextOrder]);
  const openNewFolder = useCallback((parentId = activeParentFolderId) => {
    setFolderParentId(parentId);
    setFolderDraft({ name: '', slug: '' });
    setIsFolderDialogOpen(true);
  }, [activeParentFolderId]);
  const createFolder = async () => {
    const name = folderDraft.name.trim();
    const slug = folderDraft.slug || slugify(name);
    if (!name || !slug) return showNotice('Folder name is required.', true);
    if (!validSlug.test(slug)) return showNotice('URL segment must use lowercase letters, numbers, and single hyphens.', true);
    setIsSaving(true);
    try {
      const created = await api<Folder>('/folders', { method: 'POST', body: JSON.stringify({ name, slug, parentId: folderParentId, order: nextOrder(folderParentId) }) });
      await refreshTree();
      setIsFolderDialogOpen(false);
      setFolderParentId(null);
      setCurrent(null);
      setSelectedFolderId(created.id);
      setFolderName(created.name);
      setFolderSlug(created.slug);
      setFolderLocale(defaultLocale);
      setMissingFolderTranslationSource(null);
      showNotice('Folder created.');
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const saveFolder = async () => {
    if (!selectedFolder) return;
    const name = folderName.trim(); const slug = folderSlug || slugify(name);
    if (!name || !slug) return showNotice('Folder name is required.', true);
    if (!validSlug.test(slug)) return showNotice('URL segment must use lowercase letters, numbers, and single hyphens.', true);
    setIsSaving(true);
    try {
      await api<Folder>(`/folders/${encodeURIComponent(selectedFolderId!)}`, { method: 'PUT', body: JSON.stringify({ name, slug, parentId: selectedFolder.parentId ? selectedFolder.parentId.slice('folder:'.length) : null, order: selectedFolder.order }) }, folderLocale);
      await refreshTree(); showNotice('Folder saved.');
    } catch (error) { showNotice(String(error), true); } finally { setIsSaving(false); }
  };
  const selectFolderLocale = async (targetLocale: SupportedLocale) => {
    if (!selectedFolder || !selectedFolderId) return;
    setEditingLocale(targetLocale);
    if (targetLocale === defaultLocale) {
      setFolderLocale(targetLocale);
      setFolderName(selectedFolder.name);
      setFolderSlug(selectedFolder.slug);
      setMissingFolderTranslationSource(null);
      return;
    }
    if (!selectedFolder.translationLocales.includes(targetLocale)) {
      const source = selectedFolder.translationLocales.find((value): value is SupportedLocale => isSupportedLocale(value));
      setFolderLocale(targetLocale);
      setFolderName('');
      setFolderSlug(selectedFolder.slug);
      setMissingFolderTranslationSource(selectedFolder.translationLocales.includes(defaultLocale) ? defaultLocale : source ?? null);
      return;
    }
    try {
      const translatedTree = await api<NavigationItem[]>('/tree', {}, targetLocale);
      const translatedFolder = translatedTree.find((item) => item.id === `folder:${selectedFolderId}`);
      if (!translatedFolder) throw new Error('Folder translation was not found.');
      setFolderLocale(targetLocale);
      setFolderName(translatedFolder.name);
      setFolderSlug(translatedFolder.slug);
      setMissingFolderTranslationSource(null);
    } catch (error) { showNotice(String(error), true); }
  };
  const createFolderTranslation = async () => {
    if (!selectedFolderId || !missingFolderTranslationSource) return;
    setIsSaving(true);
    try {
      const created = await api<FolderTranslation>(`/folders/${encodeURIComponent(selectedFolderId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale: missingFolderTranslationSource }) }, folderLocale);
      await refreshTree();
      setFolderName(created.name);
      setMissingFolderTranslationSource(null);
      showNotice(`${folderLocale} folder translation created from ${missingFolderTranslationSource}.`);
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
    await Promise.all([refreshTree(), refreshDocuments(), refreshDeliveries()]);
    showNotice('Navigation updated.');
  };

  const updateField = (field: keyof DocumentFields, value: string | number | null) => {
    editVersion.current += 1;
    setFields((currentFields) => {
      const nextFields = { ...currentFields, [field]: value };
      const contentJson = editor?.getJSON() ?? current?.contentJson ?? emptyContent;
      const baseline = savedDocument.current;
      const changed = baseline ? hasDocumentChanges(baseline, nextFields, contentJson) : true;
      fieldsRef.current = nextFields;
      setIsDirty(changed);
      if (baseline) queueLocalDraft(baseline, nextFields, contentJson);
      return nextFields;
    });
  };
  const updateTitle = (title: string) => {
    editVersion.current += 1;
    const suggestedSlug = slugify(title);
    setFields((currentFields) => {
      const nextFields = {
        ...currentFields,
        title,
        // A title only suggests the initial URL segment. It never overwrites a
        // value chosen by the editor, and non-Latin titles leave it blank.
        slug: current?.id || currentFields.slug || !suggestedSlug ? currentFields.slug : suggestedSlug,
      };
      const contentJson = editor?.getJSON() ?? current?.contentJson ?? emptyContent;
      const baseline = savedDocument.current;
      const changed = baseline ? hasDocumentChanges(baseline, nextFields, contentJson) : true;
      fieldsRef.current = nextFields;
      setIsDirty(changed);
      if (baseline) queueLocalDraft(baseline, nextFields, contentJson);
      return nextFields;
    });
  };
  const updateSlug = (slug: string) => {
    updateField('slug', normalizeSlugInput(slug));
  };

  const save = async (): Promise<DocumentRecord | undefined> => {
    if (!editor || !current) return undefined;
    if (!validSlug.test(fieldsRef.current.slug)) {
      showNotice('URL segment must use lowercase letters, numbers, and single hyphens.', true);
      return undefined;
    }
    try {
      assertDocumentContentUrls(editor.getJSON());
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Invalid document URL', true);
      return undefined;
    }
    setIsSaving(true);
    try {
      const saveSelection = selectionVersion.current;
      await flushLocalDraft();
      if (selectionVersion.current !== saveSelection) return undefined;
      const saveVersion = editVersion.current;
      const body = { ...fieldsRef.current, contentJson: editor.getJSON(), version: current.version };
      const saved = current.id
        ? await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify(body) }, current.locale)
        : await api<DocumentRecord>('/documents', { method: 'POST', body: JSON.stringify(body) });
      if (selectionVersion.current !== saveSelection) {
        await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
        return saved;
      }
      savedDocument.current = saved;
      setLocalDraftConflict(null);
      if (editVersion.current === saveVersion) {
        setCurrent(saved);
        applyFields(documentFields(saved));
        setIsDirty(false);
        pendingLocalDraft.current = null;
        if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
        localDraftTimer.current = null;
        await removeQueuedLocalDraft(saved.id, saved.locale);
        setLocalSaveState('idle');
      } else {
        const latestFields = fieldsRef.current;
        const latestContent = editor.getJSON();
        const displayed = { ...saved, ...latestFields, contentJson: latestContent };
        const changed = hasDocumentChanges(saved, latestFields, latestContent);
        setCurrent(displayed);
        applyFields(latestFields);
        setIsDirty(changed);
        if (changed) queueLocalDraft(saved, latestFields, latestContent);
      }
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      showNotice(editVersion.current === saveVersion ? 'Draft saved.' : 'Draft saved. Newer local changes are still kept in this browser.');
      return saved;
    } catch (error) {
      showNotice(String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const discardLocalChanges = async () => {
    const baseline = savedDocument.current;
    if (!baseline) return;
    pendingLocalDraft.current = null;
    if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
    localDraftTimer.current = null;
    await removeQueuedLocalDraft(baseline.id, baseline.locale);
    setCurrent(baseline);
    applyFields(documentFields(baseline));
    setEditorDocument(editor, baseline.contentJson);
    setIsDirty(false);
    setLocalDraftConflict(null);
    setLocalSaveState('idle');
    showNotice('Local changes discarded.');
  };

  const restoreConflictingLocalChanges = () => {
    const baseline = savedDocument.current;
    if (!baseline || !localDraftConflict) return;
    const restored = {
      ...baseline,
      title: localDraftConflict.title,
      slug: localDraftConflict.slug,
      description: localDraftConflict.description,
      folderId: localDraftConflict.folderId,
      order: localDraftConflict.order,
      contentJson: localDraftConflict.contentJson,
    };
    setCurrent(restored);
    applyFields(documentFields(restored));
    setEditorDocument(editor, restored.contentJson);
    setIsDirty(true);
    setLocalDraftConflict(null);
    queueLocalDraft(baseline, documentFields(restored), restored.contentJson);
    showNotice('Local changes restored. Save draft to keep them in the CMS.');
  };

  const preview = () => {
    if (!current?.id) return;
    if (isDirty) {
      showNotice('Save the draft before opening preview.', true);
      return;
    }
    window.open(`/admin/preview/${encodeURIComponent(current.id)}?locale=${encodeURIComponent(current.locale)}`, '_blank', 'noopener');
  };

  const describeDelivery = (delivery: PublishDelivery) => {
    if (delivery.status === 'accepted') return delivery.alreadyExists ? 'Build already requested.' : 'Build requested.';
    if (delivery.status === 'skipped') return delivery.lastError === 'Local development rebuild is active' ? 'Published. Local docs rebuild automatically.' : 'Published, but Deploy Hook is not configured.';
    if (delivery.status === 'failed') return 'Published, but the build request failed. Retry it from the header.';
    return 'Build request is pending.';
  };

  const publish = async () => {
    if (!current?.id) return showNotice('Save the document before publishing.', true);
    const publishSelection = selectionVersion.current;
    let documentToPublish = current;
    if (isDirty) {
      const saved = await save();
      if (!saved) return;
      if (selectionVersion.current !== publishSelection) return;
      documentToPublish = saved;
      const latestContent = editor?.getJSON() ?? emptyContent;
      if (hasDocumentChanges(saved, fieldsRef.current, latestContent)) {
        showNotice('Newer local changes are still open. Save draft again before publishing.', true);
        return;
      }
    }
    const publishEditVersion = editVersion.current;
    setIsSaving(true);
    try {
      const result = await api<PublishDocumentResponse>(`/documents/${encodeURIComponent(documentToPublish.id)}/publish`, {
        method: 'POST', body: JSON.stringify({ version: documentToPublish.version }),
      }, documentToPublish.locale);
      if (selectionVersion.current !== publishSelection) {
        await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
        return;
      }
      savedDocument.current = result.document;
      if (editVersion.current === publishEditVersion) {
        setCurrent(result.document);
        applyFields(documentFields(result.document));
        setIsDirty(false);
        pendingLocalDraft.current = null;
        await removeQueuedLocalDraft(result.document.id, result.document.locale);
        setLocalSaveState('idle');
      } else {
        const latestFields = fieldsRef.current;
        const latestContent = editor?.getJSON() ?? emptyContent;
        const displayed = { ...result.document, ...latestFields, contentJson: latestContent };
        const changed = hasDocumentChanges(result.document, latestFields, latestContent);
        setCurrent(displayed);
        applyFields(latestFields);
        setIsDirty(changed);
        if (changed) queueLocalDraft(result.document, latestFields, latestContent);
      }
      setLatestDelivery(result.delivery);
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      showNotice(describeDelivery(result.delivery), result.delivery.status === 'failed');
    } catch (error) {
      showNotice(String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const publishChanges = async () => {
    if (isDirty) return showNotice('Save the current draft before publishing changes.', true);
    if (savedChangeCount === 0) return showNotice('There are no saved changes to publish.');
    const noun = savedChangeCount === 1 ? 'translation' : 'translations';
    if (!window.confirm(`Publish ${savedChangeCount} saved ${noun}? The public documentation site will be rebuilt once.`)) return;
    setIsSaving(true);
    try {
      const result = await api<PublishChangesResponse>('/publish/changes', { method: 'POST' });
      if (!result.delivery) return showNotice('There are no saved changes to publish.');
      setLatestDelivery(result.delivery);
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      showNotice(`Published ${result.publishedCount} ${result.publishedCount === 1 ? 'translation' : 'translations'}. ${describeDelivery(result.delivery)}`, result.delivery.status === 'failed');
    } catch (error) {
      showNotice(String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const retryBuild = async () => {
    if (!latestDelivery || (latestDelivery.status !== 'failed' && latestDelivery.status !== 'pending')) return;
    setIsSaving(true);
    try {
      const result = await api<PublishDeliveryResponse>(`/publish/deliveries/${encodeURIComponent(latestDelivery.id)}/retry`, { method: 'POST' });
      setLatestDelivery(result.delivery);
      showNotice(describeDelivery(result.delivery), result.delivery.status === 'failed');
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

  const toggleRevisionHistory = async () => {
    if (isRevisionOpen) {
      setIsRevisionOpen(false);
      return;
    }
    await loadRevisions();
  };

  const restore = async (revision: Revision) => {
    if (!current?.id) return;
    try {
      const restored = await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}/revisions/${encodeURIComponent(revision.id)}/restore`, {
        method: 'POST', body: JSON.stringify({ version: current.version }),
      }, current.locale);
      setCurrent(restored);
      savedDocument.current = restored;
      applyFields(documentFields(restored));
      setEditorDocument(editor, restored.contentJson);
      setIsDirty(false);
      pendingLocalDraft.current = null;
      await removeQueuedLocalDraft(restored.id, restored.locale);
      setLocalSaveState('idle');
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
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
      savedDocument.current = null;
      applyFields(documentFields(emptyDocument));
      setRevisions([]);
      setEditorDocument(editor, emptyContent);
      setIsDirty(false);
      pendingLocalDraft.current = null;
      await removeQueuedLocalDraft(current.id, current.locale);
      setLocalSaveState('idle');
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
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

  const removeMedia = async (item: Media) => {
    if (item.isUsed || !window.confirm(`Delete ${item.fileName}? This cannot be undone.`)) return;
    try {
      const localDrafts = await listLocalDocumentDrafts().catch(() => []);
      if (localDrafts.some((draft) => JSON.stringify(draft.contentJson).includes(item.url))) {
        showNotice('This media is used by local changes in this browser. Save or discard those changes before deleting it.', true);
        await refreshMedia();
        return;
      }
      setIsSaving(true);
      await api<void>(`/media/${item.id}`, { method: 'DELETE' });
      await refreshMedia();
      showNotice('Media deleted.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
    } finally {
      setIsSaving(false);
    }
  };

  const insertMedia = (item: Media) => {
    if (!editor) return;
    if (item.contentType.startsWith('image/')) {
      editor.chain().focus().setImage({ src: item.url, alt: item.fileName }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'video', attrs: { src: item.url, mediaId: item.id } }).run();
    }
    setIsMediaPickerOpen(false);
    showNotice(`${item.fileName} inserted.`);
  };

  const openYoutubeDialog = () => {
    if (!editor) return;
    setYoutubeUrl('');
    setIsYoutubeDialogOpen(true);
  };

  const insertYoutube = () => {
    if (!editor) return;
    const inserted = editor.chain().focus().setYoutubeVideo({ src: youtubeUrl.trim(), width: 640, height: 360 }).run();
    if (!inserted) {
      showNotice('Enter a valid YouTube URL.', true);
      return;
    }
    setIsYoutubeDialogOpen(false);
    showNotice('YouTube video inserted.');
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
  const renderBreadcrumb = (folderId: string | null, leaf?: string) => {
    const items = breadcrumbItems(folderId, leaf);
    return <nav className="cms-breadcrumb" aria-label="Document hierarchy">
      <button className="cms-breadcrumb-root" type="button" onClick={selectNavigationRoot}>Documents</button>
      {items.map((item) => <span className="cms-breadcrumb-item" key={`${item.id}:${item.name}`}><ChevronRightIcon />{item.id ? <button type="button" onClick={() => selectFolder(item.id)}>{item.name}</button> : <strong>{item.name}</strong>}</span>)}
    </nav>;
  };
  const renderFolderPanel = () => {
    if (!selectedFolder) return null;
    const translationMissing = Boolean(missingFolderTranslationSource);
    return <section className="cms-folder-panel" aria-label="Folder settings">
      {renderBreadcrumb(selectedFolderId)}
      <header>
        <div><p>Folder</p><h1>{folderName || selectedFolder.name}</h1><span>Pages and nested folders inherit this location.</span></div>
      </header>
      <section className="cms-document-actions" aria-label="Folder actions">
        <div className="cms-document-state"><span className="cms-status cms-status-folder">Folder</span><span>{translationMissing ? 'Translation needs to be created.' : 'Navigation changes publish with the next rebuild.'}</span></div>
        {translationMissing ? <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createFolderTranslation()}>Create {folderLocale} translation</button> : <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void saveFolder()}>{isSaving ? 'Saving…' : 'Save folder'}</button>}
      </section>
      <div className="cms-folder-fields">
        <label className="cms-meta-field"><span>URL segment</span><input value={folderSlug} disabled={folderLocale !== defaultLocale} onChange={(event) => setFolderSlug(normalizeSlugInput(event.target.value))} onBlur={() => setFolderSlug((value) => slugify(value))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} /><small className="cms-field-help">Shared across all languages.</small></label>
      </div>
      <label className="cms-content-locale"><span>Language</span><select value={folderLocale} onChange={(event) => void selectFolderLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label>
      {translationMissing ? <section className="cms-folder-translation-empty">
        <h2>Translation not created</h2>
        <p>This folder has no {folderLocale} translation. Create one by copying the {missingFolderTranslationSource} name.</p>
      </section> : <div className="cms-folder-fields">
        <label className="cms-meta-field"><span>Name</span><input value={folderName} onChange={(event) => { setFolderName(event.target.value); if (folderLocale === defaultLocale) setFolderSlug((value) => value || slugify(event.target.value)); }} /></label>
      </div>}
      <section className="cms-folder-children-actions" aria-label="Add to folder"><div><h2>Add to folder</h2><p>Create a page or nested folder at this location.</p></div><div><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument(selectedFolderId)}>New page</button><button className="cms-button" type="button" onClick={() => openNewFolder(selectedFolderId)}>New folder</button></div></section>
      <section className="cms-danger-zone" aria-label="Danger zone"><div><h2>Delete folder</h2><p>Move or delete its contents before removing this folder.</p></div><button className="cms-button cms-button-danger cms-button-danger-quiet" type="button" disabled={isSaving} onClick={() => void deleteFolder()}>Delete folder</button></section>
    </section>;
  };

  return <div className="cms-shell">
    <header className="cms-topbar">
      <a className="cms-brand" href="/admin/" aria-label={`${siteConfig.title} home`}><img className="cms-brand-logo" src={logoUrl} alt="" /></a>
      <div className="cms-topbar-controls">
        <div className="cms-actions">
        <span className={`cms-notice ${noticeIsError ? 'is-error' : ''}`} role="status">{notice}</span>
        {(latestDelivery?.status === 'failed' || (latestDelivery?.status === 'pending' && (!latestDelivery.nextRetryAt || latestDelivery.nextRetryAt <= Date.now()))) && <button className="cms-button" type="button" disabled={isSaving} onClick={() => void retryBuild()}>Retry build</button>}
        <button className="cms-button cms-button-primary" type="button" disabled={isSaving || savedChangeCount === 0} onClick={() => void publishChanges()}>Publish changes{savedChangeCount > 0 ? ` (${savedChangeCount})` : ''}</button>
        </div>
        <button className="cms-theme-trigger" type="button" onClick={() => setTheme(displayedTheme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${displayedTheme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${displayedTheme === 'dark' ? 'light' : 'dark'} mode`}>
          {displayedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>

    <div className="cms-workspace">
      <aside className="cms-sidebar">
        <div className="cms-sidebar-heading"><span>Documents</span><span className="cms-count">{documents.length}</span></div>
        <label className="cms-search"><span className="sr-only">Search documents</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" /></label>
        <div className="cms-navigation-actions"><button className="cms-new-document" type="button" onClick={() => startNewDocument()}>New page</button><button className="cms-new-folder" type="button" onClick={() => openNewFolder()}>New folder</button></div>
        <NavigationTree key={treeItems.map((item) => item.id).join(':')} items={treeItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))} selectedDocumentId={current?.id || missingDocumentId || undefined} selectedFolderId={selectedFolderId} temporaryDocument={current && !current.id ? { name: fields.title.trim() || 'Untitled page', parentId: current.folderId ? `folder:${current.folderId}` : null } : undefined} onSelectDocument={selectTreeDocument} onSelectFolder={selectFolder} onChangeChildren={replaceTreeChildren} onTreeChanged={treeChanged} canReorder={!search.trim()} />
      </aside>

      <main className="cms-main">
        {selectedFolder ? renderFolderPanel() : missingDocumentId ? <section className="cms-empty-state"><span className="cms-empty-icon">文</span><h1>Translation not created</h1><label className="cms-content-locale"><span>Language</span><select value={locale} onChange={(event) => selectMissingDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label><p>This page has no {locale} translation.{missingTranslationSource ? ` Create a draft by copying the ${missingTranslationSource} version.` : ''}</p>{missingTranslationSource && <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createDocumentTranslation()}>Create {locale} translation</button>}</section> : !current ? <section className="cms-empty-state"><span className="cms-empty-icon">✦</span><h1>Start a document</h1><p>Create a page or folder, then organize it in the navigation tree.</p><div className="cms-empty-actions"><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument()}>New page</button><button className="cms-button" type="button" onClick={() => openNewFolder()}>New folder</button></div></section> : <>
          {renderBreadcrumb(fields.folderId, fields.title || fields.slug || 'Untitled document')}
          <section className="cms-document-actions" aria-label="Document actions">
            <div className="cms-document-state">
              <span className={`cms-status cms-status-${!current.id || isDirty ? 'draft' : current.status}`}>{!current.id ? 'New page' : isDirty ? 'Local changes' : current.status}</span>
              <span>{!current.id ? 'Save draft to create this page.' : isDirty ? localSaveState === 'saving' ? 'Saving locally…' : localSaveState === 'error' ? 'Local save failed.' : 'Saved locally.' : 'Saved draft.'}</span>
            </div>
            <div className="cms-document-action-buttons">
              {current.id && <button className="cms-button" type="button" disabled={isSaving} onClick={preview}>Preview draft</button>}
              <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void save()}>{isSaving ? 'Saving…' : 'Save draft'}</button>
              {isDirty && current.id && <button className="cms-button cms-button-quiet" type="button" disabled={isSaving} onClick={() => void discardLocalChanges()}>Discard local changes</button>}
              {current.id && <span className="cms-action-divider" aria-hidden="true" />}
              {current.id && currentPublicationState !== 'published' && <button className="cms-button" type="button" disabled={isSaving} onClick={() => void publish()}>Publish page</button>}
              {current.id && <button className={`cms-history-button ${isRevisionOpen ? 'is-active' : ''}`} type="button" onClick={() => void toggleRevisionHistory()} aria-expanded={isRevisionOpen}><HistoryIcon />History</button>}
            </div>
          </section>
          {localDraftConflict && <section className="cms-local-draft-conflict" aria-label="Local draft conflict"><div><strong>A newer saved draft exists.</strong><p>Your browser has local changes from an older saved draft.</p></div><div><button className="cms-button" type="button" onClick={() => void discardLocalChanges()}>Keep saved draft</button><button className="cms-button cms-button-primary" type="button" onClick={restoreConflictingLocalChanges}>Restore local changes</button></div></section>}
          <section className="cms-editor-surface" aria-label="Document editor">
            <div className="cms-document-fields">
              <label className="cms-meta-field">
                <span>URL segment</span>
                <input className="cms-slug-input" value={fields.slug} onChange={(event) => updateSlug(event.target.value)} onBlur={() => updateField('slug', slugify(fields.slug))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} aria-invalid={Boolean(fields.slug) && !validSlug.test(fields.slug)} placeholder="getting-started" />
                <small className="cms-field-help">Required. Lowercase letters, numbers, and hyphens. English titles suggest a value while this field is empty.</small>
              </label>
              {current.id && <label className="cms-content-locale"><span>Language</span><select value={current.locale} onChange={(event) => void selectDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label>}
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
              <header className="cms-editor-field-header"><span>Content</span></header>
              <div className="cms-simple-editor"><SimpleEditor content={emptyContent} extensions={documentExtensions} onEditorReady={setEditor} onUpdate={(updatedEditor) => {
                const contentJson = updatedEditor.getJSON();
                const baseline = savedDocument.current;
                if (!baseline) {
                  setIsDirty(true);
                  return;
                }
                const changed = hasDocumentChanges(baseline, fields, contentJson);
                if (changed) editVersion.current += 1;
                setIsDirty(changed);
                queueLocalDraft(baseline, fields, contentJson);
              }} isAllowedMediaUrl={isAllowedPastedMediaUrl} onRejectedPastedMedia={(count) => showNotice(`${count} pasted ${count === 1 ? 'image or video was' : 'images or videos were'} skipped because the URL is local or insecure. Upload media to include it.`)} onEmbedYoutube={openYoutubeDialog} uploadImage={async (file) => {
                const uploaded = await upload(file);
                if (!uploaded) throw new Error('Image upload failed');
                return uploaded.url;
              }} /></div>
            </section>
            {current.id && <section className="cms-danger-zone" aria-label="Danger zone"><div><h2>Delete page</h2><p>Permanently remove this page and its translations.</p></div><button className="cms-button cms-button-danger cms-button-danger-quiet" type="button" disabled={isSaving} onClick={() => void remove()}>Delete page</button></section>}
          </section>
        </>}
      </main>
    </div>

    {isRevisionOpen && <div className="cms-revision-backdrop" role="presentation" onMouseDown={() => setIsRevisionOpen(false)}><aside className="cms-revision-drawer" role="dialog" aria-modal="true" aria-labelledby="revision-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h2 id="revision-history-title">Revision history</h2><p>Restore adds the selected revision as a new draft.</p></div><button type="button" className="cms-close-settings" onClick={() => setIsRevisionOpen(false)} aria-label="Close revision history">×</button></header>{revisions.length === 0 ? <p className="cms-revisions-empty">No saved revisions yet.</p> : <div className="cms-revisions">{revisions.map((revision) => <div className="cms-revision" key={revision.id}><span><strong>Revision {revision.revision}</strong><time>{new Date(revision.createdAt).toLocaleString()}</time></span><button type="button" onClick={() => void restore(revision)}>Restore</button></div>)}</div>}</aside></div>}

    {isMediaPickerOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsMediaPickerOpen(false)}>
      <section className="cms-media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-library-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h1 id="media-library-title">Media library</h1><p>Select an image or video to add it at the cursor.</p></div><button type="button" className="cms-close-settings" onClick={() => setIsMediaPickerOpen(false)} aria-label="Close media library">×</button></header>
        <div className="cms-media-dialog-actions"><label className="cms-upload">Upload media<input type="file" accept={mediaTypes} onChange={(event) => void upload(event.currentTarget.files?.[0])} /></label></div>
        <div className="cms-media-grid">{media.length === 0 ? <p className="cms-media-empty">No media uploaded yet.</p> : media.map((item) => <article key={item.id} className="cms-media-card"><button type="button" className="cms-media-insert" onClick={() => insertMedia(item)}><span className="cms-media-preview">{item.contentType.startsWith('image/') ? <img src={item.url} alt="" /> : <video src={item.url} muted preload="metadata" />}</span><strong>{item.fileName}</strong><span>{item.contentType.startsWith('image/') ? 'Image' : 'Video'}</span></button><footer><span className={item.isUsed ? 'cms-media-usage cms-media-usage-used' : 'cms-media-usage'}>{item.isUsed ? 'Used' : 'Unused'}</span>{!item.isUsed && <button type="button" className="cms-media-delete" disabled={isSaving} onClick={() => void removeMedia(item)}>Delete</button>}</footer></article>)}</div>
      </section>
    </div>}
    {isYoutubeDialogOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsYoutubeDialogOpen(false)}>
      <section className="cms-youtube-dialog" role="dialog" aria-modal="true" aria-labelledby="youtube-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h1 id="youtube-dialog-title">Embed YouTube video</h1><p>Paste a YouTube or youtu.be URL.</p></div><button className="cms-close-settings" type="button" onClick={() => setIsYoutubeDialogOpen(false)} aria-label="Close">×</button></header>
        <label className="cms-meta-field"><span>YouTube URL</span><input autoFocus type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') insertYoutube(); }} placeholder="https://www.youtube.com/watch?v=…" /></label>
        <footer><button className="cms-button" type="button" onClick={() => setIsYoutubeDialogOpen(false)}>Cancel</button><button className="cms-button cms-button-primary" type="button" onClick={insertYoutube}>Embed video</button></footer>
      </section>
    </div>}
    {isFolderDialogOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsFolderDialogOpen(false)}><section className="cms-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="new-folder-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h1 id="new-folder-title">New folder</h1><p>{folderParent ? `Create inside ${folderParent.name}.` : 'Create at the top level.'}</p></div><button type="button" className="cms-close-settings" onClick={() => setIsFolderDialogOpen(false)} aria-label="Close">×</button></header><label className="cms-meta-field"><span>Name</span><input autoFocus value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value, slug: draft.slug || slugify(event.target.value) }))} placeholder="Getting started" /></label><label className="cms-meta-field"><span>URL segment</span><input value={folderDraft.slug} onChange={(event) => setFolderDraft((draft) => ({ ...draft, slug: normalizeSlugInput(event.target.value) }))} onBlur={() => setFolderDraft((draft) => ({ ...draft, slug: slugify(draft.slug) }))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} placeholder="getting-started" /></label><footer><button className="cms-button" type="button" onClick={() => setIsFolderDialogOpen(false)}>Cancel</button><button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createFolder()}>Create folder</button></footer></section></div>}
  </div>;
}

const root = document.querySelector('#admin-root');
if (!root) throw new Error('Admin root is missing.');
createRoot(root).render(<App />);
