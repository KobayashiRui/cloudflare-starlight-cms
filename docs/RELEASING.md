# Releasing the CLI

`create-starlight-cms` is published only by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml).

## One-time setup

In the npm package settings, add a GitHub Actions Trusted Publisher with:

- GitHub user or organization: `KobayashiRui`
- Repository: `cloudflare-starlight-cms`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

The workflow uses GitHub OIDC and does not need an npm access token. Configure the npm package to require 2FA and disallow traditional publish tokens after confirming the first automated release.
Protect `v*` tags in GitHub so only release maintainers can trigger a publish.

## Release

1. Update `packages/create-starlight-cms/package.json` to the intended version.
2. Run `npm run publish:cli -- --dry-run` locally.
3. Commit and push the version change.
4. Create and push the matching tag, for example `v1.0.0`.

The workflow rejects tags that do not exactly match the CLI package version, runs the complete release check, and then publishes the CLI. It does not deploy a CMS instance.
