# Troubleshooting

## Workers Builds fails with `unexpected redirect`

The build tried to read `/admin/export/snapshot` but Cloudflare Access redirected it to the login page. Confirm that the Workers Builds Service Token is included in a **Service Auth** policy in the same Access Application that protects `admin/*`.

Adding the token to the human **Allow** policy is not sufficient.

## Media does not load on the public site

Set `MEDIA_PUBLIC_URL` to an HTTPS R2 custom domain and rebuild the site. Published images and videos cannot use HTTP, Admin media proxy URLs, or private-network addresses. Use the Media picker to upload assets when possible.

## Automatic D1 provisioning reports an existing database

Check Cloudflare Audit Logs for `DeleteDatabase` and subsequent `CreateDatabase` events, and make sure overlapping builds are not trying to provision the same Worker at once. The failure occurs before schema initialization.

Do not repeatedly delete databases or rename the Worker as a recovery step. Existing successful bindings are inherited by Wrangler; an unbound resource after a failed first deployment needs account-level investigation.

## The Admin was reachable before Access was enabled

Create the Access Application and human Allow policy for the planned hostname before attaching the Worker custom domain. See the [Deployment guide](DEPLOYMENT.md#2-protect-the-admin-before-attaching-the-domain).
