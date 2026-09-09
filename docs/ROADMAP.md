# Roadmap / terra引き継ぎ

## 現在地（2026-09-09）

P0〜P2のローカルMVPを実装した。SonicJS、workspaces、内部user/RBAC/KVは撤去済み。
rootの`src/`、`migrations/`、`astro.config.mjs`、`wrangler.jsonc`だけを実行対象とする。
本番deploy、実Access、Workers Builds、Deploy Hook配送記録は未実装・未検証。

## 完了した範囲

- 1 Worker + Static Assets。`assets.run_worker_first`で`/admin`と`/admin/*`のみWorker-first。
  公開DocsはStatic Assetsから直接配信され、D1/APIを呼ばない。
- `migrations/0001_docs.sql`: documents、document_revisions、media。D1 + Drizzle。
- Draft/public revision pointer、CRUD、optimistic version競合、revision一覧、Restore、Publish。
- Tiptapの基本編集、Table/Image/Video、Callout/Steps/Tabs node、最小Admin UI。
- HonoでAdmin APIを構成。CSRF middlewareとDocs/Media/export routesを分離。
- R2 Media upload/list/proxy。PNG/JPEG/WebP/AVIF/MP4/WebMのContent-Type・signature・最大10 MiB検証。
- build専用`/admin/export/snapshot`。productionではCloudflare Accessのpath policyで保護する。
- Published D1 snapshot → renderer → Astro/Starlight + Pagefindのローカルbuild。
- local Wranglerは認証なし。productionはCloudflare Access path policy、更新APIはOrigin/X-Requested-With確認。

## 実施済みローカル検証

`npm run migrate:local`、`npm run typegen`、`npm test`、`npm run check`、
`npm run build:empty`、`npm run dry-run`が成功。

MiniflareでD1/R2/ASSETSを束縛し、次を確認した。

1. 公開`/getting-started/`はStatic Assetsから200。
2. local WranglerでAdmin HTML、Document create、Publish、revision保存、Restore。
3. Publish後のDraft更新はbuild exportに混入しない。
4. local exportからPublished snapshotを取得し、`/local-guide/`とPagefindを生成。
5. 実PNGをR2へuploadし、D1 metadata一覧と認証済みmedia proxyから復元。

Astroにはsite未指定と空i18n collectionの警告、Zodにはdeprecation hintが残る。errorではない。
監査はWrangler→Miniflare→sharpのhigh 3件が残る。force fixは破壊的なWrangler変更を提案するため未実行。
Node 22.18.0ではundiciの>=22.19警告が出るため、22.22.2以上を使う。

実行時fixtureは削除済み。`npm run dev`は明示的な空site buildから開始し、公開内容の
確認は必ずlocal exportまたはWorkers BuildsのPublished snapshotを使用する。大きな動画は
P3以降にR2 multipart uploadを追加して扱う。

## P3: Publish → Workers Builds

1. `publish_deliveries`を追加。Publish/unpublish/delete/slug変更後に配送対象を記録する。
2. `WORKERS_DEPLOY_HOOK_URL`がある場合にPOSTし、失敗回数・次回retry・最後のエラーを保存する。
3. Adminで「build要求済み」と表示する。Hook 2xxを公開完了と表示しない。
4. build中の追加変更、失敗時再試行、削除・非公開後に古いroute/searchが残らないことを検証する。

## P4: Self-host / Cloudflare Access

1. D1/R2のremote provisioningとmigration、production binding設定をREADMEに確定する。
2. 同じhuman policyを持つAccess Applicationを`/admin`と`/admin/*`に設定し、build
   `/admin/export/*`はより具体的なApplicationとService Tokenで保護する。
3. R2 public/custom domainを`MEDIA_PUBLIC_URL`へ設定し、公開した画像/動画を実URLで確認する。
4. Workers Buildsのbuild secret、Deploy Hook、初回空サイト→通常CMS buildを実アカウントで確認する。
5. workers.dev/preview/管理assetsの迂回を検証する。Deploy to Cloudflareボタンと薄いテンプレートはその後。

## terraへの引き継ぎプロンプト

> AGENTS.md、docs/ARCHITECTURE.md、docs/ROADMAP.mdを読んでください。P0〜P2は
> ローカルMiniflareで検証済みです。次はP3の配送記録とDeploy Hook retryを実装し、
> その後P4で実Cloudflare Access service tokenとWorkers Buildsを接続してください。
> 汎用CMS/Auth/RBAC/workflow/plugin systemを作らず、既存のTiptap/Drizzle/Cloudflare機能と
> Docs向けGlueに限定してください。実Accessやdeployを行った場合だけ、その結果を記録してください。
