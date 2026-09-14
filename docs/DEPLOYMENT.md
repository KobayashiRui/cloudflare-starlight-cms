# Deployment

This guide configures one Worker that serves public Starlight Docs and the Access-protected Admin at `/admin/*`.

## Before you start

Create a project with `npx create-starlight-cms@latest my-docs`, push it to GitHub, and use a Cloudflare zone that will contain the production Docs hostname.

## 1. Create the first Worker deployment

In **Workers & Pages → Builds**, connect the repository and use:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

Disable non-production branch builds during initial setup. Keep `siteConfig.url` empty for this first build: it deploys an empty public site and Admin, and Cloudflare automatically provisions the `DB` D1 and `MEDIA` R2 bindings.

## 2. Protect the Admin before attaching the domain

In Cloudflare Access, create one **Self-hosted** application:

```text
Hostname: docs.example.com
Path: admin/*
```

Add a human policy with action **Allow** and the permitted email addresses, domain, or Access Group. The hostname must be in an active Cloudflare zone, but does not need to be attached to the Worker yet.

## 3. Attach the Docs domain

Attach `docs.example.com` to the Worker, then set the public origin in `src/site.config.ts` and commit it:

```ts
export const siteConfig = {
  url: 'https://docs.example.com',
  // …
};
```

The next build derives both Astro’s public URL and the CMS snapshot URL from this value. Do not set `CMS_EXPORT_URL` for a normal production build.

Public Docs remain available at `/`; Access protects `/admin/*`. `/admin` redirects to `/admin/` and does not return Admin content.

## 4. Allow Workers Builds to read the published snapshot

Create an Access Service Token for Workers Builds. In the same Access Application, add a second policy:

```text
Action: Service Auth
Include: the Workers Builds Service Token
```

Add the token values as **Workers Builds → Build Variables and Secrets**:

```text
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
```

These are build secrets, not Worker runtime variables. Keep the Service Auth policy separate from the human Allow policy. A Service Token added only to an Allow policy is redirected to the Access login page.

## 5. Configure public media

After the first deployment provisions R2, attach a public custom domain such as `docs-media.example.com` to the `MEDIA` bucket. Set its origin in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "MEDIA_PUBLIC_URL": "https://docs-media.example.com"
  }
}
```

Commit this public value. It is not a secret. Keep the R2 development URL disabled. Standard image and video embeds do not need CORS; only add a narrow CORS policy when browser JavaScript must fetch the assets directly. Uploaded Draft media is public at this domain.

Use the Admin Media picker for images and videos. Normal links can use HTTP(S), but published image and video URLs must use a public HTTPS origin.

## 6. Trigger public builds on publish

In **Workers & Pages**, select the Worker and open **Settings → Builds → Deploy Hooks**. Create a Deploy Hook for the production branch. Store its URL as the Worker runtime secret:

```sh
npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
```

Alternatively, add it in **Worker → Settings → Variables and Secrets**. Do not add it to Workers Builds variables: the running CMS Worker cannot read build-only variables.

The Deploy Hook URL is a credential: anyone who has it can request a build. Keep it out of source control and replace the hook if it is exposed.

`Publish page` publishes one Page and locale. `Publish changes` publishes every saved Draft or saved change and requests one build. Hook acceptance means the build was requested; it does not mean deployment completed. Retry failed build requests from the Admin header.

## Homepage and landing pages

A root-level CMS Page with URL segment `index` publishes as `/`. Its translations publish at locale roots such as `/ja/`.

To use a custom landing page, do not create that CMS Page. Add `src/pages/index.astro` to the generated project; Astro owns `/` and CMS Pages remain at their own paths.

## Schema initialization and future migrations

The bundled initial schema is applied when the Admin first needs D1 and recorded in `d1_migrations`, which Wrangler also uses. If initialization fails, the Admin returns `503`; retry after fixing the underlying issue.

This automatic path only covers the bundled idempotent CREATE migrations. Future ALTER or backfill migrations need an explicit project upgrade procedure. Keep production data when upgrading.

Useful checks:

```sh
npm run check
npm test
npm run build:empty
npm run dry-run
```
