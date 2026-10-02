# トラブルシューティング

## wrangler.jsoncのupgrade競合

1.0.4から1.1.0への更新で、次の表示が出ることがあります。

```text
No files changed. Resolve these conflicts, then run upgrade again:
  wrangler.jsonc
```

この場合、ファイルはまだ変更されていません。CLIはWorker名の違いを除外してtemplateを比較しますが、それ以外の編集は競合になる場合があります。設定済みの`MEDIA_PUBLIC_URL`も対象です。1.1.0では公開メディアをStatic Assetsから配信するため、この変数をtemplateから削除しています。

Worker名以外の変更が旧メディアのoriginだけなら、`wrangler.jsonc`から次のコメントとブロックを削除してください。

```jsonc
// Public R2/custom-domain origin. Set once in the generated project's Git.
"vars": {
  "MEDIA_PUBLIC_URL": "https://your-old-media-domain.example"
},
```

`vars`にほかの変数がある場合は、`MEDIA_PUBLIC_URL`だけを削除し、ほかは残します。Worker名・route/domain・D1 database・R2 bucketの設定は保持してください。ファイル全体をtemplateで上書きしないでください。

その後、upgradeを再実行します。

```sh
npx create-starlight-cms@1.1.1 upgrade .
npx create-starlight-cms@1.1.1 upgrade . --apply
npm install
```

競合が残る場合は、更新先templateと比較し、残りの差分を手動で調整してください。Worker名以外はテキストで比較するため、整形の違いも競合になる場合があります。変更後の差分を確認してからcommitし、GitHubへpushしてください。

変数の削除だけでは、R2ドメインの接続や保存済み本文は変わりません。旧ドメインは更新後のdeploy成功と公開画像・動画の表示を確認するまで残してください。移行前Versionへのrollbackや外部の旧直リンクについては、[Mediaの配信](DEPLOYMENT.ja.md#5-mediaの配信)を参照してください。

## 初回更新ビルドが`CMS build operation failed (405)`で失敗する

当初の1.1.0のbuild scriptは、新しいbuild APIの存在確認で404だけを想定していました。旧Workerは未登録のAdmin URLをStatic Assetsへ渡すため、`/admin/api/publish/builds`へのPOSTが405になる場合があります。その結果、初回更新ビルドが既存のsnapshot・メディアAPIへ切り替わる前に停止します。

この修正は1.1.1に含まれます。修正版の`scripts/build-client.mjs`を取り込み、pushして通常のbuild/deployを再実行してください。修正後は初回のbuild API確認に限って404または405で既存APIへ切り替え、そのビルドのcleanupを省きます。認証失敗・redirect・cleanupのエラーは引き続きビルドを停止します。回避のために空サイトをビルドしたり、Access保護を解除したり、R2原本を削除したりする必要はありません。

## Workers Buildsが`unexpected redirect`で失敗する

buildが`/admin/export/snapshot`を読み込もうとした際、Cloudflare Accessがlogin pageへredirectしています。Workers Builds用Service Tokenが、`admin/*`を保護する同じAccess Applicationの**Service Auth** policyに含まれているか確認してください。

人間向けの**Allow** policyへTokenを追加するだけでは不十分です。

## 公開サイトでMediaを読み込めない

`npm run build`で生成した`dist`全体をデプロイしてください。管理対象メディアはAccessビルドTokenで取得し、`dist/_cms-media/`へ配置します。TokenがAdminのsnapshot・メディア一覧・メディア取得APIを利用でき、R2に原本があることを確認してください。`MEDIA_PUBLIC_URL`は不要です。外部画像・動画はpublic HTTPS URLを使います。

## 自動D1 provisionで既存databaseエラーが出る

Cloudflare Audit Logsで`DeleteDatabase`と後続の`CreateDatabase` eventを確認し、同じWorkerを同時にprovisionしようとしているbuildがないか確認します。この失敗はschema初期化より前に発生します。

復旧のためにdatabaseを繰り返し削除したり、Worker名を変えたりしないでください。すでに成功したbindingはWranglerが引き継ぎます。最初のDeploy失敗後にunbound resourceが残る場合はaccount-levelで調査します。

## Access設定前にAdminへ到達できた

Worker custom domainを接続する前に、予定hostnameのAccess Applicationと人間向けAllow policyを作成してください。詳しくは[Deployment guide](DEPLOYMENT.ja.md#2-domainを接続する前にadminを保護する)を参照してください。
