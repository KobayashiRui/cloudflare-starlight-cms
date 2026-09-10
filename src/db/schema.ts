import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const folder = sqliteTable('folder', {
  id: text('id').primaryKey(), parentId: text('parent_id'), name: text('name').notNull(), slug: text('slug').notNull(),
  order: integer('sort_order').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});

export const document = sqliteTable('document', {
  id: text('id').primaryKey(), folderId: text('folder_id'), title: text('title').notNull(), slug: text('slug').notNull(),
  description: text('description').notNull(), contentJson: text('content_json').notNull(), publishedRevisionId: text('published_revision_id'),
  status: text('status', { enum: ['draft', 'published'] }).notNull(), version: integer('version').notNull(), order: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(), publishedAt: integer('published_at'),
});

export const documentRevision = sqliteTable('document_revision', {
  id: text('id').primaryKey(), documentId: text('document_id').notNull(), revision: integer('revision').notNull(), title: text('title').notNull(),
  slug: text('slug').notNull(), description: text('description').notNull(), contentJson: text('content_json').notNull(), createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('document_revision_document_revision').on(table.documentId, table.revision)]);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(), objectKey: text('object_key').notNull().unique(), fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(), size: integer('size').notNull(), createdAt: integer('created_at').notNull(),
});
