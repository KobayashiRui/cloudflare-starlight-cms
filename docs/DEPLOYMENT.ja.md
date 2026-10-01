# デプロイ

このガイドでは、公開Starlight Docsと、`/admin/*`でCloudflare Accessに保護されるAdminを1つのWorkerへ設定します。

## はじめる前に

`npx create-starlight-cms@latest my-docs`でprojectを作成してGitHubへpushします。本番Docs hostnameを含むCloudflare zoneも用意してください。

## 1. 最初のWorker Deployを作成する

**Workers & Pages → Builds**でrepositoryを接続し、次を設定します。

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

初期設定中は非本番branch buildを無効にします。最初のbuildでは`siteConfig.url`を空のままにしてください。空の公開サイトとAdminがdeployされ、Cloudflareが`DB` D1と`MEDIA` R2のbindingを自動provisionします。

## 2. domainを接続する前にAdminを保護する

Cloudflare Accessで**Self-hosted** applicationを1つ作成します。

```text
Hostname: docs.example.com
Path: admin/*
```

Action **Allow**の人間向けpolicyを追加し、許可するemail、domain、またはAccess Groupを設定します。hostnameはactiveなCloudflare zoneに属している必要がありますが、この時点でWorkerへ接続済みである必要はありません。

## 3. Docs domainを接続する

`docs.example.com`をWorkerへ接続し、`src/site.config.ts`で公開originを設定します。commitは手順4のbuild認証設定を終えてから行います。

```ts
export const siteConfig = {
  url: 'https://docs.example.com',
  // …
};
```

次のbuildはこの値からAstroの公開URLとCMS snapshot URLを導出します。通常の本番buildでは`CMS_EXPORT_URL`を設定しません。

公開Docsは`/`で誰でも閲覧でき、Accessは`/admin/*`を保護します。`/admin`は`/admin/`へredirectするだけで、Admin内容を返しません。

## 4. Workers Buildsへ公開snapshotの読取を許可する

Workers Builds用のAccess Service Tokenを作成します。同じAccess Applicationに2つ目のpolicyを追加します。

```text
Action: Service Auth
Include: Workers Builds用Service Token
```

Service Tokenの値を**Workers Builds → Build Variables and Secrets**へ登録します。

```text
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
```

これらはbuild secretであり、Worker runtime variableではありません。Service Auth policyは人間向けAllow policyと分けます。Service TokenをAllow policyだけへ追加すると、Access login pageへredirectされます。

認証設定後、手順3の公開originをcommitし、公開snapshotからのbuildを有効にします。

## 5. Mediaの配信

R2は画像・動画の原本を保持します。AdminのMedia pickerからアップロードし、EditorとPreviewはAccess配下のメディアAPIで表示します。公開時は `npm run build` が必要なファイルだけ `dist/_cms-media/` へコピーし、Docsと一緒にWorkers Static Assetsから配信します。

R2 custom domain、`MEDIA_PUBLIC_URL`、公開用CORS設定は不要です。R2のdevelopment URLも無効のままにします。外部のHTTPS画像・動画はコピーせず、元のURLを使用します。

既存利用者は更新を取り込みGitHubへpushすれば移行できます。R2 bucket・object key・保存済み本文・履歴は維持し、再アップロードや追加のPublish操作は不要です。旧 `MEDIA_PUBLIC_URL` は削除できますが、残っていても無視します。最初のbuildは旧APIを使い、cleanupを省きます。旧R2ドメインを停止する場合はStatic Assets版のdeploy成功後にしてください。移行前Versionへのrollbackや外部の旧画像直リンクを維持する場合は、旧ドメインと原本も必要です。公開中の旧R2ドメインからは引き続きDraft画像も取得できる点に注意してください。

直接アップロードは10 MiBまでです。Static Assetsは1ファイル25 MiB、FreeではVersion全体で20,000ファイルまでです。Docs・Admin・Pagefindのファイルも含みます。ビルドごとの原本取得はR2読み取りに含まれますが、公開閲覧では管理対象メディアをR2から取得しません。

### 保存容量と公開履歴の注意点

公開履歴の保存数は、初期設定では無制限です。履歴に保存するのは本文と画像・動画のURLであり、ファイル自体を履歴ごとに複製するわけではありません。ただし、過去の履歴だけが参照する画像・動画も保持するため、差し替えを繰り返すとR2の使用量が増えます。履歴の本文もD1の保存容量を使います。

