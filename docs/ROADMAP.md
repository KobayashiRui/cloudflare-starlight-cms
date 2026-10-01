# Roadmap

Current release preparation and remaining work. The implemented design is documented in [Architecture](ARCHITECTURE.md); publishing instructions are in [Releasing](RELEASING.md). Detailed development history is available in Git.

## v1.1.0 — Page links, tables and storage cleanup

Prepared changes:

- Link to saved pages and optional headings from the editor, retaining destinations through saving and reopening and resolving URLs in Preview and published Docs.
- Add official Tiptap table controls for rows, columns, headings, merged cells and resizing, with standard, striped and minimal designs and cell alignment.
- Keep table colors in shared CSS rather than adding color selection. Use result-oriented header labels and the same transparent toolbar button style as other controls.
- Add older-history deletion, configurable retention (unlimited by default), and unused-media collection after a verified successful deployment.
- Include the tree UX and development startup improvements prepared for v1.0.4 below.

Verification:

- `npm run release:check` passed: type checks, all 81 tests including managed published Astro builds, an empty-site build, and a Worker dry run.
- Packed `create-starlight-cms-1.1.0.tgz` and verified new project generation from the actual package, including the Linux native binding lockfile check.
- The table toolbar's normal background was verified transparent in dark mode while editing a table.

Migration `0003_build_cleanup.sql` adds build-reference protection and media deletion claims; bundled bootstrap applies its idempotent CREATE statements. No dependency addition is required. Existing Workers Builds projects must use `npm run deploy`. npm publication and production deployment have not been performed.

## v1.0.4 — Tree UX and development startup

Prepared changes:

- Show consistent Unsaved and Ready to publish states in the tree and editor.
- Separate folder selection from arrow-button expansion, while retaining keyboard controls.
- Preserve folder expansion after drag and drop and disable automatic expansion on drag hover.
- Align folder/page labels at the same tree depth.
- Preserve Admin assets during initial development startup and public-site rebuilds. Check Admin JS/CSS readiness before reporting startup complete.
- Simplify the documentation around the current implementation, use English for documents without a Japanese counterpart, and remove obsolete plans and handoff prompts.

Verification:

- `npm run publish:cli -- --dry-run` passed: type checks, 55 tests including a published Astro build, an empty-site build, and a Worker dry run.
- Packed `create-starlight-cms-1.0.4.tgz` and verified project generation.
- A newly generated project with an empty local database kept Admin HTML/JS/CSS at HTTP 200 during first startup and rebuilds after publication/deletion. Public routes, Preview, and obsolete-route removal passed.
- Real Admin checks covered folder selection, keyboard controls, and expansion state after reordering. Label alignment passed type/build checks; dedicated visual verification was not completed at that step.

No database migration or production build/deploy configuration change is required. Existing projects receive the changes through CLI upgrades. npm publication and push have not been performed during this preparation.

## Page and heading links — 2026-10-01

Implemented:

- Extend the official Tiptap Link through its public extension API, retaining standard Link commands and ordinary URL links.
- Search saved pages, including drafts, and select an optional H1–H6 heading from the existing link UI on desktop and mobile.
- Store page IDs and heading anchors in Tiptap JSON; derive paths from navigation without a build and resolve public links from one published snapshot.
- Navigate between saved drafts through protected Preview routes; same-page headings use fragments.
- Validate references before publication and deletion, and again during public export. Same-language targets use default-language fallback when needed.
- Preserve link selections through saving/reopening and clipboard HTML attributes. Heading renames and reordered duplicates require reselection.

No database migration, dependency addition, or deployment configuration change is required.

Verification:

