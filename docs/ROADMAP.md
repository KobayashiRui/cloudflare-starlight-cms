# Roadmap / terra引き継ぎ

## v1.0.0: first stable release（2026-09-14）

- `create-starlight-cms`を`1.0.0`へ更新する。公開Docs、Cloudflare Access保護Admin、D1/R2、Draft・Revision・多言語、Workers Builds、Deploy Hook、CLI生成・安全なtemplate upgradeを最初の安定範囲とする。
- 大容量動画のmultipart upload、非公開Draft media、共同編集、汎用workflowは意図的に含めない。Worker経由のmedia uploadは10 MiBまでとする。

## Editor local drafts and locale continuity（2026-09-14）

- Dexie 4.4.6を使い、保存済みPageの未保存編集をbrowser内のIndexedDBへ保持する。Page移動・言語切替・reloadでnativeのDiscard確認を出さず、同じD1 versionなら編集内容を復元する。
- ローカル下書きはD1のrevisionやPublish対象にはならない。`Save draft`でのみD1へ保存し、D1更新とのversion不一致時はlocal/savedの選択を明示する。新規Pageは最初のD1保存後から対象にする。
- Media deletionは、このbrowserのlocal draftがURLを参照している場合も拒否する。R2 blobやD1全体をIndexedDBへ複製しない。
- Public media URLs reject HTTP and private-network hosts before persistence, while normal HTTP(S) links remain supported. This avoids Mixed Content and Private Network Access errors in the HTTPS Admin and public site.
- HTML paste drops unsafe image/video nodes before they reach the saved document, preserving image alt text when available and guiding the editor to upload media instead.
- 最後に選んだ編集localeをbrowser local storageに保持する。Navigation Treeの構造は共通のままで、PageやFolder選択後も編集localeを維持する。
- Translation未作成のPageを選んでもTreeの選択状態を維持する。Save前のNew pageは親Folder内（rootの場合はroot）の一時nodeとして表示し、保存までTreeの並べ替えを停止する。

## Publish scopes（2026-09-14）

- Document画面の`Publish page`はそのページ・言語だけを公開し、headerの`Publish changes`は保存済みDraft／変更を全言語横断で公開してDeploy Hookを一度だけ要求する。未保存のeditor内容は一括公開に含めない。
- `Rebuild public site`を削除した。変更なしの手動再buildは通常運用に不要であり、失敗した配送だけを`Retry build`で再送する。

## Production setup documentation（2026-09-14）

- READMEを実運用の順序へ更新した。初回空Deploy、Access Self-hosted public application、人間向けAllow policy、Build用Service Auth policy、Build Secrets、Worker custom domain、R2 custom domain、Runtime Deploy Hookを分離している。
- Build用Service Tokenを人間向けAllow policyへ追加するだけではAccess loginへredirectされる。Service Auth policyを同じApplicationに追加する。
- R2公開mediaは`docs-media.example.com`のようなDocs Workerと別のcustom domainを使う。通常の画像・動画埋め込みにCORS policyは不要で、Draft mediaは公開URLから秘匿されない。

## Folder translation UI（2026-09-14）

- Folderを選択した画面にLanguage selectorを追加した。Navigation Treeはdefault localeで共通のまま、Folderの表示名だけをlocaleごとに切り替え、未作成localeは既存の名前をコピーして作成できる。
- URL segment・親子関係・順序は全localeで共有し、非default localeでURL segmentを変更できないようにした。
- Miniflare integration testで`en`/`ja`のFolder名が独立し、共通slugを維持することを確認した。

## v0.10.0: safe template upgrades（2026-09-14）

- `create-starlight-cms upgrade [directory]`を追加する。生成projectが記録したtemplate versionのCLIをnpmから一時取得し、旧template・最新template・projectを比較する。
- 初回はdry-run。`--apply`は未変更fileのみ更新し、競合があれば一切変更しない。package.jsonのmanaged dependency/scriptだけを3者比較し、lockfileは利用者が`npm install`で更新する。

## v0.9.2: YouTube embeds（2026-09-14）

