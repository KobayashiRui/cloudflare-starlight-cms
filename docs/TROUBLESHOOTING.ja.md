# トラブルシューティング

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
