import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const folder = sqliteTable('folder', {
  id: text('id').primaryKey(), parentId: text('parent_id'), slug: text('slug').notNull(),
  order: integer('sort_order').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const folderTranslation = sqliteTable('folder_translation', {
  folderId: text('folder_id').notNull(), locale: text('locale').notNull(), name: text('name').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (table) => [uniqueIndex('folder_translation_folder_locale').on(table.folderId, table.locale)]);

export const document = sqliteTable('document', {
  id: text('id').primaryKey(), folderId: text('folder_id'), slug: text('slug').notNull(), order: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const documentTranslation = sqliteTable('document_translation', {
  id: text('id').primaryKey(), documentId: text('document_id').notNull(), locale: text('locale').notNull(), title: text('title').notNull(),
  sidebarLabel: text('sidebar_label'), description: text('description').notNull(), contentJson: text('content_json').notNull(),
  publishedRevisionId: text('published_revision_id'), version: integer('version').notNull(), createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(), publishedAt: integer('published_at'),
}, (table) => [uniqueIndex('document_translation_document_locale').on(table.documentId, table.locale)]);

export const documentRevision = sqliteTable('document_revision', {
  id: text('id').primaryKey(), documentTranslationId: text('document_translation_id').notNull(), revision: integer('revision').notNull(), title: text('title').notNull(),
  sidebarLabel: text('sidebar_label'), description: text('description').notNull(), contentJson: text('content_json').notNull(), createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('document_revision_translation_revision').on(table.documentTranslationId, table.revision)]);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(), objectKey: text('object_key').notNull().unique(), fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(), size: integer('size').notNull(), createdAt: integer('created_at').notNull(),
});
