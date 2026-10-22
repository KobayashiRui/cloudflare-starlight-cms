import { resolveContentMedia } from '../media/urls.ts';
import { liveQuery } from 'dexie';
import { adminConfig } from '../admin.config';
import { message, type AdminMessage, isAdminLanguage } from './i18n/language';
import { AdminLanguageProvider, useAdminI18n } from './i18n';
import { siteConfig } from '../site.config.ts';
import { assertDocumentContentUrls, documentMediaUrl, hasPendingImageUpload } from '../documents/content-urls.ts';
import { Node, type JSONContent } from '@tiptap/core';
import { tableExtensions } from './table-extensions';
import Youtube from '@tiptap/extension-youtube';
import type { Editor, Extensions } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { documentEditTransaction, documentTextBlocks, loadDocumentState, registerAdminTools, type AdminToolActions, type EditorTarget } from './webmcp';
import { PageLinksContext, type PageLinkOption } from './page-links';
import { navigationPath, publicPageUrl } from '../documents/links';
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
  publicationState: 'draft' | 'changes' | 'published';
};
type Media = { id: string; objectKey: string; fileName: string; contentType: string; url: string; isUsed: boolean };
type Revision = { id: string; revision: number; createdAt: number; canDelete: boolean };
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
type PublishChangesResponse = { publishedCount: number; documents: DocumentRecord[]; delivery: PublishDelivery | null };
type PublishDeliveryResponse = { delivery: PublishDelivery };
type DocumentFields = Pick<DocumentRecord, 'title' | 'slug' | 'description' | 'folderId' | 'order'>;
type ThemePreference = 'system' | 'light' | 'dark';

const emptyContent: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const emptyDocument: DocumentRecord = {
  id: '', locale: defaultLocale, title: '', slug: '', description: '', folderId: null, order: 0,
  contentJson: emptyContent, status: 'draft', publicationState: 'draft', version: 0,
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
  ...tableExtensions,
  Callout, Steps, Tabs, Tab, Video,
  Youtube.configure({ nocookie: true, width: 640, height: 360 }),
];

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

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
  const payload = JSON.parse(text) as T & { error?: string; code?: string };
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status, payload.code);
  return payload;
}

function documentFields(document: DocumentFields): DocumentFields {
  const { title, slug, description, folderId, order } = document;
  return { title, slug, description, folderId, order };
}

function setEditorDocument(editor: Editor | null, content: JSONContent, resetHistory = false) {
  if (!editor || editor.isDestroyed) return;
  const next = content || emptyContent;
  if (resetHistory) {
    editor.view.updateState(loadDocumentState(editor.state, next));
    // Notify Tiptap's reactive toolbar without introducing a history step.
    editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
  } else if (!editor.state.doc.eq(editor.schema.nodeFromJSON(next))) {
    editor.commands.setContent(next, { emitUpdate: false });
  }
}

function hasDocumentChanges(document: DocumentRecord, fields: DocumentFields, contentJson: JSONContent) {
  return document.title !== fields.title || document.slug !== fields.slug || document.description !== fields.description ||
    document.folderId !== fields.folderId || document.order !== fields.order || JSON.stringify(document.contentJson) !== JSON.stringify(contentJson);
}

