# Troubleshooting

## Upgrade conflict in wrangler.jsonc

When upgrading from 1.0.4 to 1.1.0, the CLI may report:

```text
No files changed. Resolve these conflicts, then run upgrade again:
  wrangler.jsonc
```

The CLI stops before changing any files. It ignores the project-specific Worker name when comparing templates, but other edits, including the configured `MEDIA_PUBLIC_URL` value, can cause a conflict. v1.1.0 removes that variable from the template because published media uses Static Assets.

If your only change besides the Worker name is the old media origin, remove this comment and block from `wrangler.jsonc`:

```jsonc
// Public R2/custom-domain origin. Set once in the generated project's Git.
"vars": {
  "MEDIA_PUBLIC_URL": "https://your-old-media-domain.example"
},
```

If `vars` contains other variables, remove only `MEDIA_PUBLIC_URL` and keep the others. Keep your Worker name, routes/domains, D1 database settings and R2 bucket settings. Do not replace the entire file with the template.

Then rerun the upgrade:

```sh
npx create-starlight-cms@1.1.1 upgrade .
npx create-starlight-cms@1.1.1 upgrade . --apply
npm install
```

If the conflict remains, compare your file with the target template and reconcile the remaining differences manually. The comparison is text-based except for the Worker name, so formatting changes can also cause conflicts. Review the resulting diff before committing and pushing to GitHub.

Removing the variable does not detach the R2 domain or change stored content. Keep the old domain connected until the upgraded deployment succeeds and published images/videos load correctly. See [Media delivery](DEPLOYMENT.md#5-media-delivery) for legacy rollback and direct-link requirements.

## First upgrade build fails with `CMS build operation failed (405)`

The original v1.1.0 build script only recognized 404 when checking for the new build API. Legacy Workers forward unknown Admin routes to Static Assets, which can return 405 for the POST to `/admin/api/publish/builds` instead. This prevents the first upgrade build from reaching the existing snapshot/media APIs.

The fix is included in v1.1.1. Apply the corrected `scripts/build-client.mjs` and push to retry the normal build/deploy flow. The fix accepts 404 or 405 for the initial build API probe only, then reads the existing APIs and skips cleanup for that build. Authentication failures, redirects and cleanup failures still stop the build. Do not use an empty-site build, remove Access protection or delete R2 objects to bypass this error.

## Workers Builds fails with `unexpected redirect`

The build tried to read `/admin/export/snapshot` but Cloudflare Access redirected it to the login page. Confirm that the Workers Builds Service Token is included in a **Service Auth** policy in the same Access Application that protects `admin/*`.

Adding the token to the human **Allow** policy is not sufficient.

## Media does not load on the public site

Run `npm run build` and deploy its complete `dist` output. Managed media is copied into `dist/_cms-media/` using the Access build token. Verify that the token can read the Admin snapshot, media list and media object endpoints and that the original exists in R2. `MEDIA_PUBLIC_URL` is no longer required. External media must use public HTTPS URLs.

## Automatic D1 provisioning reports an existing database

Check Cloudflare Audit Logs for `DeleteDatabase` and subsequent `CreateDatabase` events, and make sure overlapping builds are not trying to provision the same Worker at once. The failure occurs before schema initialization.

Do not repeatedly delete databases or rename the Worker as a recovery step. Existing successful bindings are inherited by Wrangler; an unbound resource after a failed first deployment needs account-level investigation.

## The Admin was reachable before Access was enabled

Create the Access Application and human Allow policy for the planned hostname before attaching the Worker custom domain. See the [Deployment guide](DEPLOYMENT.md#2-protect-the-admin-before-attaching-the-domain).
