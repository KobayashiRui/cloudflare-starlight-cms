# Architecture
2026-09-09採用。P0〜P2はローカルMiniflareで確認済み。P3/P4は未完成。

## 1 repo / 1 Worker
公開Docs: Astro/Starlight SSG + Pagefind → Workers Static Assets。
管理: /admin（redirectのみ）と /admin/* → Access → Worker → D1/Drizzle、R2。
管理HTTPはHono、管理APIは /admin/api/*。`/admin/app.js`を含む`/admin/*`は本番では1つのAccess applicationのpath policyで保護し、
local Wranglerでは認証なしで動作する。選択的Worker-first設定は公式schemaで確認済みで、
公開閲覧でWorker/D1を呼ばない。
SonicJSなし。汎用CMS/Auth/RBAC/plugin/workflowは実装しない。

## 編集・Navigation・公開
`folder`と`document`は言語に依存しないidentityで、Treeの親子、URL segment、順序だけを持つ。
表示名は`folder_translation`、編集内容は`document_translation`に置く。Navigation Treeは
`src/locales.ts`の`defaultLocale`（`en`）で固定し、選択したDocumentの編集画面だけでtranslationを
切り替える。Tiptap JSONがそのTranslationのDraft正本で、
`published_revision_id`だけが公開中の不変snapshotを指す。`draft_revision_id`と`status`列は持たない。
`published_revision_id IS NULL`が未公開を表す。保存とRestoreは`document_revision`を新規追加し、Publishも現在のTranslationからrevisionを新規追加して
公開pointerを更新する。そのためDraftとPublishedは分離される。

Navigationはcontent revisionと分離した現在のTree状態である。`folder.parent_id IS NULL`と
`document.folder_id IS NULL`はrootを表す。Folderは本文を持たないDocs専用のNavigation nodeで、
FolderとDocumentは同じ親内でslugを共有できない。DBのpartial unique indexで各テーブル内の
root/child slugを保護し、テーブルをまたぐ衝突はNavigation APIが検査する。
Folderのrename/move、Documentのfolder移動・並べ替えはNavigation変更としてそのまま公開Treeへ反映し、
Deploy Hookの配送対象にする。Document Restoreは本文/title/descriptionだけを戻し、
Navigationは復元しない。

DocumentとFolderの`slug`は一階層のURL segmentであり、全translationで共有する。exportはTreeをたどり完全なpathを作り、
そのpathをStarlight loaderのfilePathに渡す。Treeがそのまま公開URLとStarlight sidebarの階層となる。
AdminのTree UIは`@headless-tree/core`と`@headless-tree/react`を使う。展開、Folder/Page選択、
Folder作成・rename・削除、Page作成、pointer D&Dとkeyboard D&Dを実装済みである。D&Dは公式の
`dragAndDropFeature`／`keyboardDragAndDropFeature`のtarget semanticsを使い、Workerが移動先の
slug衝突、循環、同階層の順序再採番を検査する。独自Tree engineは作らない。
Tiptap既存rendererを利用し、Callout→Aside、Steps→Steps、Tabs→Tabs、
Video→静的videoの不足だけを実装する。Astro Loaderとの接続はlocal D1 exportから実際の出力で検証済み。
未知nodeの黙殺や本文のMDX/JS実行は禁止。

Previewは`/admin/preview/:documentId?locale=`で保存済みDraftを表示する。Astro buildは
`src/pages/cms-preview-shell.astro`（locale routeを含む）を通常のStarlight設定・ユーザーCSS・header/sidebarとともに生成する。
WorkerはそのStatic Assets shellを`env.ASSETS.fetch()`で読み、D1のDraft title・description・本文を
HTMLRewriterで差し込む。Previewは単一localeのDraftを示すためpublic language selectorを除去する。Previewも`/admin/*`のAccess配下であり、`Cache-Control: private, no-store`と
`X-Robots-Tag: noindex, nofollow`を返す。Preview操作では静的build、Pagefind、Deploy Hookを実行しない。
本文のTiptap JSONは一度だけrenderし、GitHub互換slugの見出しanchorとdesktop/mobile TOCを同時に作る。
Starlight build済みのTOCコンテナ・class・幅は維持し、静的shellの`Overview`だけをDraft見出しの項目へ置換する。
本文は公開Markdown rendererと同じ検証済みTiptap node modelから安全なHTMLを生成する。Astroのlayout・theme・
sidebar・ユーザーCSSは同じ成果物を使うが、Astro build専用の任意MDX/remark変換やShikiの実行をWorkerで再実行しない。

## Build
Access Applicationは`admin/*`の1つだけにする。人間向け`Allow` policyと、Workers Builds用Service Tokenを
Includeした`Service Auth` policyを同じApplicationに置く。`/admin`はこのwildcardに一致しないため、Workerは
`/admin/`へのredirectだけを返す。localでは認証なしで動作する。WorkerはAccess JWT/AUDを解釈しない。
BuildはService Tokenを`CF-Access-Client-Id`と`CF-Access-Client-Secret`で提示してexportを取得する。
この単純な構成ではBuild Tokenも`/admin/*`へ到達できるため、Build環境を管理権限を持つ信頼済み環境として扱い、
漏えい時はTokenを無効化または削除してBuild secretsを更新する。
exportはDB内部schemaと分離したversioned DTOでPublished全件の一貫したsnapshotを返す。
Loaderは全検証/render後にstoreを置換。失敗はbuild失敗、前回deployを維持する。
初回は明示的な空サイト＋Adminをdeployし、export設定後に通常buildへ移る。
通信失敗時のfallbackとして初回モードを使わない。

localの`npm run dev`はrootのNode coordinatorがAdmin Worker（8787）とStatic Docs preview（4321）を起動する。
Published snapshotの変更時だけAstro buildを実行し、`dist`をWorker用`.dev-assets`へ同期するため、local Previewも
productionと同じStatic Assets shellを読む。失敗した内容を繰り返しbuildせず、修正後は再起動または次の公開変更で再確認する。Adminはesbuild watchで更新する。
これはlocal限定の開発補助であり、appsや二つ目のWorkerは追加しない。

## Hook / Media / Setup
公開revision確定と`publish_delivery`の保存を同じD1 batchで行った後、Deploy Hook→Workers Builds→
同Workerを更新する。配送記録は対象（document/site）、Hook要求回数、Cloudflare build UUID、受理／失敗、
最後のエラー、次回retry時刻を持つ。Hook受理は公開完了ではない。`next_retry_at`はpending送信の30秒の占有期限として使用する（自動retry時刻ではない）。failedと期限切れpendingをAdminから手動retryできる。
URL・Tree変更と削除は同じD1 batchにsite配送を記録し、更新成功後に送信する。
Hook URLがないlocalは`skipped`として記録し、外部へは送信しない。削除・slug・Navigation変更は自動配送し、ヘッダーのRebuild public siteは手動の再要求として残す。実配送はP4で実Accessとともに検証する。
Mediaは既存upload UI＋R2＋D1 metadataと小さなPicker。
6形式、片側失敗、使用中削除を検証。Worker経由uploadは10 MiBまでとし、大きい動画は
R2 multipart uploadを追加して扱う。`MEDIA_PUBLIC_URL`はR2 public/custom domainに必須で、
Admin専用URLを含むPublished snapshotはbuildを失敗させる。公開R2 URLはDraftでも秘匿されない。
Accessだけが人の許可を決定する。WorkerはJWTを解釈せず、CSRF対策だけを実施する。
`wrangler.jsonc`はaccount固有のD1 database ID、D1 database name、R2 bucket nameを持たず、`DB`と`MEDIA`のbindingだけを宣言する。
Cloudflare Automatic Resource Provisioningが初回deploy時にD1/R2を作成してbindingする。GitHub経由のdeployでは作成後のIDはDashboardで管理され、repositoryへ書き戻されない。
create CLIは出力先のproject名をWorker名へ設定するため、生成projectごとに自動作成リソースも分離される。
Workers Buildsは常に`npm run build`を実行する。初回は`CMS_ORIGIN`と`siteConfig.url`が空のため、明示的な空サイトを生成する。custom domain接続後にBuild Variableの`CMS_ORIGIN`を設定すると、Astroの公開URLとAccess経由のPublished snapshot endpointを同じoriginから導出する。Deploy commandの`npm run deploy`が`DB`へのremote migrationを適用してからWorkerをdeployする。
まず単一repoで完成。薄いテンプレート/パッケージ公開はMVP後。
Cloudflare/Astro非公式。無料運用は保証しない。

## i18n
サイト名・URL・対応言語は`src/site.config.ts`で定義し、AdminとStarlightで共有する。新しいPage/Folderはdefault locale（現在は`en`）で作成し、
別言語はDocumentのLanguageから既存translationをDraftとして複製する。Treeは言語によって切り替えず、
Folder/Pageの構造は常に共通である。Published snapshotはlocaleごとの公開revisionだけを含むv3 DTOであり、
Starlight loaderはdefault localeをunprefixed path、その他をlocale prefixのfilePathへ変換する。Draft本文は公開されない。未翻訳のURLにはStarlight標準の既定言語fallbackを使用する。

公開exportはFolder・翻訳名・Published revisionを同一D1 batchで読む。更新日時は公開revisionの日時を使う。Navigation祖先のラベル・翻訳・順序を小さなDTOとして送り、Starlight標準sidebarへ変換する。Astro configとContent Loaderは同じbuildプロセス内で一度取得したsnapshotを共有する。
