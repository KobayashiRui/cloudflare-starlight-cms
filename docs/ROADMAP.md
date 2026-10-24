# Roadmap

Current release preparation and remaining work. The implemented design is documented in [Architecture](ARCHITECTURE.md); publishing instructions are in [Releasing](RELEASING.md). Detailed development history is available in Git.

## v1.2.0 — WebMCP editing — 2026-10-24

- Set `create-starlight-cms` to 1.2.0 for native WebMCP review and editing across pages and document languages. AI changes share the existing editor, draft saving, conflict detection, Preview and Undo; publication remains an existing Admin UI action. See [WebMCP usage](WEBMCP.md) for browser requirements and supported tools.
- Include the default-language publication consistency fix and the repository-only English/Japanese website. The website and its GitHub Pages workflow are excluded from generated CMS projects.
- No database migration or Cloudflare configuration change is required. Updating the CLI package manifest on `main` triggers the existing npm publication workflow; website publication runs separately.
- `npm run release:check` passed: type checks, all 93 tests including published Astro builds, an empty-site build, Worker dry run, `create-starlight-cms-1.2.0.tgz` packing and project generation from the packed CLI. Confirmed template version 1.2.0 and exclusion of the website/workflow. No npm publication, remote push or production deployment has been performed for this release.

## OSS website — 2026-10-23

Horizontal editing walkthrough — 2026-10-24:

- Replace the vertically pinned editing-to-publication scenes with a native horizontal gallery on phones and desktops, following the card interaction in Apple's "Set to stunning." section. Keep the six real captures and annotations, with part of the next card visible.
- Remove the 700px viewport-height cutoff. Add localized previous/next buttons, a current-step counter, Left/Right and Home/End navigation, and CSS scroll snapping. Native horizontal scrolling remains available without JavaScript; reduced-motion preferences disable smooth navigation. No dependency or CMS runtime changes.
- Verification: website builds and all 122 link/asset checks passed with production-project and localhost URLs; JavaScript syntax and diff checks passed. Browser checks covered English/Japanese, 1280px desktop and 320px/390px mobile layouts (including heights below 700px), button and keyboard navigation, first/last button states, step-counter updates and absence of page-wide horizontal overflow. No deployment was performed.

Walkthrough image quality — 2026-10-24:

- Recapture eight real English/Japanese editing, saved Preview and static public views at 2560 × 1440, rendering the UI at twice its original scale. Use a copy of the existing isolated screenshot database; no production data, publication or deployment is involved. Unsaved sample edits are discarded; saved-state captures use existing saved content.
- Serve losslessly encoded WebP captures directly in the horizontal gallery, preserving the decoded screenshot pixels without further lossy compression. Retain the original JPEG/GIF authoring sources separately. Match the image and SVG annotation aspect ratios at 16:9 and update the control targets from the recaptured UI. No new dependency or CMS runtime source change.
- Verification: decoded WebP pixels match each new capture exactly; all eight assets are 2560 × 1440. Website build and all 122 link/asset checks pass; browser checks confirm full-resolution image loading and updated annotations. The browser capture source uses JPEG compression; this change increases source resolution and avoids additional lossy encoding rather than claiming an uncompressed source.

Search Console ownership verification — 2026-10-24:

- Add the supplied Google site-verification meta tag to the shared website HTML head. It appears on the four English/Japanese public pages; the repository-only website remains excluded from generated CMS projects.
- Document URL-prefix verification, keeping the tag for Google's periodic checks, and replacing it for forks with a different owner.
- Verification: website build and all 122 existing link/asset checks passed. Parsed all four generated HTML documents to confirm exactly one verification tag with the supplied value inside each head; confirmed the website is absent from the CLI template allowlist. Deployment and Search Console ownership confirmation have not been performed.

