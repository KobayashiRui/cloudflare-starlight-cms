# cloudflare-starlight-cms

A self-hosted documentation CMS for Astro Starlight, built on Cloudflare Workers, D1, R2, and Access.

Cloudflare / Astroの公式プロジェクトではありません。独自コードはMIT Licenseです。

## 現在の実装

単一Worker構成です。公開DocsはAstro StarlightとPagefindをStatic Assetsへ出力し、
`/admin` と `/admin/api/*` だけWorkerが先に処理します。Cloudflare Accessを通過した
利用者が管理者です。

- Tiptap公式Simple Editor（MIT source）を使うReact管理画面と、Tiptap JSONを正本にしたDocs CRUD
- 編集中のTranslationとPublished revisionの分離、revision履歴とRestore
- D1 + Drizzle、R2へのPNG/JPEG/WebP/AVIF/MP4/WebM upload（Worker経由は10 MiBまで）、Media Picker
- Cloudflare Access Applicationによる`/admin/*`とbuild exportのedge保護
- build専用のexport endpoint、D1のPublished snapshot → Starlight SSG + Pagefind
- Workers Static Assetsの`run_worker_first`で`/admin/*`だけを動的に処理

`folder` / `document`は言語に依存しないTreeとURL segmentを持ち、表示名・タイトル・説明・本文・
公開revisionはそれぞれ`folder_translation` / `document_translation`に属します。Treeは基準言語で
固定し、ページ編集画面のLanguageから`en`と`ja`を切り替えます。未作成の翻訳は、そのページの
既存translationからDraftとして明示的に複製します。公開buildは`en`をルートURL、`ja`を`/ja/`へ
出力します。Draft本文は公開せず、未翻訳のURLにはStarlight標準の既定言語fallbackが表示されます。

Publishは公開revisionを確定し、D1の`publish_delivery`へ配送記録を保存してから
Workers Deploy HookをPOSTします。Hookの2xxはBuildの要求受理であり、公開完了ではありません。
公開ページの削除・URL変更・移動・並べ替えも配送対象です。失敗したHook要求と、30秒以上経過して送信が中断したpending要求はAdminから再試行できます。`WORKERS_DEPLOY_HOOK_URL`がないlocal開発では
`skipped`として記録され、外部へは送信しません。実Cloudflare Access / Workers Buildsの接続はP4です。deployは実施していません。

## ローカル開発

Node.js 22.22.2以上を推奨します。以下はCloudflareアカウントなしでD1/R2を
Miniflareに作成して検証します。

```sh
npm ci
npm run migrate:local
npm run dev
```

開発Workerはlocalhostだけで動くため、Accessや代替tokenは使いません。`npm run dev`は
Admin Workerを`http://127.0.0.1:8787/admin`、Published Static Docsを
`http://127.0.0.1:4321/`で起動します。productionではCloudflare Access Applicationが
`/admin/*`への到達をedgeで制限します。

dev coordinatorはPublished snapshotだけを監視します。AdminでPublishするとAstro/Starlightと
Pagefindを自動buildし、`4321`のStatic Docsを再読み込みして確認できます。本文・タイトル・説明のDraft保存だけではbuildしません。URL・配置・順序の変更は公開Navigation変更として反映します。
Adminソースはesbuild watchで再bundleします。build失敗時はエラーを修正してdevを再起動してください。自動retryは行いません。
これはlocal開発のNodeプロセスによる補助であり、productionではWorkers Deploy HookとWorkers Buildsが
同じ役割を担います。

既存のローカルサーバーとポートが重なる場合は、次のように変更できます。

```sh
CMS_PORT=8791 DOCS_PORT=4322 npm run dev
```

`npm run build:empty` は初回deploy用の空サイトだけを作る明示的なコマンドです。
テストデータは必要なテストだけが`tests/fixtures/`から読むようにします。実行時fixtureや
デモ用content fallbackは持ちません。

```sh
npm run check
npm test
npm run dry-run
```

`dry-run`はWorker bundleとStatic Assets設定を検査しますがdeployしません。

## Production setup

1. `src/site.config.ts`でサイト名・公開URL・既定言語・対応言語を設定し、D1/R2を作成し、`wrangler.jsonc`へ実ID・bucket名を設定する。
2. Cloudflare Accessで、同じhuman policyを持つ`/admin`と`/admin/*`の2つのApplicationを作成する。
   wildcard pathは親pathを含まないため、両方が必要である。
3. より具体的な`/admin/export/*` Applicationを作成し、Workers Builds用Service Tokenだけを許可する。
   Access policyがURL単位で保護するため、WorkerへAccess secretやJWT verifierは設定しない。
4. `MEDIA_PUBLIC_URL`をR2 public/custom domain（例: `https://media.example.com`）としてWorker secret/varsへ設定する。
   未設定時のMediaはAdmin専用URLとなり、Published snapshotのbuildは意図的に失敗する。
5. migrationをremote D1へ適用し、空のStatic Docsを初回deployする。
6. Workers Buildsにこのrepoを接続し、`CMS_EXPORT_URL`、`CF_ACCESS_CLIENT_ID`、
   `CF_ACCESS_CLIENT_SECRET`をbuild secretとして設定する。後者2つはexport用Access
   Applicationだけを通過できるService Tokenの値にする。
7. Workers Buildsで作成したDeploy Hook URLをsecretとして設定する。URL自体が認証情報なのでGitやログへ残さない。

   ```sh
   npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
   ```

実アカウントで検証するまで、上記は手順の設計であり完成したdeployガイドではありません。
詳細と引き継ぎ情報は[AGENTS.md](AGENTS.md)、[Architecture](docs/ARCHITECTURE.md)、
[Roadmap](docs/ROADMAP.md)を参照してください。
