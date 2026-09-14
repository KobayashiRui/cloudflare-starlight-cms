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

`docs.example.com`をWorkerへ接続し、`src/site.config.ts`で公開originを設定してcommitします。

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

## 5. 公開Mediaを設定する

最初のDeployでR2がprovisionされた後、`MEDIA` bucketへ`docs-media.example.com`のようなpublic custom domainを接続します。`wrangler.jsonc`にoriginを設定します。

```jsonc
{
  "vars": {
    "MEDIA_PUBLIC_URL": "https://docs-media.example.com"
  }
}
```

この値はsecretではないためcommitします。R2のdevelopment URLは無効のままにします。通常の画像・動画埋め込みにCORSは不要です。browser JavaScriptからassetを直接fetchする場合だけ、必要最小限のCORS policyを追加してください。upload済みDraft mediaもこのdomainから公開されます。

画像・動画はAdminのMedia pickerから追加します。通常リンクはHTTP(S)を使えますが、公開する画像・動画URLはpublic HTTPS originである必要があります。

## 6. Publish時に公開buildを発火する

**Workers & Pages**でWorkerを選び、**Settings → Builds → Deploy Hooks**を開きます。本番branch用のDeploy Hookを作成し、URLをWorker runtime secretとして保存します。

```sh
npx wrangler secret put WORKERS_DEPLOY_HOOK_URL
```

または**Worker → Settings → Variables and Secrets**から設定します。Workers Buildsのvariableに入れても、実行中のCMS Workerからは読めません。

Deploy Hook URLはcredentialです。URLを知る人はbuildを要求できるため、source controlへ保存せず、漏えい時はHookを削除して再作成してください。

`Publish page`は1つのPage・localeを公開します。`Publish changes`は保存済みDraftまたは保存済み変更をすべて公開し、buildを1回要求します。Hookが受理されたことはbuild開始の要求を意味し、公開完了ではありません。失敗したbuild要求はAdmin headerからretryできます。

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