- Add repository-only `website/` with English and Japanese landing pages and basic usage guides. Lead with visual browser editing and fully static Starlight publication, with native WebMCP AI review/editing examples and browser-support requirements.
- Keep detailed deployment, configuration, troubleshooting, WebMCP and development documents in the existing `docs/`; the website links to these sources rather than migrating or duplicating them. Update both README introductions and add website links.
- Use shared HTML generation, CSS and a small command-copy script, without adding dependencies, another CMS, workspaces or a runtime package. The CLI template allowlist excludes the website and its workflow.
- Include real English/Japanese Admin screenshots captured with sample pages in a separate temporary local D1 database. No production content or existing local database was used.
- Prepare the GitHub Pages workflow with pinned official Actions, PR build/link checks, and publication from `main`. Resolve the base URL through `configure-pages`, including repository subpaths and custom domains. Add canonical/hreflang/social metadata, a sitemap and a 404 page.
- Verification: type checks and all 93 existing tests passed, including published Astro builds; empty-site build passed. All four website pages passed 90 internal link/asset checks plus repository-document and metadata checks, using both a project subpath and a custom-domain root. Browser checks verified image loading, command copying, guide-preserving language switching, and English/Japanese home and guide layouts at 390px without horizontal overflow.
- GitHub Pages has not been enabled or deployed, and changes have not been pushed. Select **GitHub Actions** in repository Settings → Pages before the first deployment. A proposed GitHub Description, including WebMCP, is recorded in `website/README.md`; repository metadata has not been changed.

Website design follow-up:

- Keep the centered introduction and Admin screenshot, with single-color headings and purple limited to primary buttons. Remove the stack endorsement strip, uppercase section slogans, numbered feature decorations and repeated colored promotional panels. Rewrite both languages with shorter product descriptions.
- Replace the language icon/link with a native English/日本語 dropdown that retains the home/guide route and section fragment. Add a System/Light/Dark dropdown; an explicit preference persists across reloads and navigation, and System follows the OS preference. Initialize before CSS to apply the saved theme before rendering; CSS also supports the OS theme without JavaScript.
- Capture matching real light/dark English/Japanese Admin images at 1280 × 720 in the same isolated local database, and switch them with the website theme.
- Website builds and all four localized pages passed 102 internal link/asset and language-route checks with both project-subpath and root URLs. Browser checks verified dropdown navigation, retained section fragments, theme persistence across reload/language/guide navigation, the default OS theme, and 320px/390px layouts without horizontal overflow. CMS runtime and Cloudflare configuration are unchanged.
- Remove the extra label above the hero and sentence-ending punctuation from English/Japanese headings. Keep sentence punctuation in explanatory body text. Rebuild and website link checks passed.

Website adoption follow-up:

- Lead with documentation that the whole team can update after initial setup. Rewrite English/Japanese copy around browser editing, Cloudflare's free allowances, static publication, customization, Access and WebMCP. Keep setup responsibilities and free-tier limits explicit.
- Pair real Admin captures with the same articles in a built Starlight site. Localized article text is included in Japanese captures. Use consistent light Admin imagery and theme-aware public-site captures; replace the feature grid with editing, publishing/cost, AI, ownership/Access and local-start sections.
- Add 18-second English/Japanese workflow excerpts and a 12-second native WebMCP translation/draft excerpt, assembled from actual local browser captures. Native video controls, posters and no autoplay/preload avoid competing with the page. The workflow excerpts omit waiting and are not uninterrupted recordings or evidence of production deployment; publication/building between captures used the local API/CLI.
- Add localized 1200 × 630 JPEG social cards, with temporary SVG composition generation in `website/social.mjs`. Update README introductions and demo links, and keep image URLs absolute so generated CLI project READMEs do not reference the excluded `website/` folder. Prepare repository Description and English/Japanese launch copy in `website/README.md`.
- Verification: type checks and all 93 tests passed; empty-site and actual published English/Japanese Starlight builds passed. Website builds passed 122 link/asset, repository-doc and metadata checks with project-subpath, custom-domain and localhost URLs. Browser checks covered 320px/390px layouts, language/guide navigation, light/dark persistence, anchor links, FAQ/AI disclosures and command copying. All three MP4s decoded and played to their 18/18/12-second ends in the browser.
- No CMS runtime, dependencies, Cloudflare configuration, repository About settings, npm publication or production deployment changed. Existing GitHub Pages publication setup remains prepared for release.

Website GIF and layout follow-up:

