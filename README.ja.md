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
npx create-starlight-cms@latest my-docs
cd my-docs
npm install
npm run dev
```

Adminは`http://127.0.0.1:8787/admin/`、公開Docsは`http://127.0.0.1:4321/`です。ローカルのD1/R2はMiniflareを使うため、Cloudflareアカウントは不要です。

## 生成済みプロジェクトの更新

作成時のtemplate versionと最新版を比較します。

```sh
npx create-starlight-cms@latest upgrade .
npx create-starlight-cms@latest upgrade . --apply
```

最初のコマンドは更新内容を表示するだけです。`--apply`は旧templateから未変更のfileだけを更新し、設定や独自fileを保持します。利用者側と新template側の両方が同じfileを変更している場合は、変更せず競合一覧を表示します。fileの自動削除は行いません。dependency変更が表示された場合は、続けて`npm install`で`package-lock.json`を更新してください。

## 含まれるもの

- Tiptap Simple Editor、Draft、Revision、Preview、Navigation Tree、多言語ページ、YouTube埋め込みに対応したReact Admin
- D1のコンテンツ、R2のPNG/JPEG/WebP/AVIF/MP4/WebM、未使用時のみ削除できるMedia Picker
- 完全StaticなAstro Starlight、Pagefind、Workers Static Assetsの公開Docs
- `/admin/*`を保護するCloudflare Access。CMS独自のユーザー、パスワード、ロールは持たない
- Publish → Workers Deploy Hook → Workers Builds

[`src/assets/logo.svg`](src/assets/logo.svg)と[`src/assets/favicon.svg`](src/assets/favicon.svg)を入れ替えるとブランドを変更できます。Adminのテーマは[`src/admin/styles/_cms-theme.scss`](src/admin/styles/_cms-theme.scss)、Starlightのアクセント色は[`src/styles/starlight.css`](src/styles/starlight.css)で変更します。

## Production setup

1. Workers BuildsのBuild commandを`npm run build`、Deploy commandを標準の`npx wrangler deploy`にします。非本番ブランチbuildは無効にしてください。公開URL未設定の初回buildは空の公開サイトとAdmin Workerをdeployし、D1/R2をprovisionします。最初の管理API・export・previewアクセス時に同梱schemaを適用します。
2. Workerへcustom domainを接続する**前に**、Cloudflare Accessで**Self-hosted public application**を1つ作成します。予定しているhostnameと`admin/*` path、例えば`docs.example.com/admin/*`を設定し、許可するemail、domain、またはAccess Groupを含むAction **Allow** の人間向けpolicyを追加します。hostnameはactiveなCloudflare zoneに属している必要がありますが、この時点でWorkerへ接続済みである必要はありません。
3. custom domainをWorkerへ接続します。公開DocsとAdminは同じpublic hostnameを共有し、`/`は誰でも閲覧でき、`/admin/*`だけをAccessが保護します。
4. Workers Builds用のAccess Service Tokenを作成します。同じAccess Applicationに、そのService TokenをIncludeしたAction **Service Auth** のpolicyを別途追加します。人間向けの`Allow` policyとは分けてください。Service Tokenの`CF_ACCESS_CLIENT_ID`と`CF_ACCESS_CLIENT_SECRET`は、**Workers Builds → Build Variables and Secrets**へSecretとして登録します。Worker Runtime Variablesには登録しません。
5. [`src/site.config.ts`](src/site.config.ts)の`url`へ`https://docs.example.com`のようなoriginを設定してcommitします。このGit管理の値からAstroの公開URLとCMS snapshot endpointを導出します。通常のproduction buildでは`CMS_EXPORT_URL`を設定しません。
6. bucket作成後、`docs-media.example.com`のようなR2 custom domainを接続します。[`wrangler.jsonc`](wrangler.jsonc)の`MEDIA_PUBLIC_URL`へそのoriginを設定してcommitします。これは公開設定でありsecretではありません。`r2.dev`の開発用URLは無効のままにします。通常の画像・動画埋め込みにはCORS policyは不要で、browser JavaScriptからmediaを直接fetchする場合だけ必要最小限のCORSを追加します。upload済みDraft mediaもこのpublic domainから取得できます。
7. Workers BuildsのDeploy Hook URLは、production Workerの実行時Secret `WORKERS_DEPLOY_HOOK_URL`として **Worker → Settings → Variables and Secrets** へ登録します。Workers Buildsの変数へ登録しても、実行中のCMS Workerには渡りません。ローカルの認証済みterminalから登録する場合は次のとおりです。

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

Publishは公開revisionを更新してbuildを要求します。Hookの成功はbuildの受理を意味し、公開完了ではありません。Hook未設定でもローカルでは公開Docsを再buildします。

CMS snapshot取得時に`unexpected redirect`でbuildが失敗した場合は、Service TokenをAccess ApplicationのAction **Service Auth** policyへ含めているか確認してください。人間向けの`Allow` policyへ追加しただけでは、BuildはAccess login pageへredirectされます。

root直下でURL segmentを`index`にしたDocumentがホームページです。通常のCMS Documentとして扱われ、`/`へ公開されます。翻訳は`/ja/`のように各言語のrootへ公開されます。

独自のランディングページを使う場合は、CMSの`index` Documentを作りません。生成projectに`src/pages/index.astro`を追加するとAstroが`/`を担当し、CMS Documentは`/getting-started/`のような各URLで公開されます。

## Commands

```sh
npm run dev
npm run check
npm test
npm run build:empty
npm run dry-run
```

`siteConfig.url`が空なら、`build`は初回deploy用の空サイトを作成します。意図的に空のローカルbuildを行う場合は`build:empty`を使えます。`dry-run`はdeployせずWorkerとStatic Assetsの設定を検査します。

詳細は[Architecture](docs/ARCHITECTURE.md)、実装状況は[Roadmap](docs/ROADMAP.md)を参照してください。本番のCloudflareアカウントではまだ検証していません。