- Tiptap公式`@tiptap/extension-youtube`をAdminへ追加し、toolbarからYouTube / youtu.be URLを挿入できるようにした。
- 公開Markdown rendererとAccess配下Preview rendererは同じURL検証を使い、11文字のvideo IDだけを
  `youtube-nocookie.com` iframeへ正規化する。任意iframe・任意hostは受け付けない。
- MiniflareのPreviewとAstro/Starlightの実静的buildで、生成HTMLにprivacy-enhanced iframeが含まれることを確認した。
- CLI packageを`0.9.2`へ更新する。

## P7: CLI main-branch release automation（2026-09-14）

- `main`へのCLI package manifest変更を契機に`create-starlight-cms`だけを公開するGitHub Actions workflowを追加した。npm registryに同一versionがある場合はskipし、未公開versionだけ既存release check後にpublishする。`workflow_dispatch`で失敗した未公開versionをversion変更なしでretryできる。
- npm Trusted Publisher（GitHub Actions OIDC）を前提にし、npm access tokenをGitHub Secretsへ保存しない。初回はnpm package settingsでrepository / `publish.yml` / `npm publish`を設定する。OIDC要件を満たすnpm 11.5.2と、空のlegacy認証設定を生成しないsetup-node v7をworkflowで明示する。

## P6: v0.9.1 Zod API cleanup（2026-09-14）

- Zod 4.6.4のdeprecated APIを`z.looseObject()`、`z.uuid()`、`z.iso.datetime()`へ置き換え、型検査の9 hintを解消する。CLI packageを`0.9.1`へ更新する。

## P1–P2: secure setup and generated project hygiene（2026-09-14）

- Production setupは、custom domainをWorkerへ接続する前に、予定hostnameの`admin/*`を保護する単一のCloudflare Access Applicationと人間向けAllow policyを作る順序へ変更した。接続時からAdmin APIを含む`/admin/*`がAccess配下になる。実Accessの設定・接続はP4で実アカウント検証を継続する。
- CLI templateからrootリポジトリ専用の`release:check`、`release:dry-run`、`publish:cli`を除外した。生成projectには存在しないCLI packageへの参照を残さず、template testとnpm tarball release checkで混入を検査する。
- `zod`を直接依存の`4.6.4`へ固定する。Astroなどの間接依存に依存しない。

## P5 npm release preparation（2026-09-13）

- `create-starlight-cms`をv0.9.0として公開準備した。npm package metadata、public access、Node 22.19以上を明記した。
- rootの`npm run release:check`はcheck/test/空サイトbuild/Worker dry-runに加え、実tgzを一時installしてCLI生成とLinux lock検査まで行う。`prepublishOnly`にも同じ検査を設定した。
- `npm run release:dry-run`でnpm publish lifecycleを検証済み。実npm公開、package name所有権の最終確認、公開後のregistry経由smoke testはリリース担当者が行う。

## P0 deployment bootstrap（2026-09-13）

- 標準`npx wrangler deploy`を採用。deploy scriptからremote migration前提を除去。
- 同梱0001/0002 SQLを正本に、管理DBアクセス前の初期化とWrangler互換履歴を追加。失敗・再試行・同時初期化を一時D1で検証する。将来のALTER/backfillの自動化は対象外。
- CLIの同名Worker生成エラーとLinux検証scriptの梱包漏れを修正。
- Wrangler 4.130.0の同名メッセージはD1作成APIの7502応答由来。成功したWorkerのbinding継承実装は存在するが、削除後に7502が返る実アカウント側原因は未確認。Audit Logsと重複buildの確認が必要。リソース削除・本番deployは行っていない。
- 非本番branch buildsは初期setupで無効にする。下記の古いremote migration前提の記述は本節で置き換える。
- 検証: check成功（既存hint 9）、38テスト成功（空DB・同時初期化・失敗後retry・Published Astro buildを含む）、空サイトbuild、Worker dry-run成功。実npm tarballから同名project生成とLinux lock検査も成功。実Cloudflareの初回/再deployと削除後7502の原因確認は未完了。

## 現在地（2026-09-11）

