# Roadmap / terra引き継ぎ

## 現在地（2026-09-10）

Admin UIのレイアウト修正を完了した。公式Simple Editorの単体ページ用`100vw`/`100vh`を
管理画面の編集領域へscopeした。左の文書ナビと、Title・Descriptionの入力枠を持つ中央の編集領域へ
再構成している。中央の編集領域はサイドバー以外の横幅を使う。Contentは外側のカードを持たず、公式Simple Editorの背景色・toolbar・本文スタイルを
使い、wrapperの縁だけを角丸にする。CMS側は全画面wrapperを編集領域へ収め、公式の本文列をDocs向けに54remへ広げるだけを上書きする。Descriptionはタイトル直下で編集し、
Page settings panelと手動slug入力は置かない。
テーマはAuto（OS追従）/ Light / Darkを選択でき、選択値をbrowser local storageに保存する。
`npm run check:admin`を追加し、Worker側とは別にReact/Tiptap sourceも型検査する。
React／テンプレート導入の変更は未コミット。次の実装優先度はP2.5のNavigation Tree操作である。

P0〜P2の基盤はローカルMVPとして実装したが、Navigation Tree導入に伴いD1 schemaとAdmin APIを
作り直す。旧local D1は削除し、migrationは新しい単一の`0001`のみへ統合する。
SonicJS、workspaces、内部user/RBAC/KVは撤去済み。
rootの`src/`、`migrations/`、`astro.config.mjs`、`wrangler.jsonc`だけを実行対象とする。
本番deploy、実Access、Workers Builds、Deploy Hook配送記録は未実装・未検証。

## 完了した範囲

- 1 Worker + Static Assets。`assets.run_worker_first`で`/admin`と`/admin/*`のみWorker-first。
  公開DocsはStatic Assetsから直接配信され、D1/APIを呼ばない。
- `migrations/0001_schema.sql`: folder、document、document_revision、media。D1 + Drizzle。
- Draft/public revision pointer、CRUD、optimistic version競合、revision一覧、Restore、Publish。
- Tiptap公式Simple Editor（MIT source）を組み込んだReact Admin UI、Table/Image/Video、Callout/Steps/Tabs node。
  Mediaはdialogからカーソルへ挿入し、下書きの未保存状態を文書切替時に確認する。
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

## P2.5: Docs Navigation Tree / schema reset

1. 旧local D1とmigrationを削除し、単数形の`folder`、`document`、`document_revision`、`media`だけを持つ新しい`0001`を作る。
2. rootは`NULL` parent/folderで表現する。仮想root rowは作らない。partial unique indexとAPI検査でFolder/Documentのslug衝突を拒否する。
3. `document`はDraft、`published_revision_id`は公開snapshotを表す。Navigationはrevisionに含めず、FolderとDocumentの現在位置を正本にする。
4. `@headless-tree/core`と`@headless-tree/react`でAdminの左ペインをFolder/PageのNavigation Treeへ置き換える。
5. exportがTreeから完全なStarlight filePathを作り、Folder/Pageの移動、rename、削除、公開snapshotをローカルで検証する。

進行状況: 新しいsingle migrationをlocal D1へ適用済み。Folder作成、Folder配下のDocument作成、
Publish、`/admin/export/snapshot`の`guides/install`生成、Astro/Starlightの`/guides/install/`静的生成を
確認済み。`@headless-tree/react`によるFolder/PageのTree表示とページ選択をAdminへ接続済み。
旧Section UIを削除し、Document APIの`folderId`へ統一した。Folder update/move/deleteとDocument moveの
Hono APIは実装済みで、親Folderの存在確認とTree循環を拒否する。Admin UIからのFolder操作、D&D、
キーボード操作は未実装。

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

> AGENTS.md、README.md、docs/ARCHITECTURE.md、docs/ROADMAP.mdを読んでください。
> P2.5のNavigation Treeを完成させます。Folder作成・rename・削除、Documentの移動・並べ替え、
> headless-treeのD&Dとキーボード操作を、既存のHono Navigation APIと単一migrationに接続してください。
> Treeの変更からPublished exportまでをlocal Miniflareで検証し、deployはしないでください。
> 汎用CMS/Auth/RBAC/workflow/plugin systemを作らず、既存のTiptap/Drizzle/Cloudflare機能と
> Docs向けGlueに限定してください。実Accessやdeployを行った場合だけ、その結果を記録してください。
