# npx template配布：調査と実装引き継ぎ

2026-09-11。create CLIと同梱template、fresh local起動まで実装済み。npm公開は未実施。

## 決定する構成

一般利用者は `npx create-starlight-cms@latest my-docs`、既存の空ディレクトリなら末尾に `.`。
生成後は `npm install` → `npm run dev` でAdminを開ける。Cloudflareアカウントはローカル起動に不要。
OSS開発者は現repoをcloneする。生成先も1アプリ/1 Workerであり、CMS library化はしない。

rootのアプリを唯一のテンプレート正本とする。`packages/create-starlight-cms/`だけを追加し、
rootを移動せず、npm workspaces/Turbo/CMS本体packageは追加しない。
CLIは依存ゼロのNode ESM（`bin/index.js`、shebang付き）で十分。TypeScript用ビルド工程は不要。
`bin`は実ファイルを指せばよく、`dist/index.js`という名前に合わせる必要はない。

## 調査結果と選択理由

- [create-vite公式実装](https://github.com/vitejs/vite/blob/main/packages/create-vite/src/index.ts) は同梱templateをコピーし、package名を設定する。`_gitignore`を`.gitignore`に戻す実装も参考になる。多数のframework選択やoverwriteは今回不要。
- [create-vite公式README](https://github.com/vitejs/vite/tree/main/packages/create-vite#readme) は `.` によるカレントディレクトリ生成を案内している。今回は非空への上書きを提供しない。
- [Astro公式setup](https://docs.astro.build/en/install-and-setup/#use-a-theme-or-starter-template) は既存GitHub repoを `--template` に指定できる。独自CLIを持たない代案として成立するが、専用npx名・固定配布物を望む今回には同梱方式を採用する。
- [npm package.json仕様](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) の `bin` / `files` を使って公開範囲を限定する。package-lock.jsonは通常名のままnpm配布できないので、template内では `package-lock.json.template` とし、生成時に戻す。
- [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) で実際のtgzを作り、その中身とインストール後のbinを検証する。repo上のCLI直実行だけでは配布漏れを検出できない。

CLI実行時にGitHub mainをfetchしない。npmのCLI versionと同梱template versionを一致させ、古いCLIでも同じ初期コードを生成できるようにする。依存解決まで固定するためlockfileも配る。

## CLI v0.1の契約

- 引数は `<directory>` / `.`、`--help`、`--version` のみ。引数なし・未知optionはusageを示し非ゼロ終了。対話質問は次段階で必要性を判断する。
- Site titleは `My Docs`、default localeは `en`、supported localesはenのみ。後で `src/site.config.ts` を編集する。設定ファイルをrootへ移動しない。
- package名だけ出力先basenameからnpm有効名へ正規化する。空・日本語のみなどの場合は固定名 `my-docs` にfallback。nameはprivate packageなのでdirectory名の厳しい制約は不要。lockfileのroot nameも合わせる。
- CLIはproject名をCloudflare Worker名として`wrangler.jsonc`へ設定する。Worker名の制約に合わせて`.`と`_`は`-`へ正規化する。D1/R2は`DB`と`MEDIA` bindingだけを持ち、Cloudflare Automatic Resource ProvisioningがWorker名を基準に作成するため、resource ID/nameを設定・出力しない。
- 出力先は未作成または空のみ。`.git`（file/worktreeも含む）と`.DS_Store`は保持したまま許可。それ以外の既存ファイルがあれば書込前に中断する。`--force`なし。
- 出力先のsymlinkは拒否する。template内のsymlinkも配布準備で拒否する。コピーは既存ファイルを上書きしない。失敗時にユーザーdirectory全体を削除しない。
- shell実行・install・git init・deploy・Cloudflare loginはしない。生成成功後に実行するコマンドとREADMEのsetup先を表示する。
- 同じdirectoryへの再実行を更新コマンドとして扱わない。

## テンプレートの梱包

`scripts/prepare-create-template.mjs`が明示allowlistからCLI配下の生成物 `template/` を作る。template/はGit管理しない。
CLI packageの `prepack` から実行し、rootソースの編集だけで次の配布物へ反映する。

含める候補（実装時にimport/script参照を照合）：

- `src/`、`migrations/`、`scripts/dev.mjs`、`scripts/build-admin.mjs`
- `astro.config.mjs`、`wrangler.jsonc`、両tsconfig、`worker-configuration.d.ts`
- `package.json`、lockfile、`.gitignore`、`LICENSE`、`THIRD_PARTY_NOTICES.md`
- 必要な `public/` が存在すれば含める。空directoryを作るための不要fileは追加しない。
- テスト一式（多言語fixtureも含む）と実行に必要な設定。生成先でも検証できる状態を維持する。
- 利用者向けREADMEとproduction setup文書。rootの開発者向け履歴/ROADMAP/AGENTSやCLI package自体は配らない。READMEリンクを切らさない。

`.git`、`.wrangler`、`.dev-assets`、`dist`、`.astro`、node_modules、env/secret、個人データ、npm認証設定は含めない。
`.gitignore`は `_gitignore`、lockfileは `package-lock.json.template` にrenameして同梱。
CLI packageの `files` はbinとtemplate等の必要ファイルだけ。LICENSE/第三者noticeを失わない。
root packageへ追加する配布用scriptを生成packageへ残さない。dependenciesとlockfileは同期させる。
生成packageへ `cloudflareStarlightCms.templateVersion` を記録し、CLIの`upgrade`が旧templateと最新版を比較するために使う。

## 実装順序と完了条件

### 1. 初期状態を整える — 完了

配布templateの`src/site.config.ts`だけをMy Docs/enのみに変換する。rootは多言語の結合検証用設定を保ち、
複製時の1箇所だけを明示的に置換する。既存local DBは削除しない。
本番コードにテスト用locale環境変数を追加しない。単言語初期状態と多言語buildの両方を検証する。
既存データ投入後のdefault locale変更はデータ移行に相当し、自動翻訳/変換されないとREADMEへ記載する。

### 2. 空DBでnpm run devが動くようにする — 完了

現在は `npm run migrate:local` が先に必要。dev coordinatorでWorker起動前にWranglerのlocal migrationを適用する。
常に `--local`、固定DB設定、exit code検査。remote migrationを呼ばない。二回目も既存データを保持する。

**先に修正する既知の起動不整合:** 現 `scripts/dev.mjs` はAdminを`.dev-assets`へ生成後、
Astroだけをbuildした`dist`で`.dev-assets`全体を置換する。fresh checkoutではdistにAdminがないため、
app.js/app.cssが消える可能性がある。既存watcherの出力先を丸ごと消さず、Admin専用領域と
公開生成物の同期範囲を明確にする。旧公開routeの削除とAdmin保持を両立し、生成順に依存させない。

### 3. CLIと配布準備を追加 — 完了

上記のbin・prepack・allowlistを実装。1つのtemplateのみ。設定wizard、汎用template engine、別repoは作らない。
AGENTSの「packagesを復活させない／公開はMVP後」という旧方針は、このCLIのみ許可するよう更新。
READMEを一般利用者/コントリビューターの導線に分ける。未公開中はnpxで利用可能と断言しない。

### 4. 実tgzで受け入れ検証 — 実施済み

- npm packで成果物を作り、中身のallowlist・secret除外・license・lockfile/gitignoreの実在を検査。
- tgzを一時領域へインストールし、binで新規directoryと `.` の両方へ生成する。
- `.git`保持、非空directory拒否、失敗時に既存fileを変更しない、symlink拒否、help/versionを検証。
- 出力先でnpm ci（lockfile整合）、check/test、build:empty、dry-runを確認。
- **既存node_modules/dist/.wranglerなしの生成先**でnpm ci → npm run devを検証した。
  `/admin/`とapp.js/app.cssが200かつ正しいContent-Type、空D1からPage作成・保存・Preview・Publish・公開HTML生成まで確認する。
  二回目dev、再Publish、公開削除後にもAdmin assetsが残り、古い公開routeが残らないことを確認。
- en-only初期build、テスト設定のen+jaで翻訳fallbackとPreviewを検証。
- 自分で起動したプロセスだけを停止する。本番deploy/npm publishは実施しない。

### 5. npm公開の準備 — 完了

CLI packageはnpm公開用のrepository、homepage、bugs、keywords、Node engine、public access設定を持つ。
`npm run release:check`はrootのcheck/test/空サイトbuild/Worker dry-runに加え、実際にpackしたtgzを一時directoryへ
installしてCLI生成とLinux binding lock検査まで行う。`prepublishOnly`も同じ検査を実行するため、公開時にsourceだけで
検証した状態は許容しない。`npm run release:dry-run`はnpmへの公開を行わず、npm側の公開手順まで検査する。実公開はrootから
`npm run publish:cli`を実行する。root package自体はprivateのCMSアプリなので、rootで直接`npm publish`は使わない。

### 6. 別工程で公開

npm名の利用可否・所有権、repository URL、公開versionを確認。pack済み成果物をレビューしてnpmへ公開する。
実公開後にnpx @latestのregistry経由smoke testを行いREADMEを正式導線へ切り替える。
Workers Buildsは生成先の利用者Git repoへ接続するため、ローカル生成だけで本番setupが完了するとは記載しない。

## 更新ポリシー

`npx create-starlight-cms@latest upgrade .`は、作成元versionのtemplateをnpmから一時取得し、
旧template・最新template・利用者projectを比較する。既存projectはこのdry-runでは変更しない。
競合がなければ`--apply`で、旧templateから未変更のmanaged fileだけを更新する。利用者と新templateの
両方が変更したfileは上書きせず、一覧を表示して終了する。削除は自動で行わない。
`package.json`はscripts・dependencies・enginesだけを同じ3者比較で更新し、Worker名などの利用者設定を保持する。
lockfileは自動上書きせず、dependencyに変更があった場合は利用者が`npm install`で更新する。
旧templateを取得できない、作成元versionがない、または競合があるprojectは手動移行する。
新規用templateには累積migrationを含め、リリース後の既存migrationを改変/一本化しない。

## 引き継ぎ指示

この計画の1〜4を順に実装し、各工程でROADMAPを更新してください。現在の既存DBを変更/削除せず、
受け入れ検証は生成した一時projectで行ってください。独立したCMS packageは追加しません。上記の限定的な`upgrade`以外に、
汎用同期・自動merge・自動deployは追加しません。
実npm publish・remote Cloudflare操作は次工程です。完了報告では実tgz検証とfresh local起動の結果を区別してください。
