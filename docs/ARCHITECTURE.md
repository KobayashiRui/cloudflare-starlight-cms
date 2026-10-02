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
| `document_revision` | Publication snapshots (retained content is immutable) |
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

## Tables

The official Tiptap Table, TableRow, TableHeader and TableCell extensions provide insertion, row/column operations, header toggles, cell merge/split and column resizing. The toolbar adds a 3 × 3 table with a header row. `tableStyle` selects standard, striped or minimal borders. Cell alignment uses the official `align` attribute.

Design attributes, spans and column widths stay in Tiptap JSON through saving and reopening. The official resizable TableView is extended only to mirror `tableStyle` into its DOM. Shared CSS applies to the Editor, Preview and public Docs, including light/dark colors and horizontal scrolling. Colors are controlled by shared CSS, with no cell color attributes or color picker, and rendering validates alignment, spans and widths before emitting HTML.

Public tables use escaped HTML rather than Markdown pipe tables, retaining merged cells, literal punctuation, rich blocks and column sizing. Preview uses the same table rendering code, while public rendering resolves managed media to Static Assets paths. Cell headings remain visible formatting but do not enter the page TOC or heading-link picker, matching Astro's treatment of headings inside HTML tables.

## Page and heading links

The official Tiptap Link mark is extended with nullable `documentId` and `anchor` attributes; its name and standard commands are retained. `href` remains a normal URL for editor rendering and clipboard HTML, while the page ID is authoritative for CMS internal links. Ordinary URL links remain supported.

The link picker searches saved pages by title/path and optionally selects H1–H6 headings. Draft pages are selectable. The current page's heading list uses the editor content; other pages use saved drafts. New pages must be saved once before they can be selected. Links inherit the source document language, falling back to the default language when that target translation is unavailable.

Public paths are calculated from the current navigation tree without building. Export resolves internal references against the same published snapshot used for rendering; page moves and slug changes therefore update links on the next build without rewriting revisions. Same-page heading links become fragments. Preview resolves references to saved drafts on protected Admin preview routes; unavailable draft targets render as ordinary text.

Publication validates links against existing public revisions plus the saved translations being published, before creating revisions or requesting the Hook. Deletion checks the remaining published content. Export validates again, so stale or missing page/heading targets fail the build. These checks apply to CMS page references, not manually entered URLs.

Heading anchors use `github-slugger`, matching the public renderer and Preview, including duplicate-heading suffixes and the tab-label headings emitted by public Markdown. Heading renames or reordered identical headings require link reselection; no persistent heading IDs or link-index tables are introduced.

Heading text is rendered as escaped inline HTML inside Markdown headings, preserving literal punctuation, formatting, and edge spaces while retaining Astro's heading IDs and TOC metadata. Preview displays every tab as a labeled section, matching public Docs, so links into any tab's content remain visible.

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

R2 holds media objects; D1 holds metadata. The Admin adds upload, selection, and insertion controls. Worker uploads support PNG, JPEG, WebP, AVIF, MP4, and WebM up to 10 MiB, checking actual format, Content-Type, and size. Partial storage failures are handled, and media referenced by saved drafts, retained publications, the deployed site or in-flight builds stays protected. The insert picker has no deletion controls.

R2 is the original store for uploads, saved drafts and retained publication history. Editor and Preview resolve registered object keys to the Access-protected Admin media proxy. Existing public R2 URLs are resolved by their registered object keys without rewriting stored JSON or adding a URL mapping table. External HTTPS media remains external.

`npm run build` obtains the published snapshot and media metadata with the existing Access Service Token, resolves managed image/video/download destinations, and copies each used original once to `dist/_cms-media/<uuid>.<ext>`. Markdown and embedded HTML are parsed with existing OSS parsers; prose/code examples are not rewritten. Required downloads must match metadata; missing files fail the build. Public Docs and their managed media use Static Assets without runtime R2 reads. R2 public domains and `MEDIA_PUBLIC_URL` are unnecessary; an old variable may remain unused. Keeping an old public domain also keeps old Draft URLs public.

`src/cms.config.ts` sets `maxPublicationRevisions` to `null` by default, or a positive count per translation including the current publication. The History drawer can delete unprotected older revisions. Deletion never changes publication or requests its own build.

Managed builds pin their published references in `cms_build` with a 24-hour lease. Once Astro, Admin assets and all required media have completed, the Node build script drives bounded history pruning/media collection batches of at most ten. It releases its lease on success or failure; crashed builds expire. Drafts, retained history, current publications and concurrent builds remain protected. Uploads receive a 24-hour grace period. Atomic deletion claims/save guards prevent references being introduced during deletion; R2 deletion precedes D1 metadata removal, with failed claims retained for retry on the next build. Publish without content changes can request another build.

The first upgrade build can use the old Worker's existing snapshot/list/object APIs if the lease API is absent (404, or 405 for the initial POST probe); it skips collection. Collection also stays disabled while live Static Assets lacks the static-media marker, protecting legacy production through failed migration deployments. Future builds collect without deploy callbacks, Cron, Queues or a custom deploy command. Static-media version rollbacks include their media files, but never restore D1/R2 state. Pre-migration rollbacks/external direct links require the old R2 originals and domain; collection does not preserve these forever. Custom Astro pages must use separately managed assets.

Uploads remain limited to 10 MiB. Static Assets permits 25 MiB per file and the total deployed file count includes Docs, Admin, Pagefind and media. Large-video multipart upload and its delivery design remain future work. Build-time downloads still incur R2 reads even though public browsing does not.

## Development and database initialization

`npm run dev` applies local migrations, builds/watches Admin into `.dev-assets/admin`, and starts the local Worker on 8787. Astro builds public Docs into `dist`; the coordinator synchronizes public output into `.dev-assets` without removing Admin, and serves Docs preview on 4321. Published-snapshot changes trigger rebuilds. Startup checks both export and Admin JS/CSS readiness.

Production uses `npm run build` and `npx wrangler deploy`, with `dist` containing both public and Admin assets. D1/R2 use Automatic Resource Provisioning. Bundled idempotent CREATE migrations initialize D1 before management database access and are recorded in `d1_migrations`. Failure returns 503 and permits retry. Public assets and Admin HTML do not initialize D1. Future ALTER/backfill migrations require an explicit upgrade procedure that preserves data.

## CLI and upgrades

`packages/create-starlight-cms` is a dependency-free Node ESM CLI, not a CMS runtime package. `scripts/prepare-create-template.mjs` generates its ignored template from the root application during packing. Never edit the generated template directly.

Generation creates an English-only My Docs project in a new or empty directory, sets package/Worker names, and records the template version. It rejects symlinks and existing project files, preserves allowed Git metadata, and does not install dependencies, initialize Git, log in, or deploy. Secrets, build output, local databases, and repository-only release documents are excluded; licenses and notices are retained.

Upgrade compares the recorded template, current template, and project. It defaults to a dry run; `--apply` updates unchanged managed files and stops on conflicts. User configuration is preserved, files are not automatically deleted, and dependency changes require `npm install` to update the lockfile. Existing migrations are retained rather than rewritten. Missing template history or conflicts require manual reconciliation.
