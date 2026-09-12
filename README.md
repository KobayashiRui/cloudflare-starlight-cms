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
npx create-cloudflare-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

The local Admin is at `http://127.0.0.1:8787/admin/`; static Docs are at `http://127.0.0.1:4321/`. Local D1 and R2 use Miniflare and need no Cloudflare account.

The CLI writes the normalized project name to `wrangler.jsonc` as the Worker name. Its `DB` and `MEDIA` bindings have no resource IDs or names, so Cloudflare provisions their D1 database and R2 bucket during the first deploy.

## Included

- React Admin with Tiptap Simple Editor, drafts, revisions, preview, navigation tree, and locale-aware documents
- D1 for content, R2 for PNG/JPEG/WebP/AVIF/MP4/WebM, and a media picker with safe unused-asset deletion
- Astro Starlight, Pagefind, and Workers Static Assets for fully static public Docs
- Cloudflare Access for `/admin/*`; no CMS users, passwords, or roles
- Publish → Workers Deploy Hook → Workers Builds

Replace [`src/assets/logo.svg`](src/assets/logo.svg) and [`src/assets/favicon.svg`](src/assets/favicon.svg) to brand a project. Edit Admin theme tokens in [`src/admin/styles/_cms-theme.scss`](src/admin/styles/_cms-theme.scss) and Starlight accents in [`src/styles/starlight.css`](src/styles/starlight.css).

## Production setup

1. Set the Workers Builds build command to `npm run build` and keep the default deploy command `npx wrangler deploy`. Disable non-production branch builds. With no public URL yet, the first build deploys an empty site and Admin Worker and provisions D1/R2. The first management API, export, or preview request applies the bundled initial schema automatically.
2. Configure the custom domain. Set `CMS_ORIGIN` to its origin, such as `https://docs.example.com`, in Workers Builds Build Variables. It is public configuration, not a secret. Builds derive both the Astro site URL and CMS snapshot endpoint from this one value. [`src/site.config.ts`](src/site.config.ts) remains the fallback for local development, title, and locales.
3. After the bucket is provisioned, add `MEDIA_PUBLIC_URL` as a production Worker runtime Variable in **Worker → Settings → Variables and Secrets**. Set it to the R2 public/custom-domain origin. It is public configuration, not a secret.
4. Create one Access Self-hosted Application for `docs.example.com/admin/*`. Add a human `Allow` policy and a Workers Builds `Service Auth` policy.
5. Add the Service Token's `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` to Workers Builds Build Variables and Secrets. Add the Workers Builds Deploy Hook URL as the production Worker runtime secret `WORKERS_DEPLOY_HOOK_URL` in **Worker → Settings → Variables and Secrets**. Do not add it to the Workers Builds variables: build variables are not available to the running CMS Worker. `keep_vars: true` preserves dashboard runtime variables during each code deploy. From a local authenticated terminal, the equivalent is:

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

Publishing updates the public revision and requests a build. A successful Hook request means the build was accepted, not that it has deployed. Without a Hook, local publishing still rebuilds the local static Docs.

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

With no `CMS_ORIGIN` or `siteConfig.url`, `build` creates the explicit empty site for an initial deploy. `build:empty` is available when an intentionally empty local build is needed. `dry-run` validates the Worker and Static Assets configuration without deploying.

See [Architecture](docs/ARCHITECTURE.md) for design details and [Roadmap](docs/ROADMAP.md) for implementation status. Production configuration is designed but has not yet been verified against a real Cloudflare account.
