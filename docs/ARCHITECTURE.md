# Architecture

One repository, one Cloudflare Worker. React provides the Admin, D1 stores content, R2 stores media, and Astro/Starlight generates public Docs with Pagefind search.

For installation and operations, see [Deployment](DEPLOYMENT.md) and [Troubleshooting](TROUBLESHOOTING.md).

## Routing and access

- Public Docs are served from Workers Static Assets without runtime D1 or API calls.
- `/admin` only redirects to `/admin/`. `/admin/*`, including management assets, APIs, export, and Preview, runs through the Worker.
- One Cloudflare Access application protects `admin/*` in production. Human access uses an Allow policy; Workers Builds uses a Service Auth policy in the same application.
- The Worker uses Hono for routes and CSRF checks on mutations. It does not implement accounts, sessions, roles, or Access JWT validation. Everyone admitted by Access has the same management privileges.
- Local Wrangler runs on localhost without authentication. `workers_dev` and preview URLs stay disabled in production.

The build Service Token can access the Admin as well as export. Treat the build environment as trusted and rotate the token and build secrets if exposed.

## Content and navigation

| Storage | Purpose |
| --- | --- |
| `folder` / `document` | Shared identity, parent, URL segment, and order |
| `folder_translation` | Folder names by locale |
| `document_translation` | Current editable title, description, content, and version |
| `document_revision` | Immutable publication snapshots |
| `published_revision_id` | The revision currently used by public export |
| `publish_delivery` | Build-request delivery and retry records |

Tiptap JSON is the content source. There are no draft-revision pointers or status columns; publication state is derived from the current translation and its published revision.

Save draft and Restore update the current translation. Publish creates a revision and updates the publication pointer. Draft saves do not change public content or its revision timestamp. Restore changes content fields, not navigation. Saves compare versions and reject conflicts rather than silently overwriting another edit.

Folder/page structure and URL segments are shared across locales. A null parent represents the root. Slugs must be unique among folders and pages with the same parent. Export walks this tree to generate public paths and the Starlight sidebar.

Navigation changes and deletion take effect independently of content revisions and request a public rebuild. The URL field explains this distinction.

## Admin and editor

The Admin uses React, the official MIT Tiptap Simple Editor source, and Headless Tree. Existing extensions handle standard editing; Docs-specific nodes cover callouts, steps, tabs, and video. YouTube uses the official extension and privacy-enhanced embeds. Unknown content nodes are rejected, and document content is never executed as MDX or JavaScript.

Save draft stores the current editable content. The header Publish button publishes saved changes across all pages and document languages. Unsaved editor changes must be saved first. The editor shows its current state and next action; the tree shows Unsaved or Ready to publish when applicable.

Folder rows select folder settings; arrow buttons expand/collapse. Keyboard selection, expansion, and drag-and-drop use Headless Tree. Reordering preserves expansion state. The API validates destination parents, slug collisions, cycles, and sibling ordering.

For existing pages, Dexie stores unsaved browser edits in IndexedDB with their D1 baseline version. Navigation, locale changes, and reload restore them when versions match; a mismatch offers saved-content reload or local-edit recovery. New pages become eligible after their first save. This is a per-browser recovery buffer, not synchronization or collaborative editing.

## Languages

Document languages, site title, and public URL are configured in `src/site.config.ts`. Navigation uses the default locale; document/folder translations are edited separately. Default-locale public paths are unprefixed, other locales use prefixes, and untranslated routes use Starlight's default-language fallback. The Admin remembers the last editing locale.

Create content in the default locale, then copy existing content to add translations. Changing the default locale after content exists requires a data-migration plan; configuration changes do not translate or convert existing data automatically.

Admin display language is independent of document language. `src/admin.config.ts` defines available languages and the fallback; `src/admin/i18n/` holds typed dictionaries. Selection precedence is saved preference, supported browser language, then configured fallback. React Context changes text without losing edits or recreating the editor. Configuration and translation changes require rebuilding Admin assets.

## Preview and public builds

`/admin/preview/:documentId?locale=` displays a saved draft inside the normal Starlight preview shell. The Worker reads the built shell through `ASSETS` and inserts safely rendered draft content with HTMLRewriter. Preview uses Access, `private, no-store`, and `noindex`; it does not trigger Astro, Pagefind, or a Deploy Hook.

Preview shares the site's layout, theme, user CSS, and heading/TOC structure, and can use the authenticated Admin media proxy. It does not rerun arbitrary build-time MDX/remark transforms or Shiki in the Worker.

`/admin/export/snapshot` returns a versioned, consistent snapshot of all published content and navigation. The export DTO is separate from the database schema. Astro configuration and the content loader share one fetched snapshot per build. Validation or rendering failures fail the build instead of falling back to demo or empty content.

Publication pointers and delivery records are persisted together before requesting the Deploy Hook. Hook acceptance means a build was requested, not that deployment completed. Failed and expired pending requests can be retried from the Admin. Without a Hook URL, local deliveries are marked skipped.

## Media

R2 holds media objects; D1 holds metadata. The Admin adds upload, selection, and insertion controls. Worker uploads support PNG, JPEG, WebP, AVIF, MP4, and WebM up to 10 MiB, checking actual format, Content-Type, and size. Partial storage failures are handled, and media referenced by drafts, publications, or history cannot be deleted; browser drafts also prevent deletion locally.

Published media requires a public HTTPS URL or supported site-relative path. Admin-only URLs, HTTP media, and private-network hosts cannot be published. Normal HTTP(S) links remain supported. Unsafe pasted media is removed; legacy unsafe nodes are repaired to explanatory text when opened. Incomplete upload blocks cannot be saved.

Configure a separate R2 custom domain through `MEDIA_PUBLIC_URL`. Draft media stored at a public R2 URL is also public. Multipart uploads for larger videos remain future work.

## Development and database initialization

`npm run dev` applies local migrations, builds/watches Admin into `.dev-assets/admin`, and starts the local Worker on 8787. Astro builds public Docs into `dist`; the coordinator synchronizes public output into `.dev-assets` without removing Admin, and serves Docs preview on 4321. Published-snapshot changes trigger rebuilds. Startup checks both export and Admin JS/CSS readiness.

Production uses `npm run build` and standard `npx wrangler deploy`, with `dist` containing both public and Admin assets. D1/R2 use Automatic Resource Provisioning. Bundled idempotent CREATE migrations initialize D1 before management database access and are recorded in `d1_migrations`. Failure returns 503 and permits retry. Public assets and Admin HTML do not initialize D1. Future ALTER/backfill migrations require an explicit upgrade procedure that preserves data.

## CLI and upgrades

`packages/create-starlight-cms` is a dependency-free Node ESM CLI, not a CMS runtime package. `scripts/prepare-create-template.mjs` generates its ignored template from the root application during packing. Never edit the generated template directly.

Generation creates an English-only My Docs project in a new or empty directory, sets package/Worker names, and records the template version. It rejects symlinks and existing project files, preserves allowed Git metadata, and does not install dependencies, initialize Git, log in, or deploy. Secrets, build output, local databases, and repository-only release documents are excluded; licenses and notices are retained.

Upgrade compares the recorded template, current template, and project. It defaults to a dry run; `--apply` updates unchanged managed files and stops on conflicts. User configuration is preserved, files are not automatically deleted, and dependency changes require `npm install` to update the lockfile. Existing migrations are retained rather than rewritten. Missing template history or conflicts require manual reconciliation.
