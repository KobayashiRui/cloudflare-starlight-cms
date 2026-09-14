# トラブルシューティング

## Workers Buildsが`unexpected redirect`で失敗する

buildが`/admin/export/snapshot`を読み込もうとした際、Cloudflare Accessがlogin pageへredirectしています。Workers Builds用Service Tokenが、`admin/*`を保護する同じAccess Applicationの**Service Auth** policyに含まれているか確認してください。

人間向けの**Allow** policyへTokenを追加するだけでは不十分です。

## 公開サイトでMediaを読み込めない

`MEDIA_PUBLIC_URL`をHTTPSのR2 custom domainへ設定して再buildします。公開画像・動画はHTTP、Admin media proxy URL、private network addressを使用できません。可能な限りMedia pickerからuploadしてください。

## 自動D1 provisionで既存databaseエラーが出る

Cloudflare Audit Logsで`DeleteDatabase`と後続の`CreateDatabase` eventを確認し、同じWorkerを同時にprovisionしようとしているbuildがないか確認します。この失敗はschema初期化より前に発生します。

復旧のためにdatabaseを繰り返し削除したり、Worker名を変えたりしないでください。すでに成功したbindingはWranglerが引き継ぎます。最初のDeploy失敗後にunbound resourceが残る場合はaccount-levelで調査します。

## Access設定前にAdminへ到達できた

Worker custom domainを接続する前に、予定hostnameのAccess Applicationと人間向けAllow policyを作成してください。詳しくは[Deployment guide](DEPLOYMENT.ja.md#2-domainを接続する前にadminを保護する)を参照してください。