- Type checks and all 62 tests passed, including actual published Astro builds and H1 anchors.
- Empty-site build and Worker dry run passed.
- An isolated local Worker and test database verified selecting an unpublished page's H2, saving, reopening, and editing destinations while retaining link text. Desktop and 390px-wide screenshots verified labeled controls, readable URLs, an explicit apply button, and a Popover contained within the viewport. Link editing opens from the toolbar and does not interrupt typing.
- Automated integration covers draft Preview, batch publication, Japanese and duplicate heading IDs in public HTML, URL changes, unchanged public content after draft saves, rejected broken publications, and referenced-page deletion.

No npm publication or production deployment was performed.

Commit review fixes — 2026-10-01:

- Preserve literal heading text through escaped inline HTML within Markdown headings. The picker, public HTML, Preview, and Astro TOC now agree for edge spaces, punctuation, formatting, line breaks, and duplicates.
- Render Preview tabs as labeled sections, matching public Docs, so headings in every section are visible when navigating by fragment.
- Type checks, all 64 tests (including published Astro builds), an empty-site build, Worker dry run, and `git diff --check` passed. Regression cases cover heading IDs and TOC metadata, literal HTML safety, and links into the second tab's content.

## Tables and design — 2026-10-01

Implemented:

- Use official Tiptap table commands for insertion, row/column editing, header toggles, merging/splitting and resizing.
- Add standard, striped and minimal table designs and left/center/right cell alignment.
- Preserve design, merged-cell spans, column widths and rich cell content through JSON saves and reopening.
- Share safe HTML table rendering and CSS across Preview and public Docs, including light/dark mode and horizontal scrolling. Public export continues to reject Admin media URLs.
- Keep table cell headings as formatting outside the page TOC/link picker so page heading IDs remain consistent.
- Highlight the table toolbar button only while its menu is open or hovered; placing the cursor in a table no longer leaves the button highlighted.
- Validate table styles, alignment, spans and widths; never emit arbitrary pasted styles. Keep table controls reactive to cell selection and portal submenus outside the scrolling parent menu.

No dependency addition, database migration or deployment configuration change is required.

Verification:

- Type checks and all 72 tests passed, including an actual published Astro build, saved-draft Preview, JSON reopening, official merge/split operations, escaped rich content, rejected malformed design values and immutable publication snapshots.
- Empty-site build and Worker dry run passed.
- An isolated local Worker/database verified insertion, design selection, row addition, column resizing and saved reopening. Light/dark display and a 390px-wide design submenu were checked visually; submenus use a Portal to avoid clipping by the scrolling parent menu.

The enhanced official Table Node UI is available under Tiptap's Start plan and Pro license, rather than MIT. It was not adopted into this MIT-distributed template.

No npm publication or production deployment was performed.

## Recent milestones

| Version | Changes |
| --- | --- |
| 1.1.0 (prepared) | Page/heading links, table designs, revision deletion/retention and unused-media cleanup |
| 1.0.4 (prepared) | Tree interaction improvements and reliable local Admin assets |
| 1.0.3 | English/Japanese Admin UI, separate display-language settings, simpler save/publication controls, and save-conflict/upload fixes |
| 1.0.2 | Recovery for legacy HTTP/private-network media without allowing new unsafe media URLs |
| 1.0.1 | Navigation selection, temporary unsaved pages, creation destinations, and clearer setup documentation |
| 1.0.0 | Stable Docs CMS scope: static Starlight site, React Admin, D1/R2, drafts/revisions, document languages, Access, build requests, and CLI upgrades |

## Remaining work