- Replace the MP4 excerpts with localized annotated GIFs: four editing/Preview/static-site steps and three WebMCP translation/draft steps. Use real sample screenshots with numbered explanations, target outlines and arrows. Retain capture sources and an optional manual SVG/Pillow authoring pipeline; CI and CMS runtime need no additional dependencies.
- Start with static posters and provide Play/Stop and full-size links. Stop playback when the AI disclosure closes or the tab is hidden. Update both README introductions to show the localized workflow GIF.
- Align the CMS and published-site screenshots horizontally at the same size, with a connecting arrow. Stack them vertically on narrow screens without offsets.
- Verification: all four website pages passed 130 internal link/asset checks, repository-document and metadata checks. Browser checks verified Japanese and English playback/stop, AI-disclosure stop, equal desktop alignment and 320px/390px layouts without horizontal overflow. CMS runtime and dependencies are unchanged; no deployment was performed.

Website theme control follow-up:

- Replace the three-option theme dropdown with a sun/moon icon button matching the CMS interaction. Follow the device preference until the first explicit light/dark selection, then persist that choice. Keep pre-render theme initialization and localized accessible names/tooltips.
- Website build and all 130 link/asset checks passed. Browser verification covered device-matching initial display, both icons/modes, reload and page/language persistence, and keyboard activation. No CMS runtime or dependencies changed.
- Use the exact SunIcon/MoonIcon SVG paths and stroke settings from `src/admin/client.tsx`, with the same 16px icons and 32px button sizing as Admin.

Website scroll and automatic demos follow-up:

- Remove repeated section separators and decorative dividers; use spacing and restrained surfaces for grouping. Keep structural separators inside the terminal/file listing and footer.
- Show both annotated GIFs directly as native looping images, without playback controls or an AI disclosure. Preserve native lazy loading and use static posters for the device's reduced-motion preference. Remove the unused playback script and copy.
- Enlarge the browser-editing and Astro Starlight delivery labels. On desktop, pin the horizontally aligned screens briefly and shift their widths/emphasis with scroll progress. Mobile, short windows, reduced-motion preferences and JavaScript-free views retain a static layout; no animation dependency or scroll interception was added.
- Verification: four localized pages passed 118 link/asset, repository-document and metadata checks. Browser checks verified scroll progress and changing pane widths, visible decoded AI GIF without controls, Japanese 390px and English 320px layouts without overflow. No CMS runtime, dependency or deployment changes.

Sequential introduction and corrected workflow follow-up:

- Replace the side-by-side showcase with a single sticky stage: headline → browser editing → Astro Starlight static delivery. Fade/zoom scenes with scroll and retain readable pauses, including on phones. Short windows, reduced-motion preferences and JavaScript-free views retain vertical content. Inactive scenes cannot take keyboard focus.
- Correct the workflow GIF to six steps: edit, save, open Preview, inspect the draft, choose Publish, then read the deployed static site. Target the enabled Save/Preview/Publish buttons in actual screenshots. Remove the misplaced title outlines/arrows from rendered Preview/public results; identify those scenes in the caption band instead. Keep successful build/deployment distinct from choosing Publish.
- Remove the AI section's GIF and its unused assets/capture sources; keep the explanation, example prompt and WebMCP guide link. Re-encode both localized workflow GIFs as six-frame, 18-second infinite loops.
- Verification: four localized pages passed 114 link/asset, repository-document and metadata checks. Browser checks verified all three desktop scene states, Japanese 390px and English 320px layouts without overflow, mobile scene changes and the short-window fallback. Actual annotation renders were visually checked for Save, Preview and Publish targets and unobscured result pages. No CMS runtime, dependencies or deployment changed.

Individual and team positioning follow-up:

- Broaden English/Japanese hero, metadata and editing copy around running your own docs site and updating it in the browser. Present personal use and team manuals together; nontechnical authorized editors remain a benefit after initial setup. Retain free-tier limits and technical setup requirements.
- Update ownership copy, both README introductions, proposed GitHub Description and launch copy. Regenerate localized social cards and derive their headline from the shared website content.
- Website builds and all 114 link/asset checks passed; visual checks cover the revised hero and localized social cards. CMS runtime and dependencies are unchanged.

Workflow diagram follow-up:

- Group editing/publication, building and static delivery into one flow with aligned icons and connectors. Move infrastructure labels below each action and shorten descriptions. Stack steps with downward arrows on mobile.
- Website build and all 114 link/asset checks passed. Browser verification covered desktop alignment at 1020px, Japanese 390px and English 320px layouts without overflow. CMS runtime and dependencies are unchanged.

