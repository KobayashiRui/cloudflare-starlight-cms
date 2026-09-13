# Releasing the CLI

`create-starlight-cms` is published only by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) after a merge to `main` that changes the CLI version.

## One-time setup

In the npm package settings, add a GitHub Actions Trusted Publisher with:

- GitHub user or organization: `KobayashiRui`
- Repository: `cloudflare-starlight-cms`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

The workflow uses GitHub OIDC and does not need an npm access token. Configure the npm package to require 2FA and disallow traditional publish tokens after confirming the first automated release.
Protect `main` in GitHub so only release maintainers can merge a version change.

## Release

1. Update `packages/create-starlight-cms/package.json` to the intended version.
2. Run `npm run publish:cli -- --dry-run` locally.
3. Commit, push, and merge the version change into `main`.

The workflow runs only when the CLI package manifest changes. It compares the version with the previous `main` commit, skips an unchanged version, and otherwise runs the complete release check before publishing the CLI. It does not deploy a CMS instance.
