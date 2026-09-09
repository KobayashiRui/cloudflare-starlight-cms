import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  section: text('section').notNull(),
  order: integer('sort_order').notNull(),
  contentJson: text('content_json').notNull(),
  draftRevisionId: text('draft_revision_id').notNull(),
  publishedRevisionId: text('published_revision_id'),
  status: text('status', { enum: ['draft', 'published'] }).notNull(),
  version: integer('version').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  publishedAt: integer('published_at'),
});

export const documentRevisions = sqliteTable('document_revisions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  revision: integer('revision').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull(),
  section: text('section').notNull(),
  order: integer('sort_order').notNull(),
  contentJson: text('content_json').notNull(),
  createdAt: integer('created_at').notNull(),
  authorSubject: text('author_subject'),
  authorEmail: text('author_email'),
}, (table) => [uniqueIndex('document_revisions_document_revision').on(table.documentId, table.revision)]);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
  authorSubject: text('author_subject'),
  authorEmail: text('author_email'),
});