Scroll-controlled editing walkthrough follow-up:

- Replace the landing page's looping GIF with six scroll-selected scenes using real editing, Preview and public-site captures. Present descriptions beside the screen (above it on mobile), with inline target outlines/arrows for the editing and publication controls. Remove step counters, numbered chapters and playback imagery from the landing page.
- Keep screens static after a short scene change so readers can stop and inspect them; scrolling backward revisits earlier steps. Short windows, reduced-motion preferences and JavaScript-free views expose all scenes as ordinary content. Retain standalone GIFs for README/sharing and use the existing sample captures for website assets.
- Website builds and all 122 link/asset checks passed. Browser verification covered forward/reverse scene changes, correct publication and Preview screens, absence of embedded GIFs/counters, Japanese 390px and English 320px layouts without overflow, and the short-window static fallback. No CMS runtime, dependencies or deployment changes.

Walkthrough spacing and progress follow-up:

- Add a small, unpadded `1 / 6` counter beside the section heading, updating with the selected scene. Hide it when the static fallback displays all scenes.
- Size the sticky stage from its content and overlap scenes in one grid cell, keeping a 24px heading/content gap across window heights. Fit screens within shorter viewports while preserving annotation alignment.
- Website build and all 122 link/asset checks passed. Browser checks covered tall-window spacing, counter changes and mobile layout. No CMS runtime or dependencies changed.

Full-width walkthrough images follow-up:

- Move step explanations above the screenshots and use the full content width for each image. Keep the heading, explanation, image and note together in the viewport to reduce the large unused lower region. Preserve the small step counter.
- Place captures and annotations in one proportional canvas, with a height-limited viewing window on wide screens. Use ordinary static content below 700px window height. Website build/link checks passed; browser verification covered desktop, tall-window and narrow-screen layout. No CMS runtime or dependencies changed.

Search visibility review:

- Confirmed generated HTML content, per-page titles/descriptions/canonicals, reciprocal localized alternates, social metadata, JSON-LD, public sitemap entries and no `noindex` on the four public pages. All 122 website checks passed with project and localhost URLs.
- Documented the GitHub project-path robots limitation: crawlers read the host-root robots file, not the project's generated subdirectory file. Record direct Search Console sitemap submission and live URL/canonical checks as launch work. Published HTTP behavior, Google indexing and AI-search inclusion remain unverified.
- Reviewed current Google and OpenAI crawler guidance. No special AI-search file or speculative structured data was added; CMS runtime and dependencies are unchanged.

GitHub Actions publication follow-up:

- Confirmed `main` as the repository default branch and kept website deployment restricted to it. PRs and manual runs on other branches only build/check; production runs upload `website/dist/` and use the GitHub Pages deployment environment.
- Keep active production deployments running when another commit arrives, cancel superseded PR checks, set ten-minute job timeouts and disable checkout credential persistence. Document first-publication setup, changed-path triggers and manual redeployment.
- Rebuilt and checked all four localized pages and 122 internal links/assets for the production project URL. GitHub Pages configuration, remote push and live deployment have not been performed; `dev` still contains CMS/documentation changes absent from `main`.

## Translation publication consistency — 2026-10-23

- Reject individual translation publication until the default-language page is published, before creating revisions or build deliveries. Individual publication still works after the base is public, without publishing newer default-language drafts.
- Keep Admin bulk publication working by publishing default-language candidates first in the same D1 batch; reject orphaned translation drafts before any writes.
- Reject deletion of the default-language translation while other published translations remain. SQL guards also enforce publication/deletion conditions inside each D1 batch when concurrent requests race.
- Validate the default-language publication at the build snapshot boundary and keep Starlight sidebar slugs free of language prefixes. Existing translation-only publication states must be repaired by publishing their default-language translation before rebuilding.
- Verification: all 93 tests and type checks passed, including rejected operations with unchanged versions/history/deliveries, bulk ordering, concurrent publication/deletion, and a real static build immediately after individual translation publication with actual PNG files. Empty-site build, Worker dry run and `git diff --check` passed. No database migration, dependencies or Cloudflare configuration changes are required. Production deployment was not performed.

## Workspace-wide AI editing through WebMCP — 2026-10-22

