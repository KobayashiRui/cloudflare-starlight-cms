<p>
  <img src="./src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="300">
</p>

# Cloudflare Starlight CMS

[English](README.md) · [日本語](README.ja.md)

A self-hosted documentation CMS for Astro Starlight, built on Cloudflare Workers, D1, R2, and Access.

Not an official Cloudflare or Astro project. Licensed under MIT.

## Quick start

Create a project after the CLI is published, or clone this repository today:

```sh
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

The local Admin is at `http://127.0.0.1:8787/admin/`; static Docs are at `http://127.0.0.1:4321/`. Local D1 and R2 use Miniflare and need no Cloudflare account.

The CLI writes the normalized project name to `wrangler.jsonc` as the Worker name. Its `DB` and `MEDIA` bindings have no resource IDs or names, so Cloudflare provisions their D1 database and R2 bucket during the first deploy.

## Upgrade a generated project

Use the latest CLI to compare a project with the template version recorded when it was created:

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

The first command only reports the plan. `--apply` updates files which are unchanged from the old template, preserves project settings and custom files, and stops before changing anything if both the project and the new template changed the same file. It never deletes files. When dependencies change, run `npm install` afterwards to refresh `package-lock.json`.

## Included

- React Admin with Tiptap Simple Editor, drafts, revisions, preview, navigation tree, locale-aware documents, and YouTube embeds
- D1 for content, R2 for PNG/JPEG/WebP/AVIF/MP4/WebM, and a media picker with safe unused-asset deletion
- Astro Starlight, Pagefind, and Workers Static Assets for fully static public Docs
- Cloudflare Access for `/admin/*`; no CMS users, passwords, or roles
- Publish → Workers Deploy Hook → Workers Builds

Replace [`src/assets/logo.svg`](src/assets/logo.svg) and [`src/assets/favicon.svg`](src/assets/favicon.svg) to brand a project. Edit Admin theme tokens in [`src/admin/styles/_cms-theme.scss`](src/admin/styles/_cms-theme.scss) and Starlight accents in [`src/styles/starlight.css`](src/styles/starlight.css).

## Production setup

1. Set the Workers Builds build command to `npm run build` and keep the default deploy command `npx wrangler deploy`. Disable non-production branch builds. With no public URL yet, the first build deploys an empty site and Admin Worker and provisions D1/R2. The first management API, export, or preview request applies the bundled initial schema automatically.
2. Before attaching the custom domain to the Worker, create one **Self-hosted public application** in Cloudflare Access. Use the planned hostname and `admin/*` path, for example `docs.example.com/admin/*`. Add a human policy with action **Allow** and the permitted emails, domain, or Access Group. The hostname must belong to an active Cloudflare zone, but it does not need to be attached to the Worker yet.
3. Attach the custom domain to the Worker. The public site and Admin share this public hostname: Docs stay available at `/`, while Access protects `/admin/*`.
4. Create an Access Service Token for Workers Builds. In the same Access Application, add a separate policy with action **Service Auth** and include that Service Token. Keep this distinct from the human `Allow` policy. Add the token's `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` as Secrets in **Workers Builds → Build Variables and Secrets**. Do not add them to Worker runtime variables.
5. Set [`src/site.config.ts`](src/site.config.ts)'s `url` to the origin, such as `https://docs.example.com`, and commit it. Builds derive both the Astro site URL and CMS snapshot endpoint from this source-controlled value. Do not set `CMS_EXPORT_URL` for normal production builds.
6. After the bucket is provisioned, connect an R2 custom domain such as `docs-media.example.com`. Set `MEDIA_PUBLIC_URL` in [`wrangler.jsonc`](wrangler.jsonc) to that origin and commit it. It is public configuration, not a secret. Keep the `r2.dev` development URL disabled. Standard image and video embeds need no CORS policy; add narrowly scoped CORS rules only when browser JavaScript must fetch media directly. Draft media is public at this domain once uploaded.
7. Add the Workers Builds Deploy Hook URL as the production Worker runtime secret `WORKERS_DEPLOY_HOOK_URL` in **Worker → Settings → Variables and Secrets**. Do not add it to the Workers Builds variables: build variables are not available to the running CMS Worker. From a local authenticated terminal, the equivalent is:

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

Publishing updates the public revision and requests a build. A successful Hook request means the build was accepted, not that it has deployed. Without a Hook, local publishing still rebuilds the local static Docs.

If a build fails with `unexpected redirect` while loading the CMS snapshot, verify that the Service Token is covered by a **Service Auth** policy in the Access Application. Adding it only to a human `Allow` policy redirects the build to the Access login page.

Use a root-level document with the URL segment `index` as the homepage. It is a regular CMS document and publishes at `/`; its translations publish at their locale roots, such as `/ja/`.

For a custom landing page instead, do not create that CMS `index` document. Add `src/pages/index.astro` to the generated project: Astro owns `/`, while CMS documents remain available at their own paths such as `/getting-started/`.

Initialization records the two bundled CREATE migrations in `d1_migrations`, shared with Wrangler. Failed initialization returns 503 and can be retried. Future ALTER/backfill migrations require an explicit upgrade procedure; adding a SQL file does not automatically enable runtime execution. Keep production data when upgrading.

If provisioning reports an existing D1 after deletion, check Cloudflare Audit Logs for `DeleteDatabase` and subsequent `CreateDatabase` events and check overlapping builds. This error happens before schema initialization. Do not repeatedly delete databases or rename the Worker as a recovery procedure. Successful existing bindings are inherited by Wrangler; recovery of an unbound resource after a failed first deploy needs account-level verification.

## Commands

```sh
npm run dev
npm run check
npm test
npm run build:empty
npm run dry-run
```

With an empty `siteConfig.url`, `build` creates the explicit empty site for an initial deploy. `build:empty` is available when an intentionally empty local build is needed. `dry-run` validates the Worker and Static Assets configuration without deploying.

See [Architecture](docs/ARCHITECTURE.md) for design details and [Roadmap](docs/ROADMAP.md) for implementation status. Production configuration is designed but has not yet been verified against a real Cloudflare account.
