# cloudflare-starlight-cms — 開発ルール

## 最初に読む
README.md → docs/ARCHITECTURE.md → docs/ROADMAP.md。
2026-09-09にSonicJS依存から方針変更。旧SonicJS調査は参考資料であり実装指示ではない。

## 最優先
**汎用CMSを作らない。既存OSS/Cloudflareを部品として使い、Docs向けGlueだけ実装する。**
なるべくシンプルにする。不要な旧コードを無理に再利用しない。互換層や将来用の抽象化を増やさない。
SonicJS等の汎用CMSに依存しない。CloudCore/SonicJSは参考実装に限定する。
参考コードの採用時は出典とライセンス表示を維持する。

## 採用
- Admin UI: React。Editor: Tiptap公式Simple Editor（MIT source）+ `@tiptap/react`。正本はTiptap JSON。Editor engineは自作しない。
- DB: Cloudflare D1 + Drizzle。Media: R2。
- Auth: Cloudflare Accessのみ。
- Public: Astro + Starlight SSG、Search: 標準Pagefind。
- Build: Workers Builds、Publish: Deploy Hook、Hosting: Workers Static Assets。

## 作らないもの
ユーザー管理、パスワード、独自Session、OAuth、OTP、Magic Link、2FA、RBAC、
汎用Collection Builder、workflow engine、plugin system、独自SSG/Search、
共同編集/CRDTは作らない。Access通過者は全員同じ管理権限。内部共通ユーザーも不要。
独自実装はDocs UI/schema、Docs向けTiptap node、Media Glue、
revision snapshot、build adapter、Hook接続とsetupに限定する。

## 構成
1 repo / 1 Workerへ集約済み。`apps/`と`packages/`は削除済みで復活させない。
目標はsrc/admin、api、db、editor、media、starlight、src/index.ts、
migrationsとrootのAstro/Wrangler設定。Astro固有のpages等は必要に応じて配置する。
/admin と /admin/* をWorker-firstで処理し、管理APIは /admin/api/* にまとめる。
管理HTTPはHonoで構成する。Honoはroute/middlewareの整理にのみ使い、汎用CMS機能を加えない。
管理assetsもAccess配下。公開Docs閲覧時はStatic AssetsのみでD1/APIを呼ばない。
将来の薄いdeployテンプレートはMVP後。今はパッケージ公開やmonorepo拡張をしない。

## データとEditor
Documentはid/title/slug/description/section/order/contentJson/status/日時を扱う。
draftRevisionIdとpublishedRevisionIdを分離し、Draft保存で公開snapshotを更新しない。
revisionには本文と全metadataを保存し、Restoreは新revision追加とする。
本文/metadataの正本はrevision。重複列を置く場合は同期規則を明確にする。
同時保存はrevision比較で競合検出し、黙って上書きしない。
Tiptap既存機能でHeading/Paragraph/Bold/Italic/Link/List/Code/Table/Imageを扱う。
Video/Callout/Steps/Tabsは既存拡張を調べ、Docs固有の不足だけcustom nodeにする。
編集→保存→再編集→静的表示まで一組として実装する。
既存renderer/sanitizerを使い、本文をMDX/JSとして実行しない。未知nodeは拒否する。
DB内部schemaとbuild DTOを分離。旧Markdown fixtureに新仕様を合わせない。

## Access / Media / Publish
Cloudflare Access Applicationが`/admin`、`/admin/*`、export用pathをedgeで保護する。Workerは
Access JWT、email、roleを処理しない。`workers_dev: false`とpreview URL無効化を維持し、
Access外からWorkerへ到達できる経路を作らない。local Wranglerはlocalhostで認証なしとする。
管理更新APIにCSRF対策。Build用Access credentialはexport用pathだけを通過できるようにする。
Workers Buildsは`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`をbuild secretとして渡す。
直Worker URL、preview、管理HTMLのStatic Assets迂回も検証する。
Mediaは既存upload UI＋最小の一覧/選択/挿入Glue。
PNG/JPEG/WebP/AVIF/MP4/WebMのサイズ/実データ形式を検証し、R2とD1の片側失敗を処理。
公開中Mediaを不用意に削除しない。公開R2のDraft mediaも秘匿されない。
`MEDIA_PUBLIC_URL`なしのAdmin media URLをPublished snapshotへ混ぜない。
Publishは公開revisionと配送記録の永続化後にHookを送信。再試行を用意する。
Hook受理とdeploy完了を混同しない。Unpublish/delete/slug変更も再buildする。
Buildは一貫したPublished全件snapshotのみ。部分取得/不正slug/重複/未知nodeはbuild失敗。
障害時にdemoへfallbackしない。初回のみ明示的な空サイトで起動する。
実行時fixtureや`demos/`は置かない。必要なテストデータだけを`tests/fixtures/`に閉じ込める。
Worker経由のmedia uploadは10 MiBまで。より大きい動画はP3のR2 multipart uploadで対応する。
secrets/Hook URL/個人情報をログやGitに残さない。

## 作業
npmとpackage-lock.json、依存は完全固定。OSSの公開API/ライセンス/Workers互換性を確認。
Cloudflare設定は最新公式資料を確認。型不一致をキャストで隠さない。
bindings型はWrangler設定確定後に`wrangler types --env-interface CloudflareBindings`で生成する。
不要な生成型を持ち越さない。
旧SonicJSローカルDBは無断削除しない。新schemaは新しいDB名/保存先から始める。
検証はcheck/test/demo build、runtime変更ではdry-runとローカル結合確認。
単体成功を実Access/本番deploy成功と扱わない。終了時ROADMAPを更新する。
独立エージェントへの委任はユーザーが求めた場合のみ。モデルに依存する手順を作らない。
