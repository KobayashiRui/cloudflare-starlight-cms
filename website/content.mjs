export const content = {
  "en": {
    "language": "English",
    "otherLanguage": "日本語",
    "title": "Your own docs site, edited in the browser",
    "description": "Run your own documentation site within Cloudflare's free tier. Write and publish from the browser, on your own or with a team. Open source, fully customizable, with static Astro Starlight delivery and WebMCP AI editing.",
    "nav": {
      "features": "Features",
      "workflow": "Publishing",
      "guide": "Guide",
      "github": "GitHub",
      "skip": "Skip to content",
      "language": "Language",
      "switchToLight": "Switch to light mode",
      "switchToDark": "Switch to dark mode"
    },
    "hero": [
      "Your own docs site",
      "Edit it in your browser"
    ],
    "intro": "Write and publish from your browser, on your own or with a team.",
    "start": "Try it locally",
    "viewGithub": "GitHub",
    "commandLabel": "Start a new project",
    "copy": "Copy",
    "copied": "Copied!",
    "copyFailed": "Select and copy the command",
    "heroNotes": [
      "MIT licensed",
      "Your Cloudflare account",
      "Fully static publishing"
    ],
    "screenshotAlt": "The real CMS Admin showing the page tree, visual editor, language selection, and publishing controls.",
    "screenshotCaption": "The Admin: page navigation, visual editing, Preview, and publishing.",
    "screenshotNote": "Sample content",
    "workflow": {
      "title": "Edit in the CMS\nDeliver a static site",
      "intro": "Publish your docs as HTML, media, and search files. Reading a page never calls the CMS API or database.",
      "steps": [
        {
          "title": "Edit & publish",
          "text": "Save in the CMS, then choose Publish.",
          "meta": "Browser"
        },
        {
          "title": "Build",
          "text": "Starlight generates the site from published content.",
          "meta": "Workers Builds"
        },
        {
          "title": "Static delivery",
          "text": "Serve the generated HTML, media and search files.",
          "meta": "Static Assets"
        }
      ],
      "note": "The site updates after the build and deployment finish. Draft content is not published.",
      "costTitle": "Start within the free tier",
      "costText": "Use Cloudflare’s free allowances for hosting, builds, storage, and Access. Usage limits apply, and your domain is a separate cost.",
      "costLink": "Cloudflare plans and limits"
    },
    "features": {
      "title": "Built for documentation",
      "items": [
        [
          "Visual editor",
          "Format text, add images and tables, and use callouts, steps, and tabs. No Markdown needed for everyday edits."
        ],
        [
          "Pages and folders",
          "Arrange your documentation in a tree. It becomes your Starlight sidebar and public URL structure."
        ],
        [
          "Drafts and history",
          "Preview saved drafts before publishing. View previous publications and restore their content."
        ],
        [
          "Multilingual content",
          "Edit translations alongside the original. Choose the Admin display language separately."
        ],
        [
          "Full-text search",
          "Pagefind search is included in the static build. No search server to set up or maintain."
        ],
        [
          "Cloudflare Access",
          "Control who can open the Admin through Access. No separate CMS accounts or passwords."
        ]
      ]
    },
    "ai": {
      "title": "Let AI work\nin the same editor",
      "text": "Ask a compatible browser agent to review your docs, find missing translations, or edit a page. Watch the changes appear in the editor, then check the draft yourself.",
      "promptLabel": "Try asking",
      "prompt": "Find pages missing Japanese translations. Translate Working with AI and save a draft for review.",
      "note": "Requires a browser and agent with native WebMCP support. Review the draft and publish from the Admin.",
      "link": "How WebMCP editing works",
      "steps": [
        "Find a missing translation",
        "Translate in the editor",
        "Save a draft for review"
      ]
    },
    "quickstart": {
      "title": "Your next docs site starts here",
      "text": "Create a project and try the editor locally. No Cloudflare account needed.",
      "requirement": "Node.js 22.19+ · npm",
      "guide": "Read the basic guide",
      "deploy": "Deploy to Cloudflare",
      "admin": "Admin",
      "docs": "Public docs"
    },
    "faq": {
      "title": "Frequently asked questions",
      "items": [
        [
          "Can I run it for free?",
          "You can operate within Cloudflare’s free allowances. Builds, storage, requests, and Access have their own limits; your domain has its own cost. Check Cloudflare’s current plans for your usage."
        ],
        [
          "Who handles the initial setup?",
          "Initial setup uses the CLI and requires configuring Cloudflare, Access, and publishing. After that, you can manage content in your browser. Anyone you authorize can edit too, without coding or Git."
        ],
        [
          "Does this plug into an existing Starlight site?",
          "The CLI creates a new, complete documentation project. It is not a drop-in plugin or a Markdown/Git synchronization service for an existing site."
        ],
        [
          "Does Publish update the live site immediately?",
          "Publish records the publication and requests a build. The live site changes when that build is successfully deployed. Preview lets you inspect a saved draft before publishing."
        ],
        [
          "Can several people edit?",
          "People allowed through Cloudflare Access have the same management privileges. Version checks detect conflicting saves. Real-time collaborative editing and different CMS roles are outside the project’s scope."
        ]
      ],
      "pricing": "Cloudflare pricing and limits"
    },
    "footer": {
      "tagline": "A self-hosted CMS for Astro Starlight.",
      "guide": "Basic guide",
      "deployment": "Deployment",
      "troubleshooting": "Troubleshooting",
      "ai": "WebMCP guide",
      "license": "MIT License",
      "disclaimer": "An independent project. Not affiliated with Cloudflare or Astro."
    },
    "guide": {
      "title": "Getting started",
      "description": "Get started with Cloudflare Starlight CMS: run locally, create a page, preview a draft, publish static documentation, and use WebMCP AI editing.",
      "intro": "Run the CMS locally, create your first page, and publish. See the repository docs for detailed configuration and operations.",
      "toc": "On this page",
      "back": "Back to the overview",
      "sections": [
        {
          "id": "local",
          "title": "Start locally",
          "paragraphs": [
            "Run the commands below, then open the Admin at http://127.0.0.1:8787/admin/. The public docs preview runs at http://127.0.0.1:4321/.",
            "Local development uses Miniflare for D1 and R2. You do not need a Cloudflare account to try the editor. The CLI creates a new project; keep your existing site separately."
          ],
          "code": true
        },
        {
          "id": "edit",
          "title": "Write and check a page",
          "steps": [
            "Create a page in the navigation tree. Give it a title and URL segment, then write in the visual editor.",
            "Use folders to organize navigation. Add headings, links, lists, code, tables, images, or Docs-specific blocks as needed.",
            "Choose Save draft to store your changes. Open Preview to inspect the saved draft in the Starlight layout. Save again before previewing newer edits."
          ],
          "paragraphs": [
            "Content drafts stay separate from published content. Shared navigation and URL changes can request a rebuild when saved."
          ]
        },
        {
          "id": "publish",
          "title": "Publish on Cloudflare",
          "steps": [
            "Follow the deployment guide to connect your repository to Workers Builds, protect /admin/* with Access, attach your domain, and configure build credentials and the Deploy Hook.",
            "Save your editor changes, then use the header Publish button to publish saved changes across pages and document languages.",
            "Wait for the build and deployment to succeed, then check the public site. A build request being accepted does not mean deployment has finished."
          ],
          "paragraphs": [
            "Local development rebuilds public docs after publication without a Deploy Hook. Production readers receive static pages and managed media; they do not query the CMS database."
          ],
          "link": "deployment"
        },
        {
          "id": "languages",
          "title": "Work in more than one language",
          "paragraphs": [
            "Configure document languages in src/site.config.ts. Create and save the default-language page, then copy its saved content to add a translation.",
            "Publish the default-language page before publishing a translation individually, or publish them together. Folder structure and URL segments are shared across languages.",
            "The Admin display language is a separate choice in the header. Switching between English and 日本語 does not change your document’s language."
          ]
        },
        {
          "id": "ai",
          "title": "AI editing with WebMCP",
          "paragraphs": [
            "Open the Admin in a browser and AI agent that support native WebMCP, sign in through Access in production, and keep the Admin tab open.",
            "Ask the assistant to review pages, check missing translations, edit content, save drafts, or open Preview. Changes appear in the same editor you use, with normal Undo for content edits.",
            "Publish, deletion, uploads, and history remain existing Admin UI actions. WebMCP is an evolving browser API; see the detailed guide for support and setup."
          ],
          "prompt": true,
          "link": "ai"
        }
      ],
      "moreTitle": "Further reading",
      "moreText": "The repository docs remain the reference for deployment, configuration, upgrades, troubleshooting, and architecture.",
      "moreLink": "Browse repository docs"
    },
    "heroDetail": "Open source, fully customizable, and built to run within Cloudflare’s free tier.",
    "watch": "See how it works",
    "product": {
      "edit": "Write in the browser",
      "published": "Serve a static site",
      "caption": "The same page, from the editor to your Starlight site.",
      "note": "Real screens · sample content",
      "alt": "Published Starlight documentation with a sidebar, table of contents and search.",
      "builtWith": "Your docs, built with Astro Starlight",
      "watch": "From editing to publishing",
      "demoNote": "Annotations point to the controls in real screens. The public site updates after a successful build and deployment.",
      "walkthrough": [
        {
          "title": "Write in the browser",
          "text": "Edit the title and article in the visual editor."
        },
        {
          "title": "Save a draft",
          "text": "Choose Save draft. Your changes are not public yet."
        },
        {
          "title": "Open Preview",
          "text": "After saving, choose Preview draft to check the page."
        },
        {
          "title": "Check the page",
          "text": "Review the saved draft in Starlight before publishing."
        },
        {
          "title": "Publish your changes",
          "text": "Return to the Admin and choose Publish, then confirm."
        },
        {
          "title": "Read the static site",
          "text": "The updated site is public after the build and deployment succeed."
        }
      ]
    },
    "editing": {
      "title": "Set it up once\nKeep it updated in your browser",
      "text": "Write, organize pages, and publish from your browser after the initial setup. Use it for personal docs or a team manual. Anyone you allow through Access can edit without coding or Git.",
      "details": [
        [
          "Write naturally",
          "Add headings, images, tables, code, callouts, steps, and tabs in the visual editor."
        ],
        [
          "Keep everything in order",
          "Arrange pages in folders. Your sidebar and URLs follow the same structure."
        ],
        [
          "Check before publishing",
          "Save drafts, preview the page, and restore content from publication history."
        ]
      ],
      "note": "Multilingual docs and full-text search are included."
    },
    "ownership": {
      "title": "Your project\nMake it yours",
      "text": "The CLI gives you the complete project. Change the branding, customize Starlight, or adapt the code to fit your needs. It is yours to build on.",
      "license": "MIT licensed",
      "source": "Explore the source",
      "securityTitle": "Access handles the front door",
      "securityText": "Choose who can open the Admin through Cloudflare Access. There are no separate CMS accounts or passwords to manage.",
      "securityDetail": "Authorized editors share the same management privileges.",
      "securityLink": "See the deployment guide",
      "codeLabel": "A complete project in your repository",
      "files": [
        [
          "src/site.config.ts",
          "Site title and document languages"
        ],
        [
          "src/assets/",
          "Your logo and favicon"
        ],
        [
          "src/styles/",
          "Your site styles"
        ],
        [
          "src/admin/",
          "Your editing experience"
        ]
      ]
    }
  },
  "ja": {
    "language": "日本語",
    "otherLanguage": "English",
    "title": "自分のドキュメントサイトをブラウザから更新",
    "description": "自分のドキュメントサイトを、Cloudflareの無料枠で運用。個人でもチームでも、日々の編集・公開はブラウザから。コードやGitを触らず更新できる、カスタマイズ自由なOSSのCMS。Astro Starlightの静的配信、Access、多言語、WebMCPに対応。",
    "nav": {
      "features": "機能",
      "workflow": "公開の仕組み",
      "guide": "使い方",
      "github": "GitHub",
      "skip": "本文へ移動",
      "language": "言語",
      "switchToLight": "ライトモードに切り替え",
      "switchToDark": "ダークモードに切り替え"
    },
    "hero": [
      "自分のドキュメントサイトを",
      "ブラウザから更新"
    ],
    "intro": "ひとりでも、チームでも。編集も公開もブラウザから",
    "start": "ローカルで試す",
    "viewGithub": "GitHub",
    "commandLabel": "新しいプロジェクトを作成",
    "copy": "コピー",
    "copied": "コピーしました",
    "copyFailed": "コマンドを選択してコピーしてください",
    "heroNotes": [
      "MITライセンス",
      "自分のCloudflareで運用",
      "完全静的配信"
    ],
    "screenshotAlt": "CMSの実際の管理画面。ページツリー、ビジュアルエディタ、言語選択、公開ボタンが並びます。",
    "screenshotCaption": "ページ構成、本文の編集、プレビュー、公開を管理画面から操作。",
    "screenshotNote": "サンプルコンテンツ",
    "workflow": {
      "title": "編集はCMSで\n公開は静的サイトで",
      "intro": "記事も画像も検索も、静的ファイルとして配信。閲覧時にCMSのAPIやデータベースへアクセスしません。",
      "steps": [
        {
          "title": "編集・公開",
          "text": "CMSで保存して公開",
          "meta": "ブラウザ"
        },
        {
          "title": "ビルド",
          "text": "Starlightで生成",
          "meta": "Workers Builds"
        },
        {
          "title": "静的配信",
          "text": "HTMLや画像を配信",
          "meta": "Static Assets"
        }
      ],
      "note": "サイトへの反映はビルドとデプロイの完了後。下書きの本文は公開されません。",
      "costTitle": "Cloudflareの無料枠ではじめる",
      "costText": "ホスティング、ビルド、ストレージ、Accessの無料枠を使って運用できます。利用量には上限があり、ドメイン費用は別途かかります。",
      "costLink": "料金と利用上限を確認する"
    },
    "features": {
      "title": "ドキュメントの編集と管理",
      "items": [
        [
          "ビジュアルエディタ",
          "テキストの装飾、画像、表、コードに対応。コールアウトやステップ、タブも使えます。"
        ],
        [
          "ページとフォルダ",
          "ツリーで整理した構成が、そのままStarlightのサイドバーと公開URLになります。"
        ],
        [
          "下書きと履歴",
          "保存した下書きを公開前にプレビュー。過去の公開内容の確認・復元もできます。"
        ],
        [
          "多言語コンテンツ",
          "文書ごとに翻訳を管理。管理画面の表示言語は、文書の言語とは別に選べます。"
        ],
        [
          "全文検索",
          "ビルド時にPagefindの検索インデックスを生成。検索サーバーの設定や運用は不要です。"
        ],
        [
          "Cloudflare Access",
          "管理画面にアクセスできる人をAccessで設定。CMS独自のアカウントやパスワードはありません。"
        ]
      ]
    },
    "ai": {
      "title": "AIにも頼める\nいつもの編集画面で",
      "text": "記事のレビューも、足りない翻訳も、ブラウザのAIエージェントに依頼。同じエディタに変更が反映されるので、その場で内容を確認できます。",
      "promptLabel": "こんなふうに頼めます",
      "prompt": "日本語訳がないページを探して。Working with AIを翻訳して、確認用の下書きを保存して。",
      "note": "ネイティブWebMCP対応のブラウザとエージェントで利用できます。下書きを確認して、公開は管理画面から。",
      "link": "WebMCPの使い方",
      "steps": [
        "翻訳のないページを確認",
        "同じエディタで翻訳",
        "確認用の下書きを保存"
      ]
    },
    "quickstart": {
      "title": "まずは、書いてみよう",
      "text": "プロジェクトを作って、ローカルで編集を試せます。Cloudflareアカウントは不要です。",
      "requirement": "Node.js 22.19以降 · npm",
      "guide": "基本的な使い方",
      "deploy": "Cloudflareへデプロイ",
      "admin": "管理画面",
      "docs": "公開Docs"
    },
    "faq": {
      "title": "よくある質問",
      "items": [
        [
          "無料で運用できますか？",
          "Cloudflareの無料枠内で運用可能です。Build、ストレージ、リクエスト、Accessにはそれぞれ上限があり、ドメイン費用も別途かかります。利用状況に合わせて最新の料金・制限を確認してください。"
        ],
        [
          "初期設定は誰が行いますか？",
          "初回はCLIでのプロジェクト作成と、Cloudflare、Access、公開の設定が必要です。設定後の日々の更新はブラウザから。自分で使う場合も、許可した人と使う場合も、コードやGitを触らず編集できます。"
        ],
        [
          "既存のStarlightサイトに追加できますか？",
          "CLIが新しいドキュメントサイト一式を生成する構成です。既存サイトへそのまま追加するプラグインや、Markdown・Gitの同期サービスではありません。"
        ],
        [
          "公開ボタンを押すとすぐに反映されますか？",
          "公開内容を記録し、ビルドをリクエストします。公開サイトが変わるのは、ビルド・デプロイが成功した後です。保存した下書きは公開前にプレビューできます。"
        ],
        [
          "複数人で編集できますか？",
          "Cloudflare Accessで許可された人は同じ管理権限を持ちます。同時保存の競合はversion比較で検出します。リアルタイム共同編集やCMS内の権限分けは対象外です。"
        ]
      ],
      "pricing": "Cloudflareの料金・制限"
    },
    "footer": {
      "tagline": "Astro Starlight向けのセルフホストCMS。",
      "guide": "基本ガイド",
      "deployment": "デプロイ",
      "troubleshooting": "トラブルシューティング",
      "ai": "WebMCPガイド",
      "license": "MITライセンス",
      "disclaimer": "CloudflareおよびAstroの公式プロジェクトではありません。"
    },
    "guide": {
      "title": "基本的な使い方",
      "description": "Cloudflare Starlight CMSの基本ガイド。ローカル起動、ページの作成、下書きのプレビュー、静的サイトへの公開、WebMCPによるAI編集を紹介します。",
      "intro": "ローカル起動から、ページの作成・公開まで。詳しい設定や運用手順はリポジトリのdocsを参照してください。",
      "toc": "このページの内容",
      "back": "紹介ページへ戻る",
      "sections": [
        {
          "id": "local",
          "title": "ローカルで起動する",
          "paragraphs": [
            "以下のコマンドを実行し、http://127.0.0.1:8787/admin/ で管理画面を開きます。公開Docsの確認用URLは http://127.0.0.1:4321/ です。",
            "ローカルではMiniflareがD1とR2を提供するので、Cloudflareアカウントは不要です。CLIは新しいプロジェクトを作成するため、既存サイトとは分けてください。"
          ],
          "code": true
        },
        {
          "id": "edit",
          "title": "ページを書いて確認する",
          "steps": [
            "ナビゲーションツリーからページを作成。タイトルとURLのセグメントを設定し、ビジュアルエディタで本文を書きます。",
            "フォルダで構成を整理。見出し、リンク、リスト、コード、表、画像やDocs向けのブロックを追加できます。",
            "「変更を保存」で下書きを保存し、プレビューでStarlightのレイアウトを確認。新しい編集内容を確認するときは、先にもう一度保存してください。"
          ],
          "paragraphs": [
            "本文の下書きと公開済みの本文は別に管理します。共通のナビゲーションやURLの変更は、保存時に再ビルドをリクエストする場合があります。"
          ]
        },
        {
          "id": "publish",
          "title": "Cloudflareで公開する",
          "steps": [
            "デプロイガイドに沿ってWorkers Buildsへリポジトリを接続。Accessで /admin/* を保護し、ドメイン、build用認証、Deploy Hookを設定します。",
            "編集中の変更を保存してから、ヘッダーの「公開」で各ページ・言語の保存済み変更を公開します。",
            "ビルド・デプロイの成功後に公開サイトを確認。ビルドリクエストの受理は、deploy完了を意味しません。"
          ],
          "paragraphs": [
            "ローカルではDeploy Hookなしで、公開後にDocsを再ビルドします。本番の閲覧時は、ページや管理対象メディアを静的に配信し、CMSのDBへ問い合わせません。"
          ],
          "link": "deployment"
        },
        {
          "id": "languages",
          "title": "複数の言語で書く",
          "paragraphs": [
            "文書の言語は src/site.config.ts で設定します。既定言語のページを作成・保存し、その保存済み内容をコピーして翻訳を追加します。",
            "翻訳を個別に公開する前に、既定言語のページを公開するか、まとめて公開します。フォルダ構成とURLのセグメントは言語間で共通です。",
            "管理画面の表示言語はヘッダーから別に選べます。English / 日本語を切り替えても、文書の編集言語は変わりません。"
          ]
        },
        {
          "id": "ai",
          "title": "WebMCPでAIに編集を頼む",
          "paragraphs": [
            "ネイティブWebMCPに対応するブラウザとAIエージェントで管理画面を開きます。本番ではAccessでログインし、管理画面のタブを開いたままにしてください。",
            "ページのレビュー、翻訳の不足確認、本文編集、下書き保存、プレビュー確認などを依頼できます。同じエディタに変更が反映され、本文編集は通常のUndoで戻せます。",
            "公開、削除、アップロード、履歴は管理画面の既存操作を使います。WebMCPは進化中のブラウザAPIです。対応状況と設定は詳細ガイドを参照してください。"
          ],
          "prompt": true,
          "link": "ai"
        }
      ],
      "moreTitle": "詳しい情報を調べる",
      "moreText": "デプロイ、設定、アップグレード、トラブルシューティング、設計資料は、引き続きリポジトリのdocsで管理しています。",
      "moreLink": "リポジトリのdocsを開く"
    },
    "heroDetail": "Cloudflareの無料枠で運用できる、カスタマイズ自由なOSS",
    "watch": "使い方を見る",
    "product": {
      "edit": "ブラウザで書く",
      "published": "静的サイトで配信",
      "caption": "同じ記事を、編集画面からStarlightのサイトへ",
      "note": "実際の画面・サンプル記事",
      "alt": "サイドバー、目次、検索が揃ったStarlightの公開ドキュメント。",
      "builtWith": "公開サイトはAstro Starlight",
      "watch": "編集から公開まで",
      "demoNote": "実際の画面に操作箇所を示しています。公開サイトへの反映にはビルドとデプロイが必要です。",
      "walkthrough": [
        {
          "title": "ブラウザで編集",
          "text": "ビジュアルエディタで、タイトルや記事を書きます。"
        },
        {
          "title": "下書きを保存",
          "text": "「変更を保存」で保存します。まだ公開サイトには反映されません。"
        },
        {
          "title": "プレビューを開く",
          "text": "保存したあと、「保存内容をプレビュー」を選びます。"
        },
        {
          "title": "表示を確認",
          "text": "保存した下書きをStarlightで確認。この画面はまだ非公開です。"
        },
        {
          "title": "変更を公開",
          "text": "管理画面に戻り、右上の「公開」を選んで確認します。"
        },
        {
          "title": "静的サイトで配信",
          "text": "ビルドとデプロイが成功すると、更新内容がサイトに反映されます。"
        }
      ]
    },
    "editing": {
      "title": "一度セットアップすれば\nあとはブラウザで",
      "text": "一度環境を作れば、日々の編集・公開はブラウザから。個人のドキュメントにも、チームのマニュアルにも使えます。Accessで許可した人なら、コードやGitの知識がなくても更新できます。",
      "details": [
        [
          "いつものように書く",
          "見出し、画像、表、コードをエディタから追加。コールアウト、ステップ、タブも使えます。"
        ],
        [
          "ページを整理する",
          "フォルダとページで構成を整理。そのままサイトのサイドバーとURLになります。"
        ],
        [
          "確かめてから公開する",
          "下書きを保存してプレビューで確認。過去に公開した内容を確認・復元することもできます。"
        ]
      ],
      "note": "多言語と全文検索も、最初から使えます。"
    },
    "ownership": {
      "title": "自分のサイトを\n自分のコードで",
      "text": "CLIでプロジェクト一式を作成。ロゴやデザイン、Starlightの設定も自由に変更できます。必要に応じてコードを変えながら、自分のサイトとして育てられます。",
      "license": "MITライセンス",
      "source": "ソースコードを見る",
      "securityTitle": "管理画面の入口はAccessに",
      "securityText": "管理画面を開ける人はCloudflare Accessで設定。CMS専用のアカウントやパスワードを管理する必要はありません。",
      "securityDetail": "許可されたメンバーは同じ管理権限で操作します。",
      "securityLink": "デプロイ手順を見る",
      "codeLabel": "自分のリポジトリに、プロジェクト一式",
      "files": [
        [
          "src/site.config.ts",
          "サイト名・文書の言語"
        ],
        [
          "src/assets/",
          "ロゴ・ファビコン"
        ],
        [
          "src/styles/",
          "サイトのスタイル"
        ],
        [
          "src/admin/",
          "編集画面"
        ]
      ]
    }
  }
};
