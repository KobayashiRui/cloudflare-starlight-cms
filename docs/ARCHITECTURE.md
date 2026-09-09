# Architecture
2026-09-09採用。P0〜P2はローカルMiniflareで確認済み。P3/P4は未完成。

## 1 repo / 1 Worker
公開Docs: Astro/Starlight SSG + Pagefind → Workers Static Assets。
管理: /admin と /admin/* → Access → Worker → D1/Drizzle、R2。
管理HTTPはHono、管理APIは /admin/api/*。`/admin/app.js`は本番ではAccess applicationのpath policyで保護し、
localではtoken付き管理HTMLがAPIへtokenを付与する。選択的Worker-first設定は公式schemaで確認済みで、
公開閲覧でWorker/D1を呼ばない。
SonicJSなし。汎用CMS/Auth/RBAC/plugin/workflowは実装しない。

## 編集と公開
Tiptap JSONが正本。documentsがdraftRevisionId/publishedRevisionIdを参照し、
revisionsは本文とtitle/slug/description/section/orderの不変snapshotを保存する。
保存/Restoreは新revision。Publishだけが公開pointerを変更する。競合はrevision比較で検出。
Tiptap既存rendererを利用し、Callout→Aside、Steps→Steps、Tabs→Tabs、
Video→静的videoの不足だけを実装する。Astro Loaderとの接続はlocal D1 exportから実際の出力で検証済み。
未知nodeの黙殺や本文のMDX/JS実行は禁止。

## Build
同じhuman policyを持つ`/admin`と`/admin/*`を別Applicationとして設定する。専用Access
application/service tokenで保護したexportを同じWorkerに設ける。localでは認証なしで動作する。
例: /admin/export/* をhuman用 /admin/* より具体的なapplicationで保護し、
Workerでもexport専用AUDを管理APIに受理しない。
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
