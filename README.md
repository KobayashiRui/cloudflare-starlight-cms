<p>
  <img src="./src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="300">
</p>

# Cloudflare Starlight CMS

[English](README.md) · [日本語](README.ja.md)

A self-hosted documentation CMS for Astro Starlight, built on Cloudflare Workers, D1, R2, and Access.

This is not an official Cloudflare or Astro project. The project's original code is available under the MIT License.

## Create a project

After publishing `create-cloudflare-starlight-cms` to npm, create an independent CMS project in an empty directory:

```sh
npx create-cloudflare-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

Use `.` as the destination when the current directory is empty. The CLI does not install dependencies, initialize Git, log into Cloudflare, or deploy anything. It creates a standalone copy of this repository: later CLI releases apply only to new projects and never update an existing project automatically.

Until the CLI is published, clone this repository.

## What is included

The CMS runs as one Worker. Public Docs are built with Astro Starlight and Pagefind, then served as Workers Static Assets. `/admin` redirects to `/admin/`; the Worker handles `/admin/*` before static assets. Anyone who passes Cloudflare Access is an administrator.

- React Admin UI using Tiptap's official Simple Editor source (MIT), with Tiptap JSON as the document source of truth
- Draft preview injected into a shell made by the current Astro/Starlight build, including the same heading-derived desktop and mobile table of contents
- Draft versus published revision separation, revision history, and restore
- D1 + Drizzle, R2 uploads for PNG/JPEG/WebP/AVIF/MP4/WebM, and a Media Picker
- One Cloudflare Access Application to protect `/admin/*` and the build export endpoint
- Published D1 snapshot → Starlight SSG + Pagefind, delivered through a Workers Deploy Hook
- `run_worker_first` Static Assets routing for only `/admin/*`

`folder` and `document` provide locale-independent navigation and URL segments. Names, titles, descriptions, bodies, and published revisions are stored in `folder_translation` and `document_translation`. The tree uses the default locale, and each document editor selects `en` or `ja`. Missing translations are explicitly copied as a draft from an existing translation. The build outputs `en` at the root and `ja` under `/ja/`. Draft content is never public; Starlight's default-locale fallback handles untranslated public routes.

Publishing commits the public revision, records the delivery in D1's `publish_delivery`, and then POSTs a Workers Deploy Hook. A 2xx response means the build request was accepted, not that deployment has finished. Deletes, URL changes, moves, and reorderings also request a rebuild. Failed or stalled requests can be retried in Admin. In local development without `WORKERS_DEPLOY_HOOK_URL`, the delivery is recorded as `skipped` and no external request is sent.

## Branding and theme

Replace the following two files to brand a project:

- [`src/assets/logo.svg`](src/assets/logo.svg) is used by the Admin header and the Starlight header.
- [`src/assets/favicon.svg`](src/assets/favicon.svg) is used by the Admin and public site browser tabs.

The favicon is copied to the Static Assets output during each build. To use a PNG logo, rename the file and change the two `logo.svg` references in `astro.config.mjs` and `src/admin/client.tsx`.

Admin colors use semantic tokens in [`src/admin/styles/_cms-theme.scss`](src/admin/styles/_cms-theme.scss). Purple is used for primary actions, selection, and focus; green for published content; amber for drafts and changes; and red for destructive actions. Tiptap text colors and highlights remain part of the editor's own palette.

Public Starlight accent colors are in [`src/styles/starlight.css`](src/styles/starlight.css). Change the three `--sl-color-accent-*` variables for each color mode without affecting Admin.

## Local development

Use Node.js 22.19.0 or later (22.22.2 or later is recommended). The commands below create local Miniflare D1 and R2 resources and do not require a Cloudflare account.

```sh
npm install
npm run dev
```

`npm run dev` applies local D1 migrations idempotently and does not erase local content. It starts the Admin Worker at `http://127.0.0.1:8787/admin/` and the published static Docs at `http://127.0.0.1:4321/`. Local development is unauthenticated because it only listens on localhost; production uses Cloudflare Access at the edge.

The dev coordinator watches the published snapshot. Publishing from Admin builds Astro/Starlight and Pagefind, then refreshes the static Docs service. Saving a draft alone does not trigger a public build. URL, placement, and order changes are treated as published navigation changes. The coordinator is a local development convenience; production uses Workers Deploy Hooks and Workers Builds for the same workflow.

Choose other ports when needed:

```sh
CMS_PORT=8791 DOCS_PORT=4322 npm run dev
```

`npm run build:empty` deliberately creates the empty site used for an initial deployment. Runtime fixtures and demo-content fallbacks are not included.

```sh
npm run check
npm test
npm run dry-run
```

`dry-run` validates the Worker bundle and Static Assets configuration without deploying.

## Production setup

1. Set the site title, public URL, default locale, and supported locales in `src/site.config.ts`. Create D1 and R2, then set their real IDs and bucket name in `wrangler.jsonc`.
2. Create one Cloudflare Access Self-hosted Application. Use the public Docs hostname and the path `admin/*`; for example, name it `Starlight CMS Admin`. The Worker redirects unprotected `/admin` to `/admin/` but does not return Admin content there.
3. Add an `Allow Docs Editors` policy for the permitted email addresses, company domain, or Access Group. Add an `Allow Docs Build` Service Auth policy for a Workers Builds-only Service Token such as `starlight-cms-build`. The Worker does not store Access secrets or verify JWTs.
4. Set `MEDIA_PUBLIC_URL` to an R2 public/custom domain such as `https://media.example.com`. Without it, Media is Admin-only and a published snapshot build intentionally fails.
5. Apply migrations to remote D1 and perform the initial empty Static Assets deployment.
6. Connect the repository to Workers Builds. Add `CMS_EXPORT_URL`, `CF_ACCESS_CLIENT_ID`, and `CF_ACCESS_CLIENT_SECRET` as build secrets. The build uses the Service Token to fetch only the published snapshot from `GET /admin/export/snapshot`; do not give the build a D1 binding or Cloudflare API Token.
7. Store the Workers Builds Deploy Hook URL as a Worker secret. It is a credential and must never be committed or logged.

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

If the Service Token leaks, revoke it in Cloudflare Access, issue a replacement, and update the two Workers Builds secrets. Treat the build environment as trusted Admin infrastructure because its token can reach `/admin/*`. Review Access authentication logs and the CMS revision history.

The production procedure is design-complete but has not yet been validated against a real Cloudflare account. See [AGENTS.md](AGENTS.md), [Architecture](docs/ARCHITECTURE.md), and [Roadmap](docs/ROADMAP.md) for implementation details and handoff information.