`packages/create-starlight-cms`に、rootアプリをrelease時に同梱templateへ変換する最小CLIを追加した。
`npx create-starlight-cms@latest <directory>`（または`.`）で、My Docs / en-onlyの独立projectを作る。
CLIは未公開で、npm publishは別工程である。自動更新・install・Git初期化・deployは行わない。
fresh local DBの非対話migration、`dist`を共有するAdmin/Public assets、実npm tgzからのproject生成とlocal Admin assetsの200応答まで検証済み。
詳細は[TEMPLATE-PLAN.md](TEMPLATE-PLAN.md)を参照。

公開の整合性とfork後の設定を整理した。
- exportのD1読取をbatch化し、公開更新日時をrevisionから取得。Draft保存でsnapshotは変わらない。
- Folderラベル・翻訳・順序をStarlight標準sidebarへ接続。未翻訳URLは標準fallbackを採用。
- 削除・URL変更・Tree移動の配送をDB更新と同一batchへ追加。failedと期限切れpendingは手動retry。
- サイト設定をsrc/site.config.tsへ集約。ローカルはWrangler＋Astro preview、Adminはesbuild watch。
- 一時Miniflare D1でDraft分離・競合・移動・削除を検証し、実Starlight buildでsidebar・fallback・Pagefind・旧URL消去を確認。
- Accessは`admin/*`の単一Applicationへ統一する。`/admin`は`/admin/`へのredirectのみ、Buildは同ApplicationのService Tokenでexportを読む。BuildにD1/API Tokenは渡さない。
- `/admin/preview/:documentId?locale=`は保存済みDraftを最新のStarlight build shellへ差し込む。同じTiptap renderから生成する実見出しTOCで、公開側と同じ右・モバイルの目次領域と幅を維持する。PreviewはAccess配下で、静的build・Pagefind・Deploy Hookは発火しない。`private, no-store`と`noindex`を返す。
- 本番Access／Workers Buildsの実接続は未検証。コミット後の次工程とする。

Admin UIのレイアウト修正を完了した。公式Simple Editorの単体ページ用`100vw`/`100vh`を
管理画面の編集領域へscopeした。左の文書ナビと、Title・Descriptionの入力枠を持つ中央の編集領域へ
再構成している。中央の編集領域はサイドバー以外の横幅を使う。Contentは外側のカードを持たず、公式Simple Editorの背景色・toolbar・本文スタイルを
使い、wrapperの縁だけを角丸にする。CMS側は全画面wrapperを編集領域へ収め、公式の本文列をDocs向けに54remへ広げるだけを上書きする。Descriptionはタイトル直下で編集し、
Page settings panelは置かず、URL segmentは上部で編集する。
テーマはSystem（OS追従）を初期値とし、右端の太陽／月ボタンで必要時だけ明暗を直接切り替える。選択値をbrowser local storageに保存する。
Document操作はmain上部に置き、左にstatus、右端にHistory drawer toggle、その左にSave draftを置く。Deleteは本文下部のDanger zoneに分離する。Historyはactive状態を持ち、同じボタン／Close／Escで閉じられる、右側の高さを制限したdrawerで表示する。
Breadcrumbは表示上のrootを`Documents`とし、内部root pathを見せずChevronRightでフォルダ階層を区切る。
`npm run check:admin`を追加し、Worker側とは別にReact/Tiptap sourceも型検査する。
P3のPublish → Workers Builds配送のローカル実装まで完了した。次はP4の実Cloudflare Access / Workers Builds接続である。

`0001_schema.sql`はi18n-readyへ更新済み。`folder` / `document`は言語非依存のTree identity、
`folder_translation` / `document_translation`はlocaleごとの表示・編集状態、`document_revision`は
translation単位のsnapshotである。Treeはdefault locale（`en`）で固定し、Document編集画面でtranslationを
切り替える。未作成のtranslationは既存translationをコピーしたDraftとして作成する。

P0〜P2の基盤とNavigation Treeを実装済み。schemaは0001、配送記録は0002で管理する。既存のローカルDBは今回削除していない。
SonicJS、workspaces、内部user/RBAC/KVは撤去済み。
rootの`src/`、`migrations/`、`astro.config.mjs`、`wrangler.jsonc`だけを実行対象とする。
本番deploy、実Access、Workers Buildsは未実装・未検証。Deploy Hook配送記録と手動retryは
local実装・検証済みである。