- Add native `document.modelContext` tools to the open Admin for localized page/folder lists, reads across pages and languages, selecting pages, switching document languages, creating pages/translations, editing title/description/navigation/content, saving drafts, getting saved Preview URLs and listing existing media.
- Share the existing Tiptap editor and browser drafts with the human. Reads identify live editor/browser/D1 sources and conflicts; mutations require the selected document/language and latest editor token. Exact-text range checks and schema/URL/table validation run before applying a transaction. Content changes use ordinary Undo.
- Reuse existing Access-protected Admin APIs, CSRF checks and D1 save-version checks. Preserve browser drafts when moving across articles; block navigation away from changed new pages, pending uploads or changed folder settings. Return navigation results only once the requested editor is ready.
- Register tools only while Admin is mounted. Unsupported or policy-blocked browsers retain ordinary editing. Use official MIT `webmcp-types` 0.1.10 as a pinned development-only dependency; no runtime server, authentication system, database migration or Cloudflare configuration change is added.
- Document setup, supported tools and review/edit examples in [WebMCP usage](WEBMCP.md). Publication, deletion, history, folder creation/renaming and uploads remain existing UI actions. Saving shared navigation changes retains existing rebuild behavior.

Verification:

- Type checks and all 90 tests passed, including eight WebMCP regressions for native registration/lifecycle, validated inputs, concurrent-call rejection, rich-content/image transactions, atomic rejection of invalid edits, Undo and isolated page/language history; existing integration tests include actual published Astro builds.
- Native browser WebMCP discovery and calls verified new English articles, Japanese translation creation and selection, localized lists, partial/full edits, saved reopening, cross-page browser-draft preservation, stale editor-token rejection, Preview and ordinary Undo. A two-tab test verified that conflicting AI saves are rejected and the existing conflict UI keeps the current edits visible.
- Published the isolated local test DB through the existing API and built real English/Japanese Static Assets; verified the edited text and bold formatting in generated HTML. This used local APIs after browser automation stopped responding at the native publication confirmation dialog; browser publication completion is not claimed.
- Reviewed the actual discovery/invocation path again with a real 640 × 240 PNG: uploaded through the existing file chooser, read media and edited alt text through WebMCP, saved, followed returned Preview/public URLs, checked browser image decode completion and captured the rendered public page. Preview loaded the protected media proxy; the published page loaded the copied `/_cms-media/` file. `get_preview` now distinguishes saved Preview from the last deployed public site without claiming deployment completion.
- Fixed the discovered Undo history leak across page/language loads using existing ProseMirror state initialization. Browser verification confirms Undo starts disabled after a page load, remains available after saving edits in the same page, and cannot bring another page's content into the editor.
- Empty-site build, Worker dry run and `git diff --check` passed. Production Access, deployment and npm publication were not performed.

## v1.1.1 — Initial upgrade build fix

Prepared patch for the reported v1.1.0 migration failure:

- Accept HTTP 405 as well as 404 only for the initial optional build API POST probe, allowing legacy Workers to supply the existing snapshot/media APIs without cleanup.
- Keep authentication, redirect and cleanup failures fatal; include the failed method/path in safe build error messages.
- Cover both legacy responses with real published Astro builds and document `wrangler.jsonc` conflict resolution in English/Japanese.
- `npm run release:check` passed: type checks, all 82 tests including actual published Astro builds, an empty-site build, Worker dry run, `create-starlight-cms-1.1.1.tgz` packing and project generation from the packed CLI.
- Set the CLI version to 1.1.1. npm publication and production deployment have not been performed for this patch.

## v1.1.0 — Page links, tables and storage cleanup

Prepared changes:

- Link to saved pages and optional headings from the editor, retaining destinations through saving and reopening and resolving URLs in Preview and published Docs.
- Add official Tiptap table controls for rows, columns, headings, merged cells and resizing, with standard, striped and minimal designs and cell alignment.
- Keep table colors in shared CSS rather than adding color selection. Use result-oriented header labels and the same transparent toolbar button style as other controls.
- Add older-history deletion, configurable retention (unlimited by default), and unused-media collection after a complete build once live Static Assets confirms migration.
- Include the tree UX and development startup improvements prepared for v1.0.4 below.

Verification:

- `npm run release:check` passed: type checks, all 81 tests including managed published Astro builds, an empty-site build, and a Worker dry run.
- Packed `create-starlight-cms-1.1.0.tgz` and verified new project generation from the actual package, including the Linux native binding lockfile check.
- The table toolbar's normal background was verified transparent in dark mode while editing a table.

Migration `0003_build_cleanup.sql` adds build-reference protection and media deletion claims; bundled bootstrap applies its idempotent CREATE statements. Markdown/HTML parsing uses pinned OSS dependencies. Workers Builds projects retain `npm run build` and `npx wrangler deploy`. Production deployment has not been verified in this repository.

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
| 1.2.0 (prepared) | Native WebMCP review/editing and default-language publication consistency; repository website |
| 1.1.1 (prepared) | Fix legacy build API 405 fallback and document upgrade conflicts |
| 1.1.0 | Page/heading links, table designs, revision deletion/retention and unused-media cleanup |
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
- Upgrade needs no additional Publish or migration command: the first build uses existing export/list/object APIs when the build lease endpoint is absent (404, or 405 for the initial POST probe), copies media, and skips collection. Collection remains disabled until the live site carries the static-media marker, so failed migration deployments cannot break legacy production images. Pre-migration rollback/external direct links require the old R2 domain and originals; static version rollback restores assets, not D1/R2 state.
- Uploads remain limited to 10 MiB. Future larger-video support must account for Static Assets' 25 MiB per-file limit; no speculative hybrid delivery was introduced. Total file limits include Docs/Admin/Pagefind, and repeated build-time downloads still incur R2 reads.
- Documentation follow-up: README and both deployment guides explicitly state that R2 Custom Domain setup is unnecessary and explain when existing users may detach it, while retaining the original bucket/binding and documenting legacy rollback/direct-link requirements.
- Validation includes an actual Astro build through emulated old APIs, image/video byte copies, unchanged legacy stored JSON, protected Editor/Preview URLs, later build-time GC, concurrent-build protection, retention/deletion retries, and strict redirect/authentication failure handling. All 81 tests and type checks passed, including real published Astro builds; empty-site build, Worker dry run and `git diff --check` passed. Packed CLI generation and a generated project’s clean `npm ci` plus empty build passed. Lockfile metadata was regenerated for reproducible clean installation.

### Behavior-preserving refactoring — 2026-10-02

- Documented the v1.0.4 → v1.1.0 `wrangler.jsonc` upgrade conflict in both troubleshooting guides, with links from README and deployment guides. Explain removal of the obsolete media-origin block, preservation of user resource settings, retry commands and delayed R2-domain detachment. Documentation-only change; `git diff --check` passed.

- Consolidated registered-media key queries and Admin/public media URL generation across document reads, publication validation, export, upload responses and build downloads. Document views now require the registered-key set explicitly. No schema, stored-data, retention or cleanup-condition changes.
- Reviewed the 81 test cases. They cover distinct behavior and failures, including parameterized format/slug validation, immutable publication, legacy migration, concurrent builds and deletion safety. Retained these regressions rather than reducing the count or adding tests for helper implementation details.
- Type checks and all 81 tests passed, including local D1/R2 integration and actual published Astro builds. Empty-site build, Worker dry run and `git diff --check` passed. Production deployment was not performed.

### Legacy build API probe fix — 2026-10-02

- Addressed the reported first-upgrade build failure with HTTP 405. Legacy Workers forward unknown Admin routes to Static Assets; the initial POST probe now treats 405 as an unavailable build API, alongside 404. This exception is limited to the explicitly optional initial build probe. Authentication errors, redirects, other methods and cleanup failures remain fatal.
- Build errors now include the method/path without exposing Access secrets or the origin. Added 405 migration coverage alongside 404, including real Astro image/video copies and later cleanup; request tests ensure the 405 exception does not apply to unrelated requests or cleanup.
- All 82 tests, type checks, published/empty-site builds and `git diff --check` passed. Updated migration/troubleshooting documentation in English and Japanese. No production deploy or npm publication was performed.

References: [Version contents](https://developers.cloudflare.com/workers/versions-and-deployments/), [Static Assets limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Upload reuse](https://developers.cloudflare.com/workers/static-assets/direct-upload/).

No npm publication or production deployment was performed.