function App() {
  const { language, setLanguage, t } = useAdminI18n();
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
  const savedFolderFields = useRef({ name: '', slug: '' });
  const [fields, setFields] = useState<DocumentFields>(documentFields(emptyDocument));
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [notice, setNotice] = useState<AdminMessage>('Loading documents…');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [localDrafts, setLocalDrafts] = useState<Pick<LocalDocumentDraft, 'documentId' | 'locale'>[]>([]);
  useEffect(() => {
    const subscription = liveQuery(listLocalDocumentDrafts).subscribe({
      next: (drafts) => setLocalDrafts(drafts),
      error: () => setLocalDrafts([]),
    });
    return () => subscription.unsubscribe();
  }, []);
  const [hasPendingImages, setHasPendingImages] = useState(false);
  const [versionConflictKey, setVersionConflictKey] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const [localSaveState, setLocalSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localDraftConflict, setLocalDraftConflict] = useState<LocalDocumentDraft | null>(null);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem('docs-cms-locale'); } catch { /* Preferences are optional. */ }
    return saved && isSupportedLocale(saved) ? saved : defaultLocale;
  });
  const [missingDocumentId, setMissingDocumentId] = useState<string | null>(null);
  const [missingTranslationSource, setMissingTranslationSource] = useState<SupportedLocale | null>(null);
  const [latestDelivery, setLatestDelivery] = useState<PublishDelivery | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem('docs-cms-theme'); } catch { /* Preferences are optional. */ }
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const pendingLocalDraft = useRef<LocalDocumentDraft | null>(null);
  const localDraftTimer = useRef<number | null>(null);
  const localWrite = useRef(Promise.resolve());
  const selectionVersion = useRef(0);
  const loadedEditorDocument = useRef<{ editor: Editor; selection: number } | null>(null);
  const savedDocument = useRef<DocumentRecord | null>(null);
  const fieldsRef = useRef(fields);
  const editVersion = useRef(0);
  const toolActions = useRef<AdminToolActions | null>(null);
  const toolRenderWaiters = useRef(new Set<() => void>());
  useEffect(() => {
    if (!document.modelContext) return;
    const controller = new AbortController();
    void registerAdminTools(document.modelContext, () => {
      if (!toolActions.current) throw new Error('Admin is not ready.');
      return toolActions.current;
    }, controller.signal).catch(() => {
      // Registration can be denied by the browser's Permissions Policy.
      // Remove a partial registration without affecting ordinary Admin use.
      controller.abort();
    });
    return () => controller.abort();
  }, []);

  const noticeText = typeof notice === 'string' ? t(notice) : t(notice.text, Object.fromEntries(Object.entries(notice.values).map(([key, value]) => [key, key === 'delivery' || key === 'error' ? t(String(value)) : value])));

  const showNotice = useCallback((message: AdminMessage, error = false) => {
    setNotice(message);
    setNoticeIsError(error);
  }, []);
  const showDocumentError = (error: unknown, document: DocumentRecord) => {
    if (error instanceof ApiError && error.code === 'version_conflict') {
      setVersionConflictKey(localDocumentKey(document.id, document.locale));
      showNotice('This page was saved in another editor. Your unsaved edits are kept in this browser. Load the latest saved content to review them.', true);
    } else showNotice(error instanceof Error ? error.message : String(error), true);
  };
  const applyFields = (nextFields: DocumentFields) => {
    fieldsRef.current = nextFields;
    setFields(nextFields);
  };
  const setEditingLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    setFolderLocale(nextLocale);
    try { window.localStorage.setItem('docs-cms-locale', nextLocale); } catch { /* Switching still works. */ }
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
      showNotice(message('Local save failed: {error}', { error: error instanceof Error ? error.message : String(error) }), true);
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
    const refresh = () => { void refreshDeliveries().catch((error) => showNotice(error instanceof Error ? error.message : String(error), true)); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refreshDeliveries, showNotice]);

  const selectedFolder = treeItems.find((item) => item.kind === 'folder' && item.id === `folder:${selectedFolderId}`) ?? null;
  const missingDocument = missingDocumentId ? treeItems.find((item) => item.documentId === missingDocumentId) : undefined;
  const activeParentFolderId = selectedFolderId ?? current?.folderId ?? (missingDocument?.parentId ? missingDocument.parentId.slice('folder:'.length) : null);
  const folderParent = treeItems.find((item) => item.kind === 'folder' && item.id === `folder:${folderParentId}`) ?? null;
  const savedChangeCount = treeItems.reduce((count, item) => count + item.translationStates.filter((entry) => entry.state !== 'published').length, 0);
  const currentPublicationState = current?.publicationState;
  const hasVersionConflict = Boolean(current && versionConflictKey === localDocumentKey(current.id, current.locale));

  useEffect(() => {
    Promise.all([refreshDocuments(), refreshMedia(), refreshTree(), refreshDeliveries()])
      .then(() => showNotice('Ready.'))
      .catch((error: unknown) => showNotice(error instanceof Error ? error.message : String(error), true));
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
    try { window.localStorage.setItem('docs-cms-theme', theme); } catch { /* Switching still works. */ }
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
    const previous = loadedEditorDocument.current;
    setEditorDocument(editor, current.contentJson, previous?.editor !== editor || previous.selection !== selectionVersion.current);
    loadedEditorDocument.current = { editor, selection: selectionVersion.current };
    setHasPendingImages(hasPendingImageUpload(current.contentJson));
  }, [current, editor]);

  useEffect(() => {
    if (!isRevisionOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRevisionOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isRevisionOpen]);

  const selectDocument = async (document: DocumentRecord, targetLocale: SupportedLocale = document.locale, options: { throwOnError?: boolean; expectedEditVersion?: number } = {}) => {
    const selection = ++selectionVersion.current;
    if (!await flushLocalDraft()) return;
    if (selection !== selectionVersion.current || options.expectedEditVersion !== undefined && options.expectedEditVersion !== editVersion.current) return;
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
      return document;
    }
    try {
      const loaded = await api<DocumentRecord>(`/documents/${encodeURIComponent(document.id)}`, {}, targetLocale);
      let localDraft: LocalDocumentDraft | undefined;
      try {
        localDraft = await readLocalDocumentDraft(loaded.id, loaded.locale);
      } catch (error) {
        setLocalSaveState('error');
        showNotice(message('Browser storage is unavailable: {error}', { error: error instanceof Error ? error.message : String(error) }), true);
      }
      if (selection !== selectionVersion.current) return;
      if (options.expectedEditVersion !== undefined && options.expectedEditVersion !== editVersion.current) {
        throw new Error('The editor changed while opening this page. Read the workspace and try again.');
      }
      savedDocument.current = loaded;
      setVersionConflictKey(null);
      const canRestore = localDraft?.baseVersion === loaded.version;
      const displayed = canRestore && localDraft ? {
        ...loaded, title: localDraft.title, slug: localDraft.slug, description: localDraft.description,
        folderId: localDraft.folderId, order: localDraft.order, contentJson: resolveContentMedia(localDraft.contentJson, new Set(media.map((item) => item.objectKey)), 'admin'),
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
      showNotice(canRestore ? 'Your unsaved edits were restored.' : 'Saved draft loaded.');
      return displayed;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
      if (options.throwOnError) throw error;
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
    savedFolderFields.current = { name: folder.name, slug: folder.slug };
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
        if (localizedFolder) {
          setFolderName(localizedFolder.name);
          savedFolderFields.current = { name: localizedFolder.name, slug: localizedFolder.slug };
        }
      } catch (error) {
        showNotice(error instanceof Error ? error.message : String(error), true);
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
    showNotice(message('No {locale} translation yet.', { locale: localeLabel(locale) }));
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
    showNotice(message('No {locale} translation yet.', { locale: localeLabel(targetLocale) }));
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
    showNotice(message('No {locale} translation yet.', { locale: localeLabel(targetLocale) }));
  };
  const createDocumentTranslation = async () => {
    if (!missingDocumentId) return;
    setIsSaving(true);
    try {
      if (!missingTranslationSource) throw new Error('No source translation is available.');
      const created = await api<DocumentRecord>(`/documents/${encodeURIComponent(missingDocumentId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale: missingTranslationSource }) }, locale);
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      await selectDocument(created);
      showNotice(message('{locale} translation created from {source}.', { locale: localeLabel(locale), source: missingTranslationSource ?? '' }));
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); } finally { setIsSaving(false); }
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
      savedFolderFields.current = { name: created.name, slug: created.slug };
      setFolderLocale(defaultLocale);
      setMissingFolderTranslationSource(null);
      showNotice('Folder created.');
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); } finally { setIsSaving(false); }
  };
  const saveFolder = async () => {
    if (!selectedFolder) return;
    const name = folderName.trim(); const slug = folderSlug || slugify(name);
    if (!name || !slug) return showNotice('Folder name is required.', true);
    if (!validSlug.test(slug)) return showNotice('URL segment must use lowercase letters, numbers, and single hyphens.', true);
    setIsSaving(true);
    try {
      await api<Folder>(`/folders/${encodeURIComponent(selectedFolderId!)}`, { method: 'PUT', body: JSON.stringify({ name, slug, parentId: selectedFolder.parentId ? selectedFolder.parentId.slice('folder:'.length) : null, order: selectedFolder.order }) }, folderLocale);
      savedFolderFields.current = { name: folderName, slug: folderSlug };
      await refreshTree(); showNotice('Folder saved.');
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); } finally { setIsSaving(false); }
  };
  const selectFolderLocale = async (targetLocale: SupportedLocale) => {
    if (!selectedFolder || !selectedFolderId) return;
    setEditingLocale(targetLocale);
    if (targetLocale === defaultLocale) {
      setFolderLocale(targetLocale);
      setFolderName(selectedFolder.name);
      setFolderSlug(selectedFolder.slug);
      savedFolderFields.current = { name: selectedFolder.name, slug: selectedFolder.slug };
      setMissingFolderTranslationSource(null);
      return;
    }
    if (!selectedFolder.translationLocales.includes(targetLocale)) {
      const source = selectedFolder.translationLocales.find((value): value is SupportedLocale => isSupportedLocale(value));
      setFolderLocale(targetLocale);
      setFolderName('');
      setFolderSlug(selectedFolder.slug);
      savedFolderFields.current = { name: '', slug: selectedFolder.slug };
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
      savedFolderFields.current = { name: translatedFolder.name, slug: translatedFolder.slug };
      setMissingFolderTranslationSource(null);
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); }
  };
  const createFolderTranslation = async () => {
    if (!selectedFolderId || !missingFolderTranslationSource) return;
    setIsSaving(true);
    try {
      const created = await api<FolderTranslation>(`/folders/${encodeURIComponent(selectedFolderId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale: missingFolderTranslationSource }) }, folderLocale);
      await refreshTree();
      setFolderName(created.name);
      savedFolderFields.current = { name: created.name, slug: folderSlug };
      setMissingFolderTranslationSource(null);
      showNotice(message('{locale} folder translation created from {source}.', { locale: localeLabel(folderLocale), source: missingFolderTranslationSource ?? '' }));
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); } finally { setIsSaving(false); }
  };
  const deleteFolder = async () => {
    if (!selectedFolderId || !selectedFolder || !window.confirm(t('Delete empty folder “{name}”?', { name: selectedFolder.name }))) return;
    setIsSaving(true);
    try {
      await api<void>(`/folders/${encodeURIComponent(selectedFolderId)}`, { method: 'DELETE' });
      setSelectedFolderId(null); await refreshTree(); showNotice('Folder deleted.');
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); } finally { setIsSaving(false); }
  };
  const replaceTreeChildren = async (parentId: string | null, childIds: string[]) => {
    try {
      await api('/tree/children', { method: 'PUT', body: JSON.stringify({ parentId, childIds }) });
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), true); throw error; }
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

  const save = async (options: { throwOnError?: boolean; expectedEditVersion?: number } = {}): Promise<DocumentRecord | undefined> => {
    if (!editor || !current || mutationInFlight.current || localDraftConflict || hasVersionConflict) return undefined;
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
    mutationInFlight.current = true;
    setIsSaving(true);
    try {
      const saveSelection = selectionVersion.current;
      await flushLocalDraft();
      if (selectionVersion.current !== saveSelection) return undefined;
      if (options.expectedEditVersion !== undefined && options.expectedEditVersion !== editVersion.current) {
        throw new Error('The editor changed before saving. Read the document and try again.');
      }
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
      showDocumentError(error, current);
      if (options.throwOnError) throw error;
    } finally {
      mutationInFlight.current = false;
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
      contentJson: resolveContentMedia(localDraftConflict.contentJson, new Set(media.map((item) => item.objectKey)), 'admin'),
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
    if (delivery.status === 'accepted') return delivery.alreadyExists ? 'Publication saved. Site update already requested.' : 'Publication saved. Site update requested.';
    if (delivery.status === 'skipped') return delivery.lastError === 'Local development rebuild is active' ? 'Published. Local docs rebuild automatically.' : 'Published, but Deploy Hook is not configured.';
    if (delivery.status === 'failed') return 'Publication saved, but the site update request failed. Retry site update from the header.';
    return 'Build request is pending.';
  };

  const publishChanges = async () => {
    if (mutationInFlight.current || localDraftConflict || hasVersionConflict) return;
    if (isDirty) return showNotice('Save the current draft before publishing changes.', true);
    const targets = treeItems.flatMap((item) => item.translationStates.filter((entry) => entry.state !== 'published').map((entry) => `${item.name} · ${localeLabel(entry.locale)}`));
    if (!window.confirm(savedChangeCount > 0 ? t('Publish {count} saved translations?\n\n{targets}\n\nOnly saved drafts are included. The site update will be requested once.', { count: savedChangeCount, targets: targets.join('\n') }) : t('Rebuild the site and clean up unused media when the build completes?'))) return;
    const publishSelection = selectionVersion.current;
    mutationInFlight.current = true;
    setIsSaving(true);
    try {
      const result = await api<PublishChangesResponse>('/publish/changes', { method: 'POST' });
      const published = result.documents.find((document) => document.id === current?.id && document.locale === current.locale);
      if (published && selectionVersion.current === publishSelection) {
        savedDocument.current = published;
        const latestFields = fieldsRef.current;
        const latestContent = editor?.getJSON() ?? published.contentJson;
        const changed = hasDocumentChanges(published, latestFields, latestContent);
        setCurrent({ ...published, ...latestFields, contentJson: latestContent });
        setIsDirty(changed);
        if (changed) queueLocalDraft(published, latestFields, latestContent);
        else {
          pendingLocalDraft.current = null;
          if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
          localDraftTimer.current = null;
          await removeQueuedLocalDraft(published.id, published.locale);
          setLocalSaveState('idle');
        }
      }
      if (!result.delivery) return showNotice('There are no saved changes to publish.');
      setLatestDelivery(result.delivery);
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      await refreshMedia();
      showNotice(result.publishedCount > 0
        ? message('Published {count} translations. {delivery}', { count: result.publishedCount, delivery: describeDelivery(result.delivery) })
        : message('Site rebuild requested. {delivery}', { delivery: describeDelivery(result.delivery) }), result.delivery.status === 'failed');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
    } finally {
      mutationInFlight.current = false;
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
      showNotice(error instanceof Error ? error.message : String(error), true);
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
      showNotice(error instanceof Error ? error.message : String(error), true);
    }
  };

  const toggleRevisionHistory = async () => {
    if (isRevisionOpen) {
      setIsRevisionOpen(false);
      return;
    }
    await loadRevisions();
  };

  const removeRevision = async (revision: Revision) => {
    if (!current?.id || mutationInFlight.current || isDirty || !revision.canDelete) return;
    if (!window.confirm(t('Delete revision {revision}? It cannot be restored. Media still used elsewhere will be kept; unused media is cleaned up during the next build.', { revision: revision.revision }))) return;
    const selection = selectionVersion.current;
    mutationInFlight.current = true; setIsSaving(true);
    try {
      await api<void>(`/documents/${encodeURIComponent(current.id)}/revisions/${encodeURIComponent(revision.id)}`, { method: 'DELETE', body: JSON.stringify({ version: current.version }) }, current.locale);
      if (selection === selectionVersion.current) await loadRevisions();
      await refreshMedia();
      showNotice('Revision deleted. Unused media will be cleaned up during the next build.');
    } catch (error) { showDocumentError(error, current); }
    finally { mutationInFlight.current = false; setIsSaving(false); }
  };

  const restore = async (revision: Revision) => {
    if (!current?.id || mutationInFlight.current || isDirty || localDraftConflict || hasVersionConflict) return;
    const restoreSelection = selectionVersion.current;
    const restoreEditVersion = editVersion.current;
    mutationInFlight.current = true;
    setIsSaving(true);
    try {
      const restored = await api<DocumentRecord>(`/documents/${encodeURIComponent(current.id)}/revisions/${encodeURIComponent(revision.id)}/restore`, {
        method: 'POST', body: JSON.stringify({ version: current.version }),
      }, current.locale);
      if (selectionVersion.current !== restoreSelection) {
        await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
        return;
      }
      savedDocument.current = restored;
      if (editVersion.current === restoreEditVersion) {
        setCurrent(restored);
        applyFields(documentFields(restored));
        setIsDirty(false);
        pendingLocalDraft.current = null;
        if (localDraftTimer.current !== null) window.clearTimeout(localDraftTimer.current);
        localDraftTimer.current = null;
        await removeQueuedLocalDraft(restored.id, restored.locale);
        setLocalSaveState('idle');
      } else {
        const latestFields = fieldsRef.current;
        const latestContent = editor?.getJSON() ?? restored.contentJson;
        setCurrent({ ...restored, ...latestFields, contentJson: latestContent });
        setIsDirty(true);
        queueLocalDraft(restored, latestFields, latestContent);
      }
      await Promise.all([refreshDocuments(), refreshTree(), refreshDeliveries()]);
      showNotice(message('Revision {revision} restored as a draft.', { revision: revision.revision }));
    } catch (error) {
      showDocumentError(error, current);
    } finally {
      mutationInFlight.current = false;
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!current?.id || !window.confirm(t('Delete “{name}”?', { name: current.title }))) return;
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
      showNotice(error instanceof Error ? error.message : String(error), true);
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
      showNotice(error instanceof Error ? error.message : String(error), true);
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
    setIsMediaPickerOpen(false);
    showNotice(message('{fileName} inserted.', { fileName: item.fileName }));
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

  const toolLocale = (value: string): SupportedLocale => {
    if (!isSupportedLocale(value)) throw new Error('Unsupported document language.');
    return value;
  };
  const editToken = () => `${selectionVersion.current}:${editVersion.current}:${current?.version ?? 0}`;
  const describeEditor = () => current ? {
    document: { ...current, ...fieldsRef.current, contentJson: editor?.getJSON() ?? current.contentJson },
    source: 'editor', editToken: editToken(), ready: Boolean(editor && !editor.isDestroyed),
    unsaved: isDirty || !current.id, versionConflict: hasVersionConflict,
    browserDraftConflict: Boolean(localDraftConflict), pendingImages: hasPendingImages,
    textBlocks: editor ? documentTextBlocks(editor.state) : [],
    selection: editor ? { from: editor.state.selection.from, to: editor.state.selection.to } : null,
  } : null;
  const describeEditorRef = useRef(describeEditor);
  describeEditorRef.current = describeEditor;
  useEffect(() => { for (const notify of toolRenderWaiters.current) notify(); });
  const waitForToolRender = (ready: () => boolean) => new Promise<void>((resolve, reject) => {
    if (ready()) { resolve(); return; }
    const timeout = window.setTimeout(() => {
      toolRenderWaiters.current.delete(notify);
      reject(new Error('The editor has not become ready. Read the workspace and try again.'));
    }, 5000);
    const notify = () => {
      if (!ready()) return;
      window.clearTimeout(timeout);
      toolRenderWaiters.current.delete(notify);
      resolve();
    };
    toolRenderWaiters.current.add(notify);
  });
  const waitForToolEditor = (id: string, targetLocale: SupportedLocale) => waitForToolRender(() => {
    const live = describeEditorRef.current();
    return Boolean(live?.ready && live.document.id === id && live.document.locale === targetLocale);
  });
  const latestWorkspace = () => {
    if (!toolActions.current) throw new Error('Admin is not ready.');
    return toolActions.current.workspace();
  };
  const assertToolEditor = (input: EditorTarget) => {
    if (!current || !editor || editor.isDestroyed) throw new Error('Open a document before editing.');
    if (current.id !== input.documentId || current.locale !== input.locale || editToken() !== input.editToken) {
      throw new Error('The editor changed. Read the open document again for its current editToken.');
    }
    if (mutationInFlight.current || isSaving) throw new Error('An Admin operation is in progress. Wait for it to finish.');
    if (localDraftConflict || hasVersionConflict) throw new Error('Resolve the saved/browser draft conflict in Admin before editing or saving.');
    if (hasPendingImageUpload(editor.getJSON())) throw new Error('Finish uploading images before editing or saving.');
    return editor;
  };
  const assertToolNavigation = () => {
    if (mutationInFlight.current || isSaving) throw new Error('An Admin operation is in progress. Wait for it to finish.');
    if (current && !current.id && isDirty) throw new Error('Save the new page before leaving it.');
    if (editor && hasPendingImageUpload(editor.getJSON())) throw new Error('Finish uploading images before leaving this page.');
    if (selectedFolder && (folderSlug !== savedFolderFields.current.slug || folderName !== savedFolderFields.current.name)) {
      throw new Error('Save the folder settings before navigating to a page.');
    }
  };
  const openToolDocument = async (input: { documentId: string; locale: string }) => {
    const targetLocale = toolLocale(input.locale);
    if (current?.id === input.documentId && current.locale === targetLocale) return latestWorkspace();
    assertToolNavigation();
    const expectedEditVersion = editVersion.current;
    const selection = selectionVersion.current;
    const items = await api<NavigationItem[]>('/tree', {}, targetLocale);
    if (selection !== selectionVersion.current || expectedEditVersion !== editVersion.current) throw new Error('The workspace changed. Read it again before navigating.');
    const item = items.find((entry) => entry.documentId === input.documentId);
    if (!item) throw new Error('Document not found. Refresh the document list.');
    if (item.hasTranslation) {
      const opened = await selectDocument({ ...emptyDocument, id: input.documentId, locale: targetLocale }, targetLocale, { throwOnError: true, expectedEditVersion });
      if (!opened) throw new Error('The page could not be opened. Check Admin for a storage error or changed selection.');
      flushSync(() => { setEditingLocale(targetLocale); setSearch(''); });
      await waitForToolEditor(input.documentId, targetLocale);
    } else {
      if (!await flushLocalDraft()) throw new Error('The browser draft could not be preserved. Save it before navigating.');
      if (selection !== selectionVersion.current || expectedEditVersion !== editVersion.current) throw new Error('The workspace changed. Read it again before navigating.');
      flushSync(() => {
        selectionVersion.current += 1;
        setEditor(null); setCurrent(null); savedDocument.current = null; setSelectedFolderId(null);
        setEditingLocale(targetLocale); setMissingDocumentId(input.documentId);
        const source = item.translationLocales.includes(defaultLocale) ? defaultLocale : item.translationLocales.find(isSupportedLocale);
        setMissingTranslationSource(source ?? null); setIsDirty(false); setLocalDraftConflict(null); setSearch('');
      });
    }
    return latestWorkspace();
  };
  toolActions.current = {
    workspace: () => ({
      siteTitle: siteConfig.title, siteUrl: siteConfig.url || window.location.origin, defaultLocale, locales: siteConfig.locales, locale, adminLanguage: language,
      editor: describeEditor(), selectedFolderId,
      missingTranslation: missingDocumentId ? { documentId: missingDocumentId, locale, sourceLocale: missingTranslationSource } : null,
      contentFormat: 'Tiptap JSON. Text offsets are ProseMirror positions within the open editor, not character offsets into plain text.',
      schema: editor ? {
        nodes: Object.values(editor.schema.nodes).map((node) => ({ name: node.name, content: node.spec.content ?? '', attributes: Object.keys(node.spec.attrs ?? {}) })),
        marks: Object.values(editor.schema.marks).map((mark) => ({ name: mark.name, attributes: Object.keys(mark.spec.attrs ?? {}) })),
      } : null,
    }),
    listDocuments: async (input) => {
      const targetLocale = toolLocale(input.locale ?? locale);
      const [items, drafts] = await Promise.all([api<NavigationItem[]>('/tree', {}, targetLocale), listLocalDocumentDrafts()]);
      const query = input.query?.trim().toLowerCase() ?? '';
      return { locale: targetLocale, locales: siteConfig.locales, items: items.map((item) => ({
        ...item, path: navigationPath(item.id, items),
        browserDraftLocales: [...new Set([
          ...drafts.filter((draft) => draft.documentId === item.documentId).map((draft) => draft.locale),
          ...(item.documentId && current?.id === item.documentId && isDirty ? [current.locale] : []),
        ])],
      })).filter((item) => !query || `${item.name} ${item.path}`.toLowerCase().includes(query)) };
    },
    readDocument: async (input) => {
      const targetLocale = toolLocale(input.locale);
      if (current?.id === input.documentId && current.locale === targetLocale) return describeEditor();
      const [saved, draft] = await Promise.all([
        api<DocumentRecord>(`/documents/${encodeURIComponent(input.documentId)}`, {}, targetLocale),
        readLocalDocumentDraft(input.documentId, targetLocale),
      ]);
      // A human may have opened this page while the network request was pending.
      const live = describeEditorRef.current();
      if (live?.document.id === input.documentId && live.document.locale === targetLocale) return live;
      if (!draft) return { document: saved, source: 'saved-draft', unsaved: false };
      if (draft.baseVersion !== saved.version) return { document: saved, source: 'saved-draft', unsaved: true, browserDraftConflict: true, conflictingBrowserDraft: draft };
      const keys = new Set((await api<Media[]>('/media')).map((item) => item.objectKey));
      return { document: { ...saved, ...documentFields(draft), contentJson: resolveContentMedia(draft.contentJson, keys, 'admin') }, source: 'browser-draft', unsaved: true };
    },
    openDocument: openToolDocument,
    setLocale: async (input) => {
      const targetLocale = toolLocale(input.locale);
      const id = current?.id || missingDocumentId;
      if (id) return openToolDocument({ documentId: id, locale: targetLocale });
      if (current) throw new Error('Save the new page in the default language before switching its document language.');
      assertToolNavigation();
      if (selectedFolder) throw new Error('Select a page before switching its document language.');
      flushSync(() => setEditingLocale(targetLocale));
      return latestWorkspace();
    },
    newDocument: async (input) => {
      assertToolNavigation();
      const expectedEditVersion = editVersion.current;
      const folderId = input.folderId ?? null;
      if (folderId && !treeItems.some((item) => item.id === `folder:${folderId}`)) throw new Error('Folder not found. Refresh the document list.');
      const opened = await selectDocument({ ...emptyDocument, folderId, order: nextOrder(folderId) }, defaultLocale, { expectedEditVersion });
      if (!opened) throw new Error('The browser draft could not be preserved. Save it before creating a page.');
      flushSync(() => { setEditingLocale(defaultLocale); setSearch(''); });
      await waitForToolEditor('', defaultLocale);
      return latestWorkspace();
    },
    createTranslation: async (input) => {
      const targetLocale = toolLocale(input.locale);
      const sourceLocale = toolLocale(input.sourceLocale);
      assertToolNavigation();
      const selection = selectionVersion.current;
      const expectedEditVersion = editVersion.current;
      if ((current?.id === input.documentId && current.locale === sourceLocale && isDirty) || await readLocalDocumentDraft(input.documentId, sourceLocale)) {
        throw new Error('Save the source language browser draft before copying it.');
      }
      if (selection !== selectionVersion.current || expectedEditVersion !== editVersion.current) throw new Error('The workspace changed. Read it again before creating a translation.');
      mutationInFlight.current = true;
      setIsSaving(true);
      try {
        const created = await api<DocumentRecord>(`/documents/${encodeURIComponent(input.documentId)}/translations`, { method: 'POST', body: JSON.stringify({ sourceLocale }) }, targetLocale);
        await Promise.all([refreshDocuments(), refreshTree()]);
        if (selection !== selectionVersion.current || expectedEditVersion !== editVersion.current) {
          return { created, opened: false, message: 'Translation created; the human changed the editor, so it was kept open.' };
        }
        await selectDocument(created, targetLocale, { throwOnError: true, expectedEditVersion });
        flushSync(() => setEditingLocale(targetLocale));
        await waitForToolEditor(created.id, targetLocale);
        return { created, workspace: latestWorkspace() };
      } finally {
        mutationInFlight.current = false;
        flushSync(() => setIsSaving(false));
      }
    },
    editDocument: (input) => {
      const openEditor = assertToolEditor(input);
      const tr = documentEditTransaction(openEditor.state, input);
      const nextFields = { ...fieldsRef.current };
      for (const key of ['title', 'description', 'slug', 'folderId', 'order'] as const) {
        const value = input[key];
        if (value !== undefined) Object.assign(nextFields, { [key]: value });
      }
      if (nextFields.folderId && !treeItems.some((item) => item.id === `folder:${nextFields.folderId}`)) throw new Error('Folder not found. Refresh the document list.');
      flushSync(() => {
        if (tr.docChanged) openEditor.view.dispatch(tr);
        editVersion.current += 1;
        applyFields(nextFields);
        const content = openEditor.getJSON();
        const baseline = savedDocument.current;
        setIsDirty(baseline ? hasDocumentChanges(baseline, nextFields, content) : true);
        if (baseline) queueLocalDraft(baseline, nextFields, content);
      });
      return latestWorkspace();
    },
    saveDraft: async (input) => {
      assertToolEditor(input);
      const selection = selectionVersion.current;
      const saved = await save({ throwOnError: true, expectedEditVersion: editVersion.current });
      if (!saved) throw new Error('The draft was not saved. Check the current editor fields and Admin message.');
      await waitForToolRender(() => {
        const live = describeEditorRef.current();
        return selection !== selectionVersion.current || Boolean(live?.document.id === saved.id && live.document.locale === saved.locale && live.document.version >= saved.version);
      });
      return { saved, workspace: latestWorkspace() };
    },
    preview: async (input) => {
      const targetLocale = toolLocale(input.locale);
      if (current?.id === input.documentId && current.locale === targetLocale && (isDirty || localDraftConflict || hasVersionConflict)) {
        throw new Error('Save or resolve the open draft before previewing it.');
      }
      if (await readLocalDocumentDraft(input.documentId, targetLocale)) throw new Error('Open and save this page browser draft before previewing it.');
      const [saved, items] = await Promise.all([
        api<DocumentRecord>(`/documents/${encodeURIComponent(input.documentId)}`, {}, targetLocale),
        api<NavigationItem[]>('/tree', {}, targetLocale),
      ]);
      const live = describeEditorRef.current();
      if (live?.document.id === input.documentId && live.document.locale === targetLocale && (live.unsaved || live.browserDraftConflict || live.versionConflict)) {
        throw new Error('The draft changed while preparing Preview. Save or resolve it before previewing.');
      }
      return {
        url: new URL(`/admin/preview/${encodeURIComponent(input.documentId)}?locale=${encodeURIComponent(targetLocale)}`, window.location.origin).href,
        source: 'saved-draft', publicationState: saved.publicationState,
        publicPage: saved.status === 'published' ? {
          url: new URL(publicPageUrl(navigationPath(`document:${saved.id}`, items), targetLocale), siteConfig.url || window.location.origin).href,
          source: 'last-deployed-site', deploymentStatus: 'unknown',
        } : null,
      };
    },
    listMedia: () => api<Media[]>('/media'),
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
    return <nav className="cms-breadcrumb" aria-label={t("Document hierarchy")}>
      <button className="cms-breadcrumb-root" type="button" onClick={selectNavigationRoot}>{t("Documents")}</button>
      {items.map((item) => <span className="cms-breadcrumb-item" key={`${item.id}:${item.name}`}><ChevronRightIcon />{item.id ? <button type="button" onClick={() => selectFolder(item.id)}>{item.name}</button> : <strong>{item.name}</strong>}</span>)}
    </nav>;
  };
  const renderFolderPanel = () => {
    if (!selectedFolder) return null;
    const translationMissing = Boolean(missingFolderTranslationSource);
    return <section className="cms-folder-panel" aria-label={t("Folder settings")}>
      {renderBreadcrumb(selectedFolderId)}
      <header>
        <div><p>{t("Folder")}</p><h1>{folderName || selectedFolder.name}</h1><span>{t("Pages and nested folders inherit this location.")}</span></div>
      </header>
      <section className="cms-document-actions" aria-label={t("Folder actions")}>
        <div className="cms-document-state"><span className="cms-status cms-status-folder">{t("Folder")}</span><span>{translationMissing ? t("Translation needs to be created.") : t("Navigation changes publish with the next rebuild.")}</span></div>
        {translationMissing ? <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createFolderTranslation()}>{t("Create {locale} translation", { locale: localeLabel(folderLocale) })}</button> : <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void saveFolder()}>{isSaving ? t("Saving…") : t("Save folder")}</button>}
      </section>
      <div className="cms-folder-fields">
        <label className="cms-meta-field"><span>{t("URL segment")}</span><input value={folderSlug} disabled={folderLocale !== defaultLocale} onChange={(event) => setFolderSlug(normalizeSlugInput(event.target.value))} onBlur={() => setFolderSlug((value) => slugify(value))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} /><small className="cms-field-help">{t("Shared across all languages.")}</small></label>
      </div>
      <label className="cms-content-locale"><span>{t("Document language")}</span><select value={folderLocale} onChange={(event) => void selectFolderLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label>
      {translationMissing ? <section className="cms-folder-translation-empty">
        <h2>{t("Translation not created")}</h2>
        <p>{t("This folder has no {locale} translation. Create one by copying the {source} name.", { locale: localeLabel(folderLocale), source: missingFolderTranslationSource ? localeLabel(missingFolderTranslationSource) : '' })}</p>
      </section> : <div className="cms-folder-fields">
        <label className="cms-meta-field"><span>{t("Name")}</span><input value={folderName} onChange={(event) => { setFolderName(event.target.value); if (folderLocale === defaultLocale) setFolderSlug((value) => value || slugify(event.target.value)); }} /></label>
      </div>}
      <section className="cms-folder-children-actions" aria-label={t("Add to folder")}><div><h2>{t("Add to folder")}</h2><p>{t("Create a page or nested folder at this location.")}</p></div><div><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument(selectedFolderId)}>{t("New page")}</button><button className="cms-button" type="button" onClick={() => openNewFolder(selectedFolderId)}>{t("New folder")}</button></div></section>
      <section className="cms-danger-zone" aria-label={t("Danger zone")}><div><h2>{t("Delete folder")}</h2><p>{t("Move or delete its contents before removing this folder.")}</p></div><button className="cms-button cms-button-danger cms-button-danger-quiet" type="button" disabled={isSaving} onClick={() => void deleteFolder()}>{t("Delete folder")}</button></section>
    </section>;
  };

  const unsavedDocumentIds = [...new Set([
    ...localDrafts.filter((draft) => draft.documentId !== current?.id || draft.locale !== current.locale || Boolean(localDraftConflict)).map((draft) => draft.documentId),
    ...(current?.id && isDirty ? [current.id] : []),
  ])];

  return <div className="cms-shell">
    <header className="cms-topbar">
      <a className="cms-brand" href="/admin/" aria-label={`${siteConfig.title} home`}><img className="cms-brand-logo" src={logoUrl} alt="" /></a>
      <div className="cms-topbar-controls">
        <div className="cms-actions">
        <span className={`cms-notice ${noticeIsError ? 'is-error' : ''}`} role="status">{noticeText}</span>
        {(latestDelivery?.status === 'failed' || (latestDelivery?.status === 'pending' && (!latestDelivery.nextRetryAt || latestDelivery.nextRetryAt <= Date.now()))) && <button className="cms-button" type="button" disabled={isSaving} onClick={() => void retryBuild()}>{t("Retry site update")}</button>}
        <button className="cms-button cms-button-primary" type="button" disabled={isSaving || isDirty || hasPendingImages || Boolean(localDraftConflict) || hasVersionConflict} title={t("Publish saved changes across all pages and languages")} onClick={() => void publishChanges()}>{t("Publish")}{savedChangeCount > 0 ? ` (${savedChangeCount})` : ''}</button>
        </div>
        <label className="cms-admin-language"><span className="sr-only">{t("Admin language")}</span><select value={language} onChange={(event) => { if (isAdminLanguage(event.target.value)) setLanguage(event.target.value); }}>{adminConfig.languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        <button className="cms-theme-trigger" type="button" onClick={() => setTheme(displayedTheme === 'dark' ? 'light' : 'dark')} aria-label={t(displayedTheme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode"))} title={t(displayedTheme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode"))}>
          {displayedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
    {noticeIsError && <div className="cms-error-banner" role="alert">{noticeText}</div>}

    <div className="cms-workspace">
      <aside className="cms-sidebar">
        <div className="cms-sidebar-heading"><span>{t("Documents")}</span><span className="cms-count">{documents.length}</span></div>
        <label className="cms-search"><span className="sr-only">{t("Search documents")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search documents")} /></label>
        <div className="cms-navigation-actions"><button className="cms-new-document" type="button" onClick={() => startNewDocument()}>{t("New page")}</button><button className="cms-new-folder" type="button" onClick={() => openNewFolder()}>{t("New folder")}</button></div>
        <NavigationTree items={treeItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))} selectedDocumentId={current?.id || missingDocumentId || undefined} selectedFolderId={selectedFolderId} unsavedDocumentIds={unsavedDocumentIds} temporaryDocument={current && !current.id ? { name: fields.title.trim() || t("Untitled page"), parentId: current.folderId ? `folder:${current.folderId}` : null } : undefined} onSelectDocument={selectTreeDocument} onSelectFolder={selectFolder} onChangeChildren={replaceTreeChildren} onTreeChanged={treeChanged} canReorder={!search.trim()} />
      </aside>

      <main className="cms-main">
        {selectedFolder ? renderFolderPanel() : missingDocumentId ? <section className="cms-empty-state"><span className="cms-empty-icon">文</span><h1>{t("Translation not created")}</h1><label className="cms-content-locale"><span>{t("Document language")}</span><select value={locale} onChange={(event) => selectMissingDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label><p>{t("This page has no {locale} translation.", { locale: localeLabel(locale) })} {missingTranslationSource ? t("Create a draft by copying the {locale} version.", { locale: localeLabel(missingTranslationSource) }) : ''}</p>{missingTranslationSource && <button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createDocumentTranslation()}>{t("Create {locale} translation", { locale: localeLabel(locale) })}</button>}</section> : !current ? <section className="cms-empty-state"><span className="cms-empty-icon">✦</span><h1>{t("Start a document")}</h1><p>{t("Create a page or folder, then organize it in the navigation tree.")}</p><div className="cms-empty-actions"><button className="cms-button cms-button-primary" type="button" onClick={() => startNewDocument()}>{t("New page")}</button><button className="cms-button" type="button" onClick={() => openNewFolder()}>{t("New folder")}</button></div></section> : <>
          {renderBreadcrumb(fields.folderId, fields.title || fields.slug || t("Untitled document"))}
          <section className="cms-document-actions" aria-label={t("Document actions")}>
            <div className="cms-document-state">
              <span className={`cms-status cms-status-${hasVersionConflict || localDraftConflict ? 'draft' : !current.id || isDirty ? 'unsaved' : currentPublicationState === 'published' ? 'published' : 'pending'}`}>{hasVersionConflict || localDraftConflict ? t('Review required') : !current.id || isDirty ? t('Unsaved') : currentPublicationState === 'published' ? t('Published') : t('Ready to publish')}</span>
              <span>{hasVersionConflict || localDraftConflict ? t("Choose which saved content to use below.") : hasPendingImages ? t("Finish uploading images or remove the empty upload block.") : !current.id ? t("Save draft to create this page.") : isDirty ? localSaveState === 'error' ? t("Browser backup failed. Save draft to keep your edits.") : t("Save draft before publishing.") : currentPublicationState === 'published' ? t("No changes to publish.") : t("Saved changes will be included when you publish.")}</span>
            </div>
            <div className="cms-document-action-buttons">
              {current.id && <button className="cms-button" type="button" disabled={isSaving || isDirty || hasVersionConflict || Boolean(localDraftConflict)} title={isDirty ? t("Save draft before previewing") : t("Preview the saved draft")} onClick={preview}>{t("Preview draft")}</button>}
              <button className={`cms-button ${!current.id || isDirty ? 'cms-button-primary' : ''}`} type="button" disabled={isSaving || hasPendingImages || hasVersionConflict || Boolean(localDraftConflict) || Boolean(current.id && !isDirty)} onClick={() => void save()}>{isSaving ? t("Working…") : t("Save draft")}</button>
              {isDirty && current.id && <button className="cms-button cms-button-quiet" type="button" disabled={isSaving} onClick={() => void discardLocalChanges()}>{t("Discard local changes")}</button>}
              {current.id && <span className="cms-action-divider" aria-hidden="true" />}
              {current.id && <button className={`cms-history-button ${isRevisionOpen ? 'is-active' : ''}`} type="button" onClick={() => void toggleRevisionHistory()} aria-expanded={isRevisionOpen}><HistoryIcon />{t("History")}</button>}
            </div>
          </section>
          {hasVersionConflict && <section className="cms-local-draft-conflict"><div><strong>{t("This page was saved elsewhere.")}</strong><p>{t("Your edits are kept. Load the latest draft, then choose which content to use.")}</p></div><button className="cms-button" type="button" disabled={isSaving} onClick={() => void selectDocument(current, current.locale)}>{t("Load latest draft")}</button></section>}
          {localDraftConflict && <section className="cms-local-draft-conflict" aria-label={t("Local draft conflict")}><div><strong>{t("This page was saved elsewhere.")}</strong><p>{t("The editor shows the latest saved content. Your unsaved edits are kept in this browser. Recovering them only changes the editor; save and publish are separate actions.")}</p></div><div><button className="cms-button" type="button" onClick={() => void discardLocalChanges()}>{t("Use latest saved content")}</button><button className="cms-button" type="button" onClick={restoreConflictingLocalChanges}>{t("Recover my unsaved edits")}</button></div></section>}
          <section className="cms-editor-surface" aria-label={t("Document editor")}>
            <div className="cms-document-fields">
              <label className="cms-meta-field">
                <span>{t("URL segment")}</span>
                <input className="cms-slug-input" value={fields.slug} onChange={(event) => updateSlug(event.target.value)} onBlur={() => updateField('slug', slugify(fields.slug))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} aria-invalid={Boolean(fields.slug) && !validSlug.test(fields.slug)} placeholder="getting-started" />
                <small className="cms-field-help">{t("Required. Shared across languages. Changing the URL of a published page updates live navigation when saved.")}</small>
              </label>
              {current.id && <label className="cms-content-locale"><span>{t("Document language")}</span><select value={current.locale} onChange={(event) => void selectDocumentLocale(event.target.value as SupportedLocale)}>{supportedLocales.map((item) => <option value={item} key={item}>{localeLabel(item)}</option>)}</select></label>}
              <label className="cms-meta-field">
                <span>{t("Title")}</span>
                <input className="cms-title-input" value={fields.title} onChange={(event) => updateTitle(event.target.value)} placeholder={t("Untitled document")} />
              </label>
              <label className="cms-meta-field">
                <span>{t("Description")}</span>
                <textarea className="cms-description-input" value={fields.description} onChange={(event) => updateField('description', event.target.value)} placeholder={t("Add a concise summary for your readers")} rows={2} />
              </label>
            </div>
            <section className="cms-editor-field" aria-label={t("Content")}>
              <header className="cms-editor-field-header"><span>{t("Content")}</span></header>
              <div className="cms-simple-editor"><PageLinksContext.Provider value={{
                pages: treeItems.filter((item) => item.kind === 'document' && item.documentId).map((item): PageLinkOption => {
                  const targetLocale = item.translationLocales.includes(locale) ? locale : defaultLocale;
                  return { id: item.documentId!, title: item.name, path: navigationPath(item.id, treeItems), locale: targetLocale, draft: item.translationStates.find((state) => state.locale === targetLocale)?.state === 'draft' };
                }),
                loadPage: async (id) => {
                  const item = treeItems.find((item) => item.documentId === id);
                  if (!item) throw new Error('Missing page');
                  const targetLocale = item.translationLocales.includes(locale) ? locale : defaultLocale;
                  const page = id === current.id && targetLocale === locale ? { ...current, contentJson: editor?.getJSON() ?? current.contentJson } : await api<DocumentRecord>(`/documents/${id}`, {}, targetLocale);
                  return { id, title: page.title, locale: targetLocale, path: navigationPath(item.id, treeItems), content: page.contentJson };
                },
              }}><SimpleEditor content={emptyContent} extensions={documentExtensions} onEditorReady={setEditor} onUpdate={(updatedEditor) => {
                const contentJson = updatedEditor.getJSON();
                editVersion.current += 1;
                setHasPendingImages(hasPendingImageUpload(contentJson));
                const baseline = savedDocument.current;
                if (!baseline) {
                  setIsDirty(true);
                  return;
                }
                const changed = hasDocumentChanges(baseline, fieldsRef.current, contentJson);
                setIsDirty(changed);
                queueLocalDraft(baseline, fieldsRef.current, contentJson);
              }} onUploadError={(error) => showNotice(message(t("Image upload failed: {error}"), { error: error.message }), true)} isAllowedMediaUrl={isAllowedPastedMediaUrl} onRejectedPastedMedia={(count) => showNotice(message(t("{count} pasted images or videos were skipped because the URL is local or insecure. Upload media to include it."), { count }))} onEmbedYoutube={openYoutubeDialog} uploadImage={async (file) => {
                const uploaded = await upload(file);
                if (!uploaded) throw new Error('Image upload failed');
                return uploaded.url;
              }} /></PageLinksContext.Provider></div>
            </section>
            {current.id && <section className="cms-danger-zone" aria-label={t("Danger zone")}><div><h2>{t("Delete page")}</h2><p>{t("Permanently remove this page and its translations.")}</p></div><button className="cms-button cms-button-danger cms-button-danger-quiet" type="button" disabled={isSaving} onClick={() => void remove()}>{t("Delete page")}</button></section>}
          </section>
        </>}
      </main>
    </div>

    {isRevisionOpen && <div className="cms-revision-backdrop" role="presentation" onMouseDown={() => setIsRevisionOpen(false)}><aside className="cms-revision-drawer" role="dialog" aria-modal="true" aria-labelledby="revision-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h2 id="revision-history-title">{t("Publication history")}</h2><p>{t("New versions are recorded when you publish. Restore updates the draft. Published versions and versions used by builds cannot be deleted.")}</p></div><button type="button" className="cms-close-settings" onClick={() => setIsRevisionOpen(false)} aria-label={t("Close revision history")}>×</button></header>{revisions.length === 0 ? <p className="cms-revisions-empty">{t("No publication history yet. Save draft, then publish to record a version.")}</p> : <div className="cms-revisions">{revisions.map((revision) => <div className="cms-revision" key={revision.id}><span><strong>{t("Revision {revision}", { revision: revision.revision })}</strong><time>{new Date(revision.createdAt).toLocaleString(language)}</time></span><div className="cms-revision-actions"><button type="button" disabled={isSaving || isDirty || hasVersionConflict || Boolean(localDraftConflict)} title={isDirty ? t("Save or discard your edits before restoring") : t("Restore to draft only")} onClick={() => void restore(revision)}>{t("Restore to draft")}</button><button type="button" disabled={isSaving || isDirty || hasVersionConflict || Boolean(localDraftConflict) || !revision.canDelete} title={!revision.canDelete ? t("This version is published or used by a build.") : undefined} onClick={() => void removeRevision(revision)}>{t("Delete")}</button></div></div>)}</div>}</aside></div>}

    {isMediaPickerOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsMediaPickerOpen(false)}>
      <section className="cms-media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-library-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h1 id="media-library-title">{t("Media library")}</h1><p>{t("Select an image or video to add it at the cursor.")}</p></div><button type="button" className="cms-close-settings" onClick={() => setIsMediaPickerOpen(false)} aria-label={t("Close media library")}>×</button></header>
        <div className="cms-media-dialog-actions"><label className="cms-upload">{t("Upload media")}<input type="file" accept={mediaTypes} onChange={(event) => void upload(event.currentTarget.files?.[0])} /></label></div>
        <div className="cms-media-grid">{media.length === 0 ? <p className="cms-media-empty">{t("No media uploaded yet.")}</p> : media.map((item) => <article key={item.id} className="cms-media-card"><button type="button" className="cms-media-insert" onClick={() => insertMedia(item)}><span className="cms-media-preview">{item.contentType.startsWith('image/') ? <img src={item.url} alt="" /> : <video src={item.url} muted preload="metadata" />}</span><strong>{item.fileName}</strong><span>{item.contentType.startsWith('image/') ? t("Image") : t("Video")}</span></button><footer><span className={item.isUsed ? 'cms-media-usage cms-media-usage-used' : 'cms-media-usage'}>{item.isUsed ? t("Used") : t("Unused")}</span></footer></article>)}</div>
      </section>
    </div>}
    {isYoutubeDialogOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsYoutubeDialogOpen(false)}>
      <section className="cms-youtube-dialog" role="dialog" aria-modal="true" aria-labelledby="youtube-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h1 id="youtube-dialog-title">{t("Embed YouTube video")}</h1><p>{t("Paste a YouTube or youtu.be URL.")}</p></div><button className="cms-close-settings" type="button" onClick={() => setIsYoutubeDialogOpen(false)} aria-label={t("Close")}>×</button></header>
        <label className="cms-meta-field"><span>{t("YouTube URL")}</span><input autoFocus type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') insertYoutube(); }} placeholder="https://www.youtube.com/watch?v=…" /></label>
        <footer><button className="cms-button" type="button" onClick={() => setIsYoutubeDialogOpen(false)}>{t("Cancel")}</button><button className="cms-button cms-button-primary" type="button" onClick={insertYoutube}>{t("Embed video")}</button></footer>
      </section>
    </div>}
    {isFolderDialogOpen && <div className="cms-media-backdrop" role="presentation" onMouseDown={() => setIsFolderDialogOpen(false)}><section className="cms-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="new-folder-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h1 id="new-folder-title">{t("New folder")}</h1><p>{folderParent ? t("Create inside {name}.", { name: folderParent.name }) : t("Create at the top level.")}</p></div><button type="button" className="cms-close-settings" onClick={() => setIsFolderDialogOpen(false)} aria-label={t("Close")}>×</button></header><label className="cms-meta-field"><span>{t("Name")}</span><input autoFocus value={folderDraft.name} onChange={(event) => setFolderDraft((draft) => ({ ...draft, name: event.target.value, slug: draft.slug || slugify(event.target.value) }))} placeholder={t("Getting started")} /></label><label className="cms-meta-field"><span>{t("URL segment")}</span><input value={folderDraft.slug} onChange={(event) => setFolderDraft((draft) => ({ ...draft, slug: normalizeSlugInput(event.target.value) }))} onBlur={() => setFolderDraft((draft) => ({ ...draft, slug: slugify(draft.slug) }))} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={120} placeholder="getting-started" /></label><footer><button className="cms-button" type="button" onClick={() => setIsFolderDialogOpen(false)}>{t("Cancel")}</button><button className="cms-button cms-button-primary" type="button" disabled={isSaving} onClick={() => void createFolder()}>{t("Create folder")}</button></footer></section></div>}
  </div>;
}

const root = document.querySelector('#admin-root');
if (!root) throw new Error('Admin root is missing.');
createRoot(root).render(<AdminLanguageProvider><App /></AdminLanguageProvider>);