## 完了した範囲

- 1 Worker + Static Assets。`assets.run_worker_first`で`/admin`と`/admin/*`のみWorker-first。
  公開DocsはStatic Assetsから直接配信され、D1/APIを呼ばない。
- `migrations/0001_schema.sql`: folder、folder_translation、document、document_translation、document_revision、media。D1 + Drizzle。
- Draft Translation/public revision pointer、CRUD、optimistic version競合、revision一覧、Restore、Publish。
- Tiptap公式Simple Editor（MIT source）を組み込んだReact Admin UI、Table/Image/Video、Callout/Steps/Tabs node。
  Mediaはdialogからカーソルへ挿入し、下書きの未保存状態を文書切替時に確認する。
- HonoでAdmin APIを構成。CSRF middlewareとDocs/Media/export routesを分離。
- R2 Media upload/list/proxy。PNG/JPEG/WebP/AVIF/MP4/WebMのContent-Type・signature・最大10 MiB検証。
- Media一覧はDraft・公開revision・履歴を参照し、未使用のassetだけ削除する。Media folder/tagなどの管理機能は追加しない。
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
以前の依存監査記録は現行lockfileの状態を保証しない。依存更新時に再確認する。
Node 22.18.0ではundiciの>=22.19警告が出るため、22.22.2以上を使う。

実行時fixtureは削除済み。`npm run dev`はPublished snapshotから初回buildし、公開内容の
確認にはlocal exportまたはWorkers BuildsのPublished snapshotを使用する。`npm run dev`は
Admin（8787）とStatic Docs preview（4321）を起動し、Publish後のsnapshot変更を自動buildする。大きな動画は
P3以降にR2 multipart uploadを追加して扱う。

## P2.5: Docs Navigation Tree / schema reset

1. 旧local D1とmigrationを削除し、単数形の`folder`、`folder_translation`、`document`、`document_translation`、`document_revision`、`media`を持つ新しい`0001`を作る。
2. rootは`NULL` parent/folderで表現する。仮想root rowは作らない。partial unique indexとAPI検査でFolder/Documentのslug衝突を拒否する。
3. `document_translation`はDraft、`published_revision_id`はtranslationごとの公開snapshotを表す。Navigationはrevisionに含めず、FolderとDocumentの現在位置を正本にする。
4. `@headless-tree/core`と`@headless-tree/react`でAdminの左ペインをFolder/PageのNavigation Treeへ置き換える。
5. exportがTreeから完全なStarlight filePathを作り、Folder/Pageの移動、rename、削除、公開snapshotをローカルで検証する。

進行状況: 新しいsingle migrationをlocal D1へ適用済み。default localeのDocument作成、
Publish、`/admin/export/snapshot`からPublished revisionのみを生成することをlocal Wranglerで確認済み。
Folder作成、Folder配下のDocument作成、`/admin/export/snapshot`の`guides/install`生成、Astro/Starlightの`/guides/install/`静的生成を
確認済み。`@headless-tree/react`によるFolder/PageのTree表示とページ選択をAdminへ接続済み。
旧Section UIを削除し、Document APIの`folderId`へ統一した。Folder update/move/deleteとDocument moveの
Hono APIは実装済みで、親Folderの存在確認、slug衝突、Tree循環を拒否し、移動後の同階層順序を再採番する。
Admin UIからFolder作成・rename・削除、選択Folder配下のPage／Folder作成、pointer D&D、
keyboard D&D（Control+Shift+D、Arrow keys、Enter、Escape）を接続済み。

## P2.6: Locale UI / Starlight i18n — 完了

1. `src/locales.ts`を唯一のlocale設定とし、Treeはdefault localeで固定した。
2. Document編集画面のLanguageでtranslationを切り替える。存在しない言語を選ぶと、実在するtranslationからDraftを作成できる。
3. Published snapshot v3とStarlight loaderはdefault localeをunprefixed path、追加localeをprefix pathへ出力する。
4. translationごとの公開pointerだけをexportし、Draft translationを静的サイトへ含めない。local Wranglerで`/test/test/`と`/ja/test/test/`の生成を確認済み。

