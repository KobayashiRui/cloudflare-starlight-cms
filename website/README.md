# Project website

English and Japanese product pages and a basic usage guide, hosted on GitHub Pages. Detailed documentation remains in the root `docs/` directory. This website is repository-only and is not part of generated CMS projects.

## Build and preview

No installation or additional dependencies are needed. Use the repository's Node.js version:

```sh
node website/build.mjs
node website/check.mjs
```

The result is in `website/dist/`. To preview at the server root:

```sh
WEBSITE_URL=http://127.0.0.1:4173/ node website/build.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory website/dist
```

Open `http://127.0.0.1:4173/` or `/ja/`. The language dropdown preserves the current home/guide page and section fragment. There is no browser-language redirect.

`content.mjs` holds both languages. `build.mjs` renders shared HTML, canonical/alternate URLs, social metadata, a sitemap, and a 404 page. `style.css` is shared by both languages. Client JavaScript handles command copying, language/theme controls and the scroll-driven introduction. One sticky stage presents three scenes in order: the headline, browser editing, then Astro Starlight delivery. Scroll progress drives fades and subtle zooms, including on phones. Short windows, reduced-motion preferences and JavaScript-free views use the ordinary vertically stacked layout. Inactive scenes cannot receive keyboard focus. Content and navigation remain static; when JavaScript is disabled, language links replace the dropdown.

