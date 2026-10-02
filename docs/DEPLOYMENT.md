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

Attach `docs.example.com` to the Worker, then set the public origin in `src/site.config.ts`. Commit it after configuring the build credentials in step 4:

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

Once these credentials are configured, commit the public origin from step 3 to enable builds from the published snapshot.

## 5. Media delivery

R2 stores uploaded originals. Editor and Preview use the Access-protected Admin media API. `npm run build` copies only published managed media into `dist/_cms-media/` and serves it with Docs through Workers Static Assets. No R2 custom domain, `MEDIA_PUBLIC_URL`, public CORS configuration or R2 development URL is needed. External HTTPS media stays external.

Existing users can upgrade and push to GitHub. Keep the same bucket, object keys, stored documents and history; no re-upload or additional Publish operation is needed. `MEDIA_PUBLIC_URL` can be removed or left unused. The first build supports the old Worker's existing APIs and skips cleanup.

The upgrade CLI may stop on a `wrangler.jsonc` conflict because the configured old media origin differs from the template. See [Upgrade conflict in wrangler.jsonc](TROUBLESHOOTING.md#upgrade-conflict-in-wranglerjsonc) before retrying; preserve existing resource and domain settings.

**Removing an existing R2 domain:** After the static-media deployment succeeds and published images/videos load correctly, detach the bucket’s custom domain. Keep the R2 bucket and `MEDIA` binding for originals, editing and retained history. Pre-migration rollbacks and external direct links still need the old domain and originals. While enabled, that domain continues to expose old Draft media URLs.

Uploads remain limited to 10 MiB. Static Assets allows 25 MiB per file and 20,000 total files per Free-plan version, including Docs, Admin, Pagefind and media. Build-time downloads incur R2 reads; published managed media browsing does not.

### Storage and publication history

Publication history has no retention limit by default. Each revision stores document content and media URLs, not another copy of the image or video file. However, media referenced only by old revisions is still retained, so replacing media repeatedly can increase R2 usage. Revision content also consumes D1 storage.

Free-tier usage is limited and shared with other workloads in the account. R2 Standard includes 10 GB-month of storage per month; D1 Free includes 5 GB of total storage. Unlimited history does not guarantee free operation. Review storage and request usage in Cloudflare and check the current [R2](https://developers.cloudflare.com/r2/pricing/) and [D1](https://developers.cloudflare.com/d1/platform/pricing/) pricing before relying on the free tier.

Delete old entries from a page's **History** drawer. The currently published revision and revisions used by an active build cannot be deleted. Deleting history is permanent; it does not immediately delete files.

To limit history automatically, edit `src/cms.config.ts`:

```ts
export const cmsConfig: { maxPublicationRevisions: number | null } = {
  maxPublicationRevisions: null, // unlimited; e.g. 20 retains the latest 20 per language
};
```

Use a positive integer, including the current publication. After completing the build, old unprotected revisions are pruned, then media referenced by no saved draft, retained revision, current publication or active build is removed from R2 and D1. Protected revisions may temporarily exceed the configured limit. Uploaded files are kept for at least 24 hours to protect editors with unsaved inserts; save drafts promptly, as unsaved browser content is not a permanent reference.

**Keep the default Workers Builds deploy command `npx wrangler deploy`.** Collection runs only after the required downloads and site build finish. While the live site lacks the static-media marker, collection is skipped, so a failed migration deployment cannot remove legacy production media. Collection failures fail the build and retry on a later build. Publish with no saved changes can request another build. No scheduled job or post-deploy command is needed.

Build references have a 24-hour lease, normally released when the build finishes. Collection covers managed media referenced in CMS content; use separate assets for custom Astro pages or external uses. Static-media version rollbacks include their deployed media but do not restore D1/R2 state.

## 6. Trigger public builds on publish

In **Workers & Pages**, select the Worker and open **Settings → Builds → Deploy Hooks**. Create a Deploy Hook for the production branch. Store its URL as the Worker runtime secret:

```sh
npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
```

Alternatively, add it in **Worker → Settings → Variables and Secrets**. Do not add it to Workers Builds variables: the running CMS Worker cannot read build-only variables.

The Deploy Hook URL is a credential: anyone who has it can request a build. Keep it out of source control and replace the hook if it is exposed.

Use `Save draft` to save edits, then the header `Publish` button to publish saved changes across every page and language and request one build. Unsaved editor changes must be saved first. Hook acceptance means the build was requested; it does not mean deployment completed. Retry failed build requests from the Admin header.

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
