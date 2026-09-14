import Dexie, { type EntityTable } from 'dexie';
import type { JSONContent } from '@tiptap/core';
import type { SupportedLocale } from '../locales';

export type LocalDocumentDraft = {
  key: string;
  documentId: string;
  locale: SupportedLocale;
  baseVersion: number;
  title: string;
  slug: string;
  description: string;
  folderId: string | null;
  order: number;
  contentJson: JSONContent;
  updatedAt: number;
};

const database = new Dexie('cloudflare-starlight-cms-editor') as Dexie & {
  documentDrafts: EntityTable<LocalDocumentDraft, 'key'>;
};

database.version(1).stores({
  documentDrafts: 'key,documentId,locale,updatedAt',
});

export function localDocumentKey(documentId: string, locale: SupportedLocale) {
  return `${documentId}:${locale}`;
}

export function readLocalDocumentDraft(documentId: string, locale: SupportedLocale) {
  return database.documentDrafts.get(localDocumentKey(documentId, locale));
}

export function writeLocalDocumentDraft(draft: LocalDocumentDraft) {
  return database.documentDrafts.put(draft);
}

export function removeLocalDocumentDraft(documentId: string, locale: SupportedLocale) {
  return database.documentDrafts.delete(localDocumentKey(documentId, locale));
}

export function listLocalDocumentDrafts() {
  return database.documentDrafts.toArray();
}