## P3: Publish → Workers Builds

1. `publish_delivery`を追加。Document Publishでは公開revision pointerと同じD1 batchでpending配送を保存する。site rebuildは単独の配送を保存する。完了。
2. `WORKERS_DEPLOY_HOOK_URL`がある場合にPOSTし、失敗回数・次回retry・最後のエラーを保存する。URL未設定のlocalは`skipped`。完了。
3. Adminで「Build requested」と表示する。Hook 2xxを公開完了と表示しない。failedはheaderからretryできる。完了。
4. TreeではtranslationごとにDraft／Changesを集約表示する。下書き保存と`Publish page`は本文の操作、`Publish changes`はheaderに分離した。完了。
5. build中の追加変更、unpublish/delete/slug/navigation変更による古いroute/searchの消去と、実Deploy Hookの受理はP4の実Cloudflare環境で検証する。

## P4: Self-host / Cloudflare Access

1. D1/R2はAutomatic Resource Provisioningへ委ね、account固有のID/nameを`wrangler.jsonc`へ置かない。create CLIはproject名をWorker名へ設定し、`DB`/`MEDIA`のbinding-only定義で生成projectごとのresource名衝突を避ける。Workers BuildsのDeploy commandでremote migrationを適用する。実アカウントで初回provisionとmigrationの順序を確認する。
2. `admin/*`のAccess Applicationを1つ設定し、人間向けAllow policyとWorkers Builds用Service Tokenの
   Service Auth policyを追加する。`/admin`は`/admin/`へのredirectだけを返す。BuildはD1権限を持たず、
   Service TokenでPublished exportを取得する。Token漏えい時の失効・再発行・Build secret更新を検証する。
3. R2 public/custom domainを`MEDIA_PUBLIC_URL`へ設定し、公開した画像/動画を実URLで確認する。
4. Workers Buildsのbuild secret、Deploy Hook、初回空サイト→通常CMS buildを実アカウントで確認する。
5. workers.dev/preview/管理assetsの迂回を検証する。Deploy to Cloudflareボタンと薄いテンプレートはその後。

## terraへの引き継ぎプロンプト

### Navigation D&D修正（2026-09-10）

- `syncDataLoader`が読むchildrenを公式`createOnDropHandler`のcallbackで同期更新する。
  元の親から削除した配列を更新しなかったことが、同階層移動時の重複の原因だった。
- 中間状態をHTTP送信せず、完成した移動先childrenだけを保存する。保存中の追加ドラッグを抑止し、失敗時は配列を戻す。
- Tree本体とスクロール領域を分離し、左に伸びるdraglineのクリップと丸のbox-sizingを修正。
- 実Headless Treeで同階層移動・root移動を検証。ローカルD1でも並べ替え・root移動・GETでの永続化を確認。
  マウスポインタによる全ドロップ境界の視覚検証は未完了。

> AGENTS.md、README.md、docs/ARCHITECTURE.md、docs/ROADMAP.mdを読んでください。
> P2.5のNavigation Treeを完成させます。Folder作成・rename・削除、Documentの移動・並べ替え、
> headless-treeのD&Dとキーボード操作を、既存のHono Navigation APIと単一migrationに接続してください。
> Treeの変更からPublished exportまでをlocal Miniflareで検証し、deployはしないでください。
> 汎用CMS/Auth/RBAC/workflow/plugin systemを作らず、既存のTiptap/Drizzle/Cloudflare機能と
> Docs向けGlueに限定してください。実Accessやdeployを行った場合だけ、その結果を記録してください。

## 2026-09-11 公開整合性の検証

`npm run check`（error 0、既存Zod hint 9）、`npm test`（31件）、`npm run build:empty`、`npm run dry-run`を確認。
結合テストは一時Miniflare D1を使用し、実Astro buildを行う。通常の開発用DBを変更しない。
Wrangler＋Admin watch＋Astro previewのローカル起動を確認。PreviewはD1 DraftとStatic Assetsの`cms-preview-shell`を結合して返す。本番deployは未実施。
