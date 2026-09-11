<p>
  <img src="./src/assets/logo.svg" alt="Cloudflare Starlight CMS" width="300">
</p>

# Cloudflare Starlight CMS

[English](README.md) · 日本語

Astro Starlight向けの、Cloudflare Workers、D1、R2、Accessで構成するセルフホスト型ドキュメントCMSです。

Cloudflare / Astroの公式プロジェクトではありません。MIT Licenseです。

## Quick start

CLI公開後は以下でプロジェクトを作成できます。現時点ではこのrepositoryをcloneしてください。

```sh
npx create-cloudflare-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

Adminは`http://127.0.0.1:8787/admin/`、公開Docsは`http://127.0.0.1:4321/`です。ローカルのD1/R2はMiniflareを使うため、Cloudflareアカウントは不要です。

## 含まれるもの

- Tiptap Simple Editor、Draft、Revision、Preview、Navigation Tree、多言語ページに対応したReact Admin
- D1のコンテンツ、R2のPNG/JPEG/WebP/AVIF/MP4/WebM、未使用時のみ削除できるMedia Picker
- 完全StaticなAstro Starlight、Pagefind、Workers Static Assetsの公開Docs
- `/admin/*`を保護するCloudflare Access。CMS独自のユーザー、パスワード、ロールは持たない
- Publish → Workers Deploy Hook → Workers Builds

[`src/assets/logo.svg`](src/assets/logo.svg)と[`src/assets/favicon.svg`](src/assets/favicon.svg)を入れ替えるとブランドを変更できます。Adminのテーマは[`src/admin/styles/_cms-theme.scss`](src/admin/styles/_cms-theme.scss)、Starlightのアクセント色は[`src/styles/starlight.css`](src/styles/starlight.css)で変更します。

## Production setup

1. [`src/site.config.ts`](src/site.config.ts)でサイト名、公開URL、言語を設定します。[`wrangler.jsonc`](wrangler.jsonc)のD1/R2 bindingにはアカウント固有のIDや名前を置かず、初回deploy時にCloudflareが作成・bindingします。
2. bucket作成後に`wrangler.jsonc`の`MEDIA_PUBLIC_URL`へR2 public/custom domainを設定します。これは公開設定でありsecretではありません。
3. `docs.example.com/admin/*`向けのAccess Self-hosted Applicationを1つ作成し、人間向けの`Allow` policyとWorkers Builds向けの`Service Auth` policyを追加します。
4. Service Tokenの`CF_ACCESS_CLIENT_ID`と`CF_ACCESS_CLIENT_SECRET`をWorkers BuildsのBuild Variables and Secretsへ登録します。buildは`siteConfig.url`からexport endpointを導出し、Published snapshotだけを取得します。
5. Workers Buildsの初回Build commandは`npm run build:empty`、以後は`npm run build`にします。Deploy commandは`npm run deploy`に設定し、D1 migrationを適用してからWorkerをdeployします。Workers BuildsのDeploy Hook URLをWorker secretとして登録します。

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

Publishは公開revisionを更新してbuildを要求します。Hookの成功はbuildの受理を意味し、公開完了ではありません。Hook未設定でもローカルでは公開Docsを再buildします。

## Commands

```sh
npm run dev
npm run check
npm test
npm run build:empty
npm run dry-run
```

`build:empty`は初回deploy用の空サイトを作成します。`dry-run`はdeployせずWorkerとStatic Assetsの設定を検査します。

詳細は[Architecture](docs/ARCHITECTURE.md)、実装状況は[Roadmap](docs/ROADMAP.md)を参照してください。本番のCloudflareアカウントではまだ検証していません。
