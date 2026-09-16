<p align="center">
  <img src="./src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="300">
</p>

# Cloudflare Starlight CMS

[English](README.md) · 日本語

<!-- badges:start -->
<p align="center">
  <a href="https://www.npmjs.com/package/create-starlight-cms"><img src="https://img.shields.io/npm/v/create-starlight-cms?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/KobayashiRui/cloudflare-starlight-cms/actions/workflows/publish.yml"><img src="https://github.com/KobayashiRui/cloudflare-starlight-cms/actions/workflows/publish.yml/badge.svg" alt="Publish CLI"></a>
  <a href="https://www.npmjs.com/package/create-starlight-cms"><img src="https://img.shields.io/node/v/create-starlight-cms?logo=nodedotjs&label=node" alt="Node.js requirement"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/KobayashiRui/cloudflare-starlight-cms" alt="MIT License"></a>
</p>
<!-- badges:end -->

Astro Starlight向けのCloudflareネイティブCMSです。

ブラウザのAdminでドキュメントを編集し、高速な完全Static Starlightサイトとして公開します。Cloudflare Workers、D1、R2、Accessで動作します。

## Features

- Tiptap Editor、Draft、Revision、Preview、Media、多言語Page
- StarlightのsidebarとURL構造になるFolder / Page Navigation Tree
- Pagefind検索を含むStatic Astro Starlightサイト
- CMSのアカウントやパスワードを持たない、`/admin/*`へのCloudflare Access保護
- D1のコンテンツ、R2のMedia、Workers BuildsへのDeploy Hook公開

## Quick Start

```sh
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

- Docs: [http://127.0.0.1:4321](http://127.0.0.1:4321)
- Admin: [http://127.0.0.1:8787/admin/](http://127.0.0.1:8787/admin/)

ローカルではMiniflareがD1とR2を提供するため、Cloudflareアカウントは不要です。

## Deploy to Cloudflare

生成したrepositoryをCloudflare Workers Buildsへ接続します。本番domainをWorkerへ接続する前にCloudflare Accessを設定し、その後Media domainとDeploy Hookを設定します。初回Deploy時にD1/R2 bindingは自動provisionされます。

詳細は[デプロイガイド](docs/DEPLOYMENT.ja.md)を参照してください。

## Upgrade

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

最初に更新計画を確認します。`--apply`は作成時templateから未変更のfileだけを更新し、競合があれば停止します。dependencyが変わった場合は続けて`npm install`を実行してください。

## Documentation

- [デプロイ](docs/DEPLOYMENT.ja.md)
- [アーキテクチャ](docs/ARCHITECTURE.md)
- [トラブルシューティング](docs/TROUBLESHOOTING.ja.md)
- [ロードマップ](docs/ROADMAP.md)

生成projectのブランドは[`src/assets/logo.svg`](src/assets/logo.svg)と[`src/assets/favicon.svg`](src/assets/favicon.svg)を置き換えて変更できます。

## License

[MIT](LICENSE)。CloudflareおよびAstroの公式プロジェクトではありません。