- Support videos larger than 10 MiB through R2 multipart uploads.
- Verify production-specific integration in a real Cloudflare environment: Access protection and bypass prevention, resource provisioning, Workers Builds, Deploy Hook delivery, and token rotation. Local checks and dry runs do not establish production success.
- Investigate the reported D1 provisioning response after resource deletion; see [Troubleshooting](TROUBLESHOOTING.md#automatic-d1-provisioning-reports-an-existing-database).

## Scope

Keep the CMS focused on documentation and use existing React, Tiptap, Headless Tree, Hono, Drizzle, Astro/Starlight, Pagefind, and Cloudflare components. No general collection builder, CMS plugin/workflow engine, custom authentication, roles, or collaborative editing is planned. New originals can remain in private R2; any retained legacy public R2 domain still exposes old Draft URLs.

### Table usability — 2026-10-01

- Header actions describe the result (heading/regular), reflecting the official command behavior: first row, first column, or selected cells. Japanese labels use マス rather than セル.
- Removed cell color selection and attributes. Header and striped-row colors come from shared CSS; table design selection remains standard/striped/minimal. No custom color picker or HEX input is included.
- The table toolbar button no longer stays highlighted merely because the cursor is inside a table.

- Follow-up: explicitly use the toolbar’s ghost button style for Table. The Button primitive defaults to a tinted background, which made Table appear hovered even after its active state was removed.

### History and static published media — 2026-10-01

- Added deletion of older unprotected publication history and `src/cms.config.ts` retention (`null` by default; positive integers per translation). Saved drafts, retained history, current publications, concurrent builds and uploads younger than 24 hours remain protected. Atomic deletion claims/save guards prevent references during collection; R2 failures keep metadata for retry.
- R2 remains the original store with the existing bucket/keys and immutable stored revisions. Editor, Preview and browser draft recovery resolve registered originals through the protected Admin media API. Legacy public URLs use the same registered keys, without a second URL map, data backfill or re-upload.
- `npm run build` copies only published managed images/videos/downloads to `dist/_cms-media/`, using the existing Access credentials and media APIs. OSS Markdown/HTML parsers resolve destinations without rewriting code/prose. Each immutable key is downloaded once per build; missing/mismatched files fail the build. External media stays external.
- After Astro/Admin build and media copies succeed, build-time bounded collection prunes unprotected history and deletes unreferenced R2/D1 media. Builds release their lease on success/failure; abandoned leases expire after 24 hours. Deleted-page originals stay protected while another build is reading them.
- Removed the custom deploy script, post-deploy confirmation/renewal endpoints and standalone cleanup command. `npm run deploy` is a plain Wrangler alias; Workers Builds can keep `npx wrangler deploy`. No Cron, Queue, media-management page or Admin-open requirement was added.
- Removed `MEDIA_PUBLIC_URL` from new configuration and regenerated binding types. Existing variables may remain unused. Both deployment/troubleshooting guides describe private originals and static delivery, retention, file limits and migration.
- Upgrade needs no additional Publish or migration command: the first build uses existing export/list/object APIs when the build lease endpoint is absent (404 only), copies media, and skips collection. Collection remains disabled until the live site carries the static-media marker, so failed migration deployments cannot break legacy production images. Pre-migration rollback/external direct links require the old R2 domain and originals; static version rollback restores assets, not D1/R2 state.
- Uploads remain limited to 10 MiB. Future larger-video support must account for Static Assets' 25 MiB per-file limit; no speculative hybrid delivery was introduced. Total file limits include Docs/Admin/Pagefind, and repeated build-time downloads still incur R2 reads.
- Documentation follow-up: README and both deployment guides explicitly state that R2 Custom Domain setup is unnecessary and explain when existing users may detach it, while retaining the original bucket/binding and documenting legacy rollback/direct-link requirements.
- Validation includes an actual Astro build through emulated old APIs, image/video byte copies, unchanged legacy stored JSON, protected Editor/Preview URLs, later build-time GC, concurrent-build protection, retention/deletion retries, and strict redirect/authentication failure handling. All 81 tests and type checks passed, including real published Astro builds; empty-site build, Worker dry run and `git diff --check` passed. Packed CLI generation and a generated project’s clean `npm ci` plus empty build passed. Lockfile metadata was regenerated for reproducible clean installation.

References: [Version contents](https://developers.cloudflare.com/workers/versions-and-deployments/), [Static Assets limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Upload reuse](https://developers.cloudflare.com/workers/static-assets/direct-upload/).

No npm publication or production deployment was performed.
