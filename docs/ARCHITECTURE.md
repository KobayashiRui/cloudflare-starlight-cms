# Architecture
2026-09-09採用。P0〜P2はローカルMiniflareで確認済み。P3/P4は未完成。

## 1 repo / 1 Worker
公開Docs: Astro/Starlight SSG + Pagefind → Workers Static Assets。
管理: /admin と /admin/* → Access → Worker → D1/Drizzle、R2。
管理HTTPはHono、管理APIは /admin/api/*。`/admin/app.js`を含む`/admin/*`は本番ではAccess applicationのpath policyで保護し、
local Wranglerでは認証なしで動作する。選択的Worker-first設定は公式schemaで確認済みで、
公開閲覧でWorker/D1を呼ばない。
SonicJSなし。汎用CMS/Auth/RBAC/plugin/workflowは実装しない。

## 編集・Navigation・公開
`folder`と`document`は言語に依存しないidentityで、Treeの親子、URL segment、順序だけを持つ。
表示名は`folder_translation`、編集内容は`document_translation`に置く。現在の管理UIは
`src/locales.ts`の`defaultLocale`（`en`）に固定されている。Tiptap JSONがそのTranslationのDraft正本で、
`published_revision_id`だけが公開中の不変snapshotを指す。`draft_revision_id`と`status`列は持たない。
`published_revision_id IS NULL`が未公開を表す。保存とRestoreは`document_revision`を新規追加し、Publishも現在のTranslationからrevisionを新規追加して
公開pointerを更新する。そのためDraftとPublishedは分離される。

Navigationはcontent revisionと分離した現在のTree状態である。`folder.parent_id IS NULL`と
`document.folder_id IS NULL`はrootを表す。Folderは本文を持たないDocs専用のNavigation nodeで、
FolderとDocumentは同じ親内でslugを共有できない。DBのpartial unique indexで各テーブル内の
root/child slugを保護し、テーブルをまたぐ衝突はNavigation APIが検査する。
Folderのrename/move、Documentのfolder移動・並べ替えはNavigation変更としてそのまま公開Treeへ反映し、
Deploy Hookの配送対象にする。Document Restoreは本文/title/description/slugだけを戻し、
Navigationは復元しない。

DocumentとFolderの`slug`は一階層のURL segmentであり、全translationで共有する。exportはTreeをたどり完全なpathを作り、
そのpathをStarlight loaderのfilePathに渡す。Treeがそのまま公開URLとStarlight sidebarの階層となる。
AdminのTree UIは`@headless-tree/core`と`@headless-tree/react`を使う。現時点では展開と選択を実装済みで、
D&Dとキーボード操作はP2.5の残作業である。独自Tree engineは作らない。
Tiptap既存rendererを利用し、Callout→Aside、Steps→Steps、Tabs→Tabs、
Video→静的videoの不足だけを実装する。Astro Loaderとの接続はlocal D1 exportから実際の出力で検証済み。
未知nodeの黙殺や本文のMDX/JS実行は禁止。

## Build
同じhuman policyを持つ`/admin`と`/admin/*`を別Applicationとして設定する。専用Access
application/service tokenで保護したexportを同じWorkerに設ける。localでは認証なしで動作する。
例: /admin/export/* をhuman用 /admin/* より具体的なapplicationで保護し、
WorkerはAccess JWT/AUDを解釈せず、URLごとのAccess Applicationで人間用Adminとbuild exportを分離する。
path優先順位とservice identity claimsは公式資料/実環境で確認する。
exportはDB内部schemaと分離したversioned DTOでPublished全件の一貫したsnapshotを返す。
Loaderは全検証/render後にstoreを置換。失敗はbuild失敗、前回deployを維持する。
初回は明示的な空サイト＋Adminをdeployし、export設定後に通常buildへ移る。
通信失敗時のfallbackとして初回モードを使わない。

## Hook / Media / Setup
公開revision確定と小さな配送記録の保存後、Deploy Hook→Workers Builds→同Workerを更新。
Hook受理は公開完了ではない。retryを用意し、Unpublish/delete/slug変更も反映。
Mediaは既存upload UI＋R2＋D1 metadataと小さなPicker。
6形式、片側失敗、使用中削除を検証。Worker経由uploadは10 MiBまでとし、大きい動画は
R2 multipart uploadを追加して扱う。`MEDIA_PUBLIC_URL`はR2 public/custom domainに必須で、
Admin専用URLを含むPublished snapshotはbuildを失敗させる。公開R2 URLはDraftでも秘匿されない。
Accessだけが人の許可を決定する。WorkerはJWTを解釈せず、CSRF対策だけを実施する。
まず単一repoで完成。薄いテンプレート/パッケージ公開はMVP後。
Cloudflare/Astro非公式。無料運用は保証しない。

## i18nの段階導入
DBは最初から`en`と`ja`を保存できるが、P2.5では`en`だけを作成・編集・exportする。
P2.6でlocale selector、翻訳作成、missing translation表示を追加した後、Starlight Adapterでdefault localeを
unprefixed path、その他をlocale prefixへ変換する。途中段階で不完全なlocaleを公開しない。
