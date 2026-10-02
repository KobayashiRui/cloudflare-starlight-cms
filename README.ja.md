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

生成したrepositoryをCloudflare Workers Buildsへ接続します。本番domainをWorkerへ接続する前にCloudflare Accessを設定し、その後Deploy Hookを設定します。初回Deploy時にD1/R2 bindingは自動provisionされます。

R2のCustom Domain設定や`MEDIA_PUBLIC_URL`は不要です。R2は非公開の原本保存用として維持し、公開画像・動画はDocsと一緒にWorkers Static Assetsから配信します。既存のR2ドメインは、更新後のdeploy成功を確認してから外せます。移行前Versionへのrollbackや外部の旧画像直リンクを維持する場合は、旧ドメインと原本を残してください。

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

## Adminの表示言語

Admin右上で **English / 日本語** を切り替えられます。初回はブラウザの言語設定から対応する言語を選び、手動で選択した言語はこのブラウザに保存します。文書の編集言語とは独立しており、切り替えても未保存の編集内容は保持されます。

表示言語の優先順は「保存した選択 → ブラウザの対応言語 → `src/admin.config.ts` の `defaultLanguage`」です。既定値は `'en'` で、日本語を予備の言語にする場合は `'ja'` に変更します。保存した選択や対応するブラウザ言語がある場合は、そちらを優先します。

表示言語と既定値は `src/admin.config.ts`、翻訳は `src/admin/i18n/en.ts` と `ja.ts` で管理します。言語を追加する場合は、全項目の翻訳ファイルを追加し、`src/admin/i18n/language.ts` に登録して `admin.config.ts` に追加します。型とテストで翻訳項目の不足を検出します。静的ファイルの変更後はAdmin assetsを再buildしてください。
