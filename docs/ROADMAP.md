# Roadmap

Current release preparation and remaining work. The implemented design is documented in [Architecture](ARCHITECTURE.md); publishing instructions are in [Releasing](RELEASING.md). Detailed development history is available in Git.

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

## Recent milestones

| Version | Changes |
| --- | --- |
| 1.0.3 | English/Japanese Admin UI, separate display-language settings, simpler save/publication controls, and save-conflict/upload fixes |
| 1.0.2 | Recovery for legacy HTTP/private-network media without allowing new unsafe media URLs |
| 1.0.1 | Navigation selection, temporary unsaved pages, creation destinations, and clearer setup documentation |
| 1.0.0 | Stable Docs CMS scope: static Starlight site, React Admin, D1/R2, drafts/revisions, document languages, Access, build requests, and CLI upgrades |

## Remaining work

- Support videos larger than 10 MiB through R2 multipart uploads.
- Verify production-specific integration in a real Cloudflare environment: Access protection and bypass prevention, resource provisioning, Workers Builds, Deploy Hook delivery, and token rotation. Local checks and dry runs do not establish production success.
- Investigate the reported D1 provisioning response after resource deletion; see [Troubleshooting](TROUBLESHOOTING.md#automatic-d1-provisioning-reports-an-existing-database).

## Scope

Keep the CMS focused on documentation and use existing React, Tiptap, Headless Tree, Hono, Drizzle, Astro/Starlight, Pagefind, and Cloudflare components. No general collection builder, CMS plugin/workflow engine, custom authentication, roles, or collaborative editing is planned. Draft media at public R2 URLs is not private.