The introduction follows the sequential scroll presentation in this [design reference](https://note.com/code100/n/na8948318bfc6); the implementation uses the project's own HTML, CSS, JavaScript and product captures.

The theme initially follows the device preference, including OS changes. A sun/moon icon button switches between light and dark, matching the CMS. An explicit choice persists in this browser and across language/guide navigation. A small synchronous `theme.js` runs before CSS to apply a saved choice before rendering. Without JavaScript, CSS follows the OS preference. Public-site screenshots switch between actual light/dark captures. Admin captures use a consistent light appearance to keep editing controls readable in both website themes.

## GitHub Pages

In the repository's **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The `Website` workflow builds and checks pull requests, and deploys changes to `main` or a manual run. It uses `configure-pages` to resolve the actual Pages URL, including the repository subpath or an existing custom domain. No Cloudflare credentials, CMS content, or npm install are needed.

For the first publication:

1. Select **GitHub Actions** as the Pages source before running the workflow.
2. Merge the website and its linked documentation into `main`. Changes to `website/`, its workflow, the favicon or `.nvmrc` trigger a deployment. README-only changes do not.
3. Open **Actions → Website** and check that both `build` and `deploy` succeed. To redeploy without a code change, choose **Run workflow → main**. Manual runs on other branches only build and check.

PR builds never upload or deploy a Pages artifact. New commits cancel older PR checks; an active production deployment is allowed to finish. The workflow publishes only `website/dist/`, with ten-minute timeouts per job. It does not run the CLI publication workflow.

The default URL is `https://kobayashirui.github.io/cloudflare-starlight-cms/`. A local build can override it with `WEBSITE_URL`. For a custom domain, configure it in GitHub Pages before deployment; the workflow obtains that URL from GitHub.

## Search visibility

All four pages contain their headings and content in the generated HTML, including every walkthrough explanation. Page titles, descriptions, self-referencing canonical URLs, reciprocal English/Japanese/x-default alternates, social metadata and JSON-LD are generated together. Only the 404 document has `noindex`; the sitemap lists the four public routes.

The shared HTML head includes the maintainer's Google Search Console verification meta tag. This public verification value belongs only to this repository's website, which is excluded from generated CMS projects. Keep the tag after verification so Google can recheck ownership; replace or remove it when publishing a fork under a different owner.

After deployment, verify the live site in Google Search Console using the URL-prefix property `https://kobayashirui.github.io/cloudflare-starlight-cms/` and the HTML tag method, submit the absolute `sitemap.xml` URL and inspect the English/Japanese home and guide URLs. Check the deployed canonical URLs and HTTP responses; successful local checks do not establish ownership verification or indexing. Use the actual site URL instead if a custom domain is configured.

For the default project URL, the generated `robots.txt` is served under `/cloudflare-starlight-cms/robots.txt`. Crawlers use the host-root `https://kobayashirui.github.io/robots.txt`, so the project file does not control crawling or advertise its sitemap there. Submit the project sitemap directly in Search Console, or reference it from a host-root robots file if that site is managed separately. With a custom domain served at `/`, the generated robots file is at the correct location. Missing robots rules do not by themselves block crawling; check the actual host-root policy.

Google's AI search features follow normal indexing/SEO requirements and do not require a special AI file or schema. For ChatGPT search, ensure the live host permits OAI-SearchBot. Search crawling and model-training crawling have separate controls. Search inclusion and AI citations are not confirmed by repository checks.

References: [Google AI features](https://developers.google.com/search/docs/appearance/ai-features), [robots.txt location](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), [OpenAI crawlers](https://developers.openai.com/api/docs/bots).

## Product screens and demos

All product imagery uses the real CMS and its built Starlight site, with sample articles in an isolated local database under `/private/tmp/starlight-website-preview-state`. No production content or existing local database was used.

- `assets/editor-{en,ja}.jpg`: 1280 × 640 crops of the real Admin, including localized article text.
- `assets/public-{en,ja}{,-dark}.jpg`: 1280 × 800 real published Starlight pages. The public preview uses the same articles as the editor.
- `assets/workflow-{en,ja}.gif`: six-step loops showing editing, saving, opening Preview, checking the saved page, the Publish button, and the built site. Control annotations point to the enabled buttons in their actual capture; Preview/public result frames use only the explanatory heading so annotations do not obscure the article. Publishing/building occurred between captures through the local API and CLI; these are excerpts, not uninterrupted recordings or evidence of immediate publication.
- The landing page uses a scroll-controlled walkthrough instead of embedding the GIF. Six scenes place descriptions above full-width screen captures; inline SVGs highlight editing, Save, Preview and Publish controls. A small step counter beside the section heading follows scroll progress. The heading, explanation, image and note stay together as one vertically centered group. Wide, short viewports limit the image window's height while preserving the capture/annotation scale. Images settle after each short scene transition, so readers can stop and inspect them. Windows shorter than 700px, reduced-motion preferences and JavaScript-free views show the scenes as ordinary vertical content and hide the counter. The AI section uses the example prompt and short explanation without a separate GIF.
- `captures/` retains the real sample screenshots used by these demonstrations. Website builds copy the required editing/Preview captures as static assets; the walkthrough also reuses the public-site image. The standalone GIFs remain for README and sharing. `node website/demo.mjs` builds their temporary code-native SVG annotation compositions in `dist/assets/demo-frames/`. Capture them in a browser at 1100 × 800, then run `python3 website/encode-demos.py /path/to/captured-jpeg-frames` to encode the GIFs and posters. Pillow is optional for this manual asset-authoring step; CI builds and CMS projects require no new dependencies. A regular website rebuild removes temporary compositions.
- `assets/social-{en,ja}.jpg`: localized 1200 × 630 social cards. `node website/social.mjs` generates temporary SVG compositions in `dist/assets/` using the current editor captures. Capture each SVG in a browser at 1200 × 630, save the JPEG in `assets/`, then rebuild to remove the temporary previews.

Do not replace product screens with invented UI or introduce sample data into the CMS runtime. Update intrinsic dimensions in `build.mjs` after changing capture sizes.

## Repository About

Suggested GitHub Description:

> Self-hosted docs CMS with browser editing and static Astro Starlight publishing. Run on Cloudflare’s free tier, on your own or with a team. MIT, with WebMCP.

Set the repository Website field to the actual Pages URL after its first successful deployment. Repository About settings are managed in GitHub and are not changed by this workflow.

## Launch copy

English:

> Run your own docs site on Cloudflare’s free tier. Set it up once, then write and publish from the browser, on your own or with a team. Open source and fully customizable, with static Starlight delivery, Access protection, multilingual content and WebMCP AI editing.

Japanese:

> 自分のドキュメントサイトを、Cloudflareの無料枠で運用。個人でもチームでも、一度セットアップすれば編集・公開はブラウザから。コードやGitを触らず更新でき、公開サイトは完全静的。AccessとWebMCPにも対応した、カスタマイズ自由なMITのOSSです。

Link to `/#demo` or `/ja/#demo` for the editing workflow and `/#ai` or `/ja/#ai` for WebMCP. The localized workflow GIF can also be downloaded from the deployed site's `assets/` directory for a standalone introduction. Free operation is within Cloudflare's allowances; domain costs are separate.
