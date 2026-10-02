# Troubleshooting

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
