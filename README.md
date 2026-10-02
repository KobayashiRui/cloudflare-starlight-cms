<p align="center">
  <img src="./src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="300">
</p>

# Cloudflare Starlight CMS

[English](README.md) · [日本語](README.ja.md)

<!-- badges:start -->
<p align="center">
  <a href="https://www.npmjs.com/package/create-starlight-cms"><img src="https://img.shields.io/npm/v/create-starlight-cms?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/KobayashiRui/cloudflare-starlight-cms/actions/workflows/publish.yml"><img src="https://github.com/KobayashiRui/cloudflare-starlight-cms/actions/workflows/publish.yml/badge.svg" alt="Publish CLI"></a>
  <a href="https://www.npmjs.com/package/create-starlight-cms"><img src="https://img.shields.io/node/v/create-starlight-cms?logo=nodedotjs&label=node" alt="Node.js requirement"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/KobayashiRui/cloudflare-starlight-cms" alt="MIT License"></a>
</p>
<!-- badges:end -->

A self-hosted, Cloudflare-native CMS for Astro Starlight.

Manage documentation from a web-based Admin and publish it as a fast, fully static Starlight site. Powered by Cloudflare Workers, D1, R2, and Access.

## Features

- Tiptap editor with drafts, revisions, previews, media, and locale-aware documents
- Folder and Page navigation tree that becomes the Starlight sidebar and URL structure
- Static Astro Starlight site with Pagefind search
- Cloudflare Access protection for `/admin/*`, without CMS accounts or passwords
- D1 for content, R2 for media, and Deploy Hooks for publishing through Workers Builds

## Quick Start

```sh
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

- Docs: [http://127.0.0.1:4321](http://127.0.0.1:4321)
- Admin: [http://127.0.0.1:8787/admin/](http://127.0.0.1:8787/admin/)

Local development uses Miniflare for D1 and R2. No Cloudflare account is required.

## Deploy to Cloudflare

Connect the generated repository to Cloudflare Workers Builds, configure Cloudflare Access before attaching the production domain, then add the Deploy Hook. The first deployment provisions the D1 and R2 bindings automatically.

No R2 custom domain or `MEDIA_PUBLIC_URL` is required. Keep R2 as the private original store; published images and videos are served with Docs through Workers Static Assets. Existing users can detach the old R2 domain after the upgraded deployment succeeds. Keep the old domain and originals if pre-migration rollbacks or external direct links must continue working.

See the [Deployment guide](docs/DEPLOYMENT.md) for the complete setup.

## Upgrade

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

Review the plan first. `--apply` updates only files unchanged from the recorded template and stops when it finds a conflict. Run `npm install` afterwards if dependencies changed.

## Documentation

- [Deployment](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Roadmap](docs/ROADMAP.md)

Replace [`src/assets/logo.svg`](src/assets/logo.svg) and [`src/assets/favicon.svg`](src/assets/favicon.svg) to brand a generated project.

## License

[MIT](LICENSE). Cloudflare Starlight CMS is not an official Cloudflare or Astro project.

## Admin display language

Choose **English** or **日本語** in the Admin header. On first use, the UI follows the first supported browser language; an explicit selection is saved in this browser. The document language is a separate setting, and switching the UI keeps unsaved edits.

The display language is chosen in this order: saved selection → first supported browser language → `defaultLanguage` in `src/admin.config.ts`. The default is `'en'`; change it to `'ja'` for a Japanese fallback. This fallback does not override a saved selection or a supported browser language.

Configure available display languages and the fallback in `src/admin.config.ts`. Translations live in `src/admin/i18n/en.ts` and `ja.ts`. To add a language, add its complete translation file, register it in `src/admin/i18n/language.ts`, and add it to `admin.config.ts`. The dictionary type and tests check translation completeness. Changing these static files requires rebuilding the Admin assets.