無料枠には上限があり、同じアカウントのほかの用途と共有されます。R2 Standardの無料保存枠は月あたり10 GB-month、D1 Freeの合計保存枠は5 GBです。履歴が無制限でも無料で使い続けられるとは限りません。Cloudflareで保存容量・リクエスト使用量を確認し、無料枠で運用する場合は最新の[R2料金](https://developers.cloudflare.com/r2/pricing/)と[D1料金](https://developers.cloudflare.com/d1/platform/pricing/)も確認してください。

ページの「履歴」から古い履歴を削除できます。現在の公開内容、実行中のビルドが使う履歴は削除できません。履歴の削除は取り消せませんが、画像・動画は即座には削除されません。

履歴の自動保存上限は `src/cms.config.ts` で設定します。

```ts
export const cmsConfig: { maxPublicationRevisions: number | null } = {
  maxPublicationRevisions: null, // 無制限。例: 20 なら言語ごとに最新20件を保持
};
```

設定できるのは `null` または1以上の整数です。現在の公開履歴も件数に含みます。ビルド完了時に、保護されていない古い履歴を整理し、保存済みの下書き・残された履歴・現在の公開データ・実行中ビルドのどこからも参照されないメディアをR2とD1から削除します。保護中の履歴がある間は、上限を一時的に超える場合があります。未保存の編集で使われている可能性を考慮して、アップロードから24時間以内のファイルは保持します。ブラウザ上の未保存内容は永続的な参照にはならないため、下書きはこまめに保存してください。

**Deploy commandは標準の `npx wrangler deploy` のままで構いません。** 必要なファイルのコピーとサイトbuildが完了してから整理します。稼働中サイトにStatic Assets配信の印がない間は整理を省くため、移行deployが失敗しても旧公開画像は維持されます。整理失敗はbuild失敗として扱い、次のbuildで再試行します。保存内容に変更がなくても「公開」で再ビルドと整理を依頼できます。追加の定期ジョブやdeploy後のコマンドはありません。

実行中ビルドの参照は最大24時間保持し、通常はbuild終了時に解除します。整理の対象はCMSからアップロードしたメディアとCMS本文内の参照です。独自Astroページや外部用途には別のアセットを使ってください。Static Assets版のrollbackは画像・動画も戻しますが、D1やR2のデータは復元しません。

## 6. Publish時に公開buildを発火する

**Workers & Pages**でWorkerを選び、**Settings → Builds → Deploy Hooks**を開きます。本番branch用のDeploy Hookを作成し、URLをWorker runtime secretとして保存します。

```sh
npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
```

または**Worker → Settings → Variables and Secrets**から設定します。Workers Buildsのvariableに入れても、実行中のCMS Workerからは読めません。

Deploy Hook URLはcredentialです。URLを知る人はbuildを要求できるため、source controlへ保存せず、漏えい時はHookを削除して再作成してください。

`Save draft`で編集を保存し、headerの`Publish`ボタンで全ページ・全言語の保存済み変更を公開してbuildを1回要求します。未保存の編集がある場合は先に保存してください。Hookが受理されたことはbuild開始の要求を意味し、公開完了ではありません。失敗したbuild要求はAdmin headerからretryできます。

## ホームページとLanding Page

root直下でURL segmentを`index`にしたCMS Pageは`/`へ公開されます。翻訳は`/ja/`のようなlocale rootに公開されます。

独自Landing Pageを使う場合は、そのCMS Pageを作成しません。生成projectへ`src/pages/index.astro`を追加するとAstroが`/`を担当し、CMS Pageは各URLで公開されます。

## Schema初期化と将来のMigration

同梱schemaはAdminが最初にD1を必要とした時点で適用され、Wranglerも使う`d1_migrations`へ記録されます。初期化に失敗するとAdminは`503`を返すため、原因を修正して再試行してください。

この自動処理は同梱のidempotentなCREATE migrationだけが対象です。将来のALTERやbackfill migrationには明示的なproject upgrade手順が必要です。本番dataはupgrade時も保持してください。

確認用command:

```sh
npm run check
npm test
npm run build:empty
npm run dry-run
```
