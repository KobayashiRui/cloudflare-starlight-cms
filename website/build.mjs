import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from './content.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const repository = 'https://github.com/KobayashiRui/cloudflare-starlight-cms';
// configure-pages supplies the real base URL, including a project subpath or custom domain.
const site = new URL(process.env.WEBSITE_URL || 'https://kobayashirui.github.io/cloudflare-starlight-cms/');
if (!['http:', 'https:'].includes(site.protocol) || site.search || site.hash) throw new Error('WEBSITE_URL must be an HTTP(S) site URL without a query or fragment');
site.pathname = `${site.pathname.replace(/\/+$/, '')}/`;
const base = site.pathname;
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const path = (locale, guide = false) => `${locale === 'ja' ? 'ja/' : ''}${guide ? 'getting-started/' : ''}`;
const href = (locale, guide = false) => `${base}${path(locale, guide)}`;
const asset = (name) => `${base}assets/${name}`;
const doc = (name, locale) => `${repository}/blob/main/docs/${name}${locale === 'ja' && ['DEPLOYMENT', 'TROUBLESHOOTING'].includes(name) ? '.ja' : ''}.md`;
const arrow = '<span aria-hidden="true">↗</span>';
const command = 'npx create-starlight-cms@latest my-docs';
const commands = `${command}\ncd my-docs\nnpm install\nnpm run dev`;
// Intrinsic dimensions of the actual browser captures reserve space before loading.
const screenshotSize = { width: 1280, height: 800 };

function terminal(t, compact = false) {
  return `<div class="terminal${compact ? ' terminal-compact' : ''}">
    <div class="terminal-bar"><span>${escape(compact ? t.commandLabel : t.quickstart.requirement)}</span><button type="button" data-copy data-copied="${escape(t.copied)}" data-failed="${escape(t.copyFailed)}">${escape(t.copy)}</button></div>
    <pre><code>${escape(compact ? command : commands)}</code></pre><span class="sr-only" role="status" data-copy-status></span>
  </div>`;
}

function shell(locale, guide, body) {
  const t = content[locale];
  const other = locale === 'en' ? 'ja' : 'en';
  const canonical = new URL(path(locale, guide), site).href;
  const title = `${guide ? t.guide.title : t.title} | Cloudflare Starlight CMS`;
  const description = guide ? t.guide.description : t.description;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: 'Cloudflare Starlight CMS',
    programmingLanguage: 'TypeScript', runtimePlatform: 'Cloudflare Workers', description: t.description,
    license: `${repository}/blob/main/LICENSE`, codeRepository: repository, url: site.href, inLanguage: locale,
  };
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title><meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#fafafa"><link rel="canonical" href="${escape(canonical)}">
  ${['en', 'ja', 'x-default'].map((language) => `<link rel="alternate" hreflang="${language}" href="${escape(new URL(path(language === 'ja' ? 'ja' : 'en', guide), site).href)}">`).join('\n  ')}
  <meta property="og:type" content="website"><meta property="og:site_name" content="Cloudflare Starlight CMS">
  <meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${escape(canonical)}"><meta property="og:locale" content="${locale === 'ja' ? 'ja_JP' : 'en_US'}">
  <meta property="og:locale:alternate" content="${locale === 'ja' ? 'en_US' : 'ja_JP'}">
  <meta property="og:image" content="${escape(new URL(`assets/social-${locale}.jpg`, site).href)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(t.title)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${asset('favicon.svg')}" type="image/svg+xml">
  <script src="${asset('theme.js')}"></script>
  <link rel="stylesheet" href="${asset('style.css')}"><script src="${asset('site.js')}" defer></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
  <a class="skip-link" href="#main">${escape(t.nav.skip)}</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="${href(locale)}" aria-label="Cloudflare Starlight CMS"><img src="${asset('favicon.svg')}" width="34" height="34" alt=""><span><span class="brand-prefix">Cloudflare</span><strong>Starlight CMS</strong></span></a>
    <nav aria-label="${locale === 'ja' ? 'メインナビゲーション' : 'Main navigation'}">
      <a class="desktop-link" href="${href(locale)}#features">${escape(t.nav.features)}</a>
      <a class="desktop-link" href="${href(locale)}#workflow">${escape(t.nav.workflow)}</a>
      <a class="nav-guide" href="${href(locale, true)}"${guide ? ' aria-current="page"' : ''}>${escape(t.nav.guide)}</a>
      <div class="nav-controls js-only">
        <label class="select-control"><span class="sr-only">${escape(t.nav.language)}</span><select data-language-select aria-label="${escape(t.nav.language)}">${['en', 'ja'].map((language) => `<option value="${href(language, guide)}"${language === locale ? ' selected' : ''}>${escape(content[language].language)}</option>`).join('')}</select></label>
        <button class="theme-toggle" type="button" data-theme-toggle data-light-label="${escape(t.nav.switchToLight)}" data-dark-label="${escape(t.nav.switchToDark)}" aria-label="${escape(t.nav.switchToDark)}" title="${escape(t.nav.switchToDark)}">
          <svg class="theme-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>
          <svg class="theme-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>
        </button>
      </div>
      <noscript><a href="${href(other, guide)}" lang="${other}">${escape(t.otherLanguage)}</a></noscript>
      <a class="nav-github" href="${repository}" aria-label="GitHub">${githubIcon()}<span class="desktop-link">GitHub</span></a>
    </nav>
  </div></header>
  <main id="main">${body}</main>
  <footer class="site-footer container"><div class="footer-top"><div><a class="brand" href="${href(locale)}"><img src="${asset('favicon.svg')}" width="32" height="32" alt=""><span>Cloudflare <strong>Starlight CMS</strong></span></a><p>${escape(t.footer.tagline)}</p></div>
    <nav aria-label="${locale === 'ja' ? '関連リンク' : 'Resources'}"><a href="${href(locale, true)}">${escape(t.footer.guide)}</a><a href="${doc('DEPLOYMENT', locale)}">${escape(t.footer.deployment)} ${arrow}</a><a href="${doc('TROUBLESHOOTING', locale)}">${escape(t.footer.troubleshooting)} ${arrow}</a><a href="${doc('WEBMCP', locale)}">${escape(t.footer.ai)} ${arrow}</a><a href="${repository}">GitHub ${arrow}</a></nav></div>
    <div class="footer-bottom"><span>${escape(t.footer.disclaimer)}</span><a href="${repository}/blob/main/LICENSE">${escape(t.footer.license)} ${arrow}</a></div>
  </footer>
</body></html>\n`;
}

function githubIcon() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .8a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-5.7 0-1.2.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.8 5.4-5.4 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .8Z"/></svg>';
}

function workflowIcon(index) {
  const shapes = [
    '<rect x="3" y="4" width="26" height="24" rx="3"/><path d="M3 11h26M8 7.5h.01m4 0h.01M10 18l-3 3 3 3m12-6 3 3-3 3"/>',
    '<path d="M10 3h11l6 6v20H10a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm11 0v7h6M12 16h10m-10 5h10m-10 5h6"/>',
    '<rect x="3" y="4" width="26" height="24" rx="3"/><path d="M3 11h26M8 7.5h.01m4 0h.01M8 17h10m-10 5h16"/>',
  ];
  return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[index]}</svg>`;
}

function home(locale) {
  const t = content[locale];
  const lines = (value) => value.split('\n').map(escape).join('<br>');
  const image = (name, alt, lazy = true) => (name === 'editor' ? ['light'] : ['light', 'dark']).map((theme) => `<img${name === 'public' ? ` class="screenshot-${theme}"` : ''} src="${asset(`${name}-${locale}${theme === 'dark' ? '-dark' : ''}.jpg`)}" width="${screenshotSize.width}" height="${name === 'editor' ? 640 : screenshotSize.height}" alt="${escape(alt)}"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">`).join('');
  const demoSources = [`edit-${locale}-1`, `edit-${locale}-1`, `edit-${locale}-2`, `preview-${locale}`, `edit-${locale}-2`, `public-${locale}`];
  const targets = locale === 'ja'
    ? [[286,325,958,70],[908,84,90,36],[896,84,152,36],null,[1057,14,70,36],null]
    : [[286,350,958,70],[866,117,90,36],[922,117,107,36],null,[1034,14,92,36],null];
  const demoAnnotation = (index) => {
    const target = targets[index];
    if (!target) return '';
    const [x,y,w,h] = target;
    const tx = x + w/2;
    const ty = y + h + 5;
    const marker = `demo-arrow-${locale}-${index}`;
    return `<svg class="walkthrough-annotation" viewBox="0 0 1280 800" fill="none" aria-hidden="true"><defs><marker id="${marker}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto"><path d="M1 1 11 6 1 11" stroke="#dc5a31" stroke-width="2" stroke-linejoin="round"/></marker></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" stroke="#fff" stroke-width="9"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" stroke="#dc5a31" stroke-width="3"/><path d="M${tx-85} ${ty+95} Q${tx-85} ${ty+55} ${tx} ${ty}" stroke="#dc5a31" stroke-width="3" marker-end="url(#${marker})"/></svg>`;
  };
  return shell(locale, false, `
    <div class="intro-story" data-story><div class="story-stage">
    <section class="story-scene hero container" data-story-scene>
      <h1>${escape(t.hero[0])}<br>${escape(t.hero[1])}</h1>
      <p class="hero-intro">${escape(t.intro)}<br><span>${escape(t.heroDetail)}</span></p>
      <div class="hero-actions"><a class="button button-primary" href="#start">${escape(t.start)} <span aria-hidden="true">→</span></a><a class="button button-secondary" href="#demo">${escape(t.watch)} <span aria-hidden="true">↓</span></a></div>
      <ul class="hero-notes">${t.heroNotes.map((note) => `<li>${escape(note)}</li>`).join('')}</ul>
    </section>
    <figure class="story-scene story-screen container" data-story-scene><figcaption class="screen-label"><span class="screen-kind">CMS</span><h2>${escape(t.product.edit)}</h2></figcaption><div class="product-frame">${image('editor',t.screenshotAlt,false)}</div></figure>
    <figure class="story-scene story-screen container" data-story-scene><figcaption class="screen-label"><span class="screen-kind">Astro Starlight</span><h2>${escape(t.product.published)}</h2></figcaption><div class="product-frame">${image('public',t.product.alt,false)}</div></figure>
    </div></div>
    <section class="editing section container" id="features"><div class="section-heading"><h2>${lines(t.editing.title)}</h2><p>${escape(t.editing.text)}</p><span class="included-note">${escape(t.editing.note)}</span></div><div class="editing-details">${t.editing.details.map(([title,text])=>`<article><h3>${escape(title)}</h3><p>${escape(text)}</p></article>`).join('')}</div></section>
    <section class="walkthrough container" id="demo" data-walkthrough><div class="walkthrough-stage"><div class="walkthrough-header"><h2 class="walkthrough-heading">${escape(t.product.watch)}</h2><span class="walkthrough-progress"><span class="sr-only">${locale === 'ja' ? '手順' : 'Step'} </span><span data-walkthrough-current>1</span><span class="walkthrough-total"> / ${t.product.walkthrough.length}</span></span></div><div class="walkthrough-scenes">${t.product.walkthrough.map((step,index)=>{
      const source = demoSources[index];
      const height = source.startsWith('edit-ja') || source.startsWith('preview') ? 720 : 800;
      return `<article class="walkthrough-scene" data-walkthrough-scene><div class="walkthrough-copy"><h3>${escape(step.title)}</h3><p>${escape(step.text)}</p></div><div class="walkthrough-screen"><div class="walkthrough-canvas"><img src="${asset(`${index === 5 ? '' : 'capture-'}${source}.jpg`)}" width="1280" height="${height}" loading="lazy" decoding="async" alt="${escape(step.title)}">${demoAnnotation(index)}</div></div></article>`;
    }).join('')}</div><p class="section-note">${escape(t.product.demoNote)}</p></div></section>
    <section class="workflow section container" id="workflow"><div class="section-heading"><h2>${lines(t.workflow.title)}</h2><p>${escape(t.workflow.intro)}</p></div>
      <div><ol class="workflow-grid">${t.workflow.steps.map((step,index) => `<li>${workflowIcon(index)}<div class="workflow-step-body"><h3>${escape(step.title)}</h3><span class="step-meta">${escape(step.meta)}</span><p>${escape(step.text)}</p></div>${index < t.workflow.steps.length-1 ? '<svg class="workflow-connector" width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h19m-6-5 6 5-6 5"/></svg>' : ''}</li>`).join('')}</ol><p class="section-note">${escape(t.workflow.note)}</p></div>
      <div class="cost-row"><h3>${escape(t.workflow.costTitle)}</h3><div><p>${escape(t.workflow.costText)}</p><a class="text-link" href="https://developers.cloudflare.com/workers/platform/pricing/">${escape(t.workflow.costLink)} ${arrow}</a></div></div>
    </section>
    <section class="ai-section section container" id="ai"><div class="ai-copy"><h2>${lines(t.ai.title)}</h2><p>${escape(t.ai.text)}</p><a class="text-link" href="${href(locale, true)}#ai">${escape(t.ai.link)} <span aria-hidden="true">→</span></a></div><div class="ai-example"><span class="prompt-label">${escape(t.ai.promptLabel)}</span><blockquote>${escape(t.ai.prompt)}</blockquote><ol class="ai-steps">${t.ai.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p class="ai-note">${escape(t.ai.note)}</p></div></section>
    <section class="ownership section container"><div class="section-heading"><h2>${lines(t.ownership.title)}</h2><p>${escape(t.ownership.text)}</p><a class="text-link" href="${repository}">${escape(t.ownership.source)} ${arrow}</a></div><div class="project-files"><div class="file-header"><span>${escape(t.ownership.codeLabel)}</span><span>MIT</span></div>${t.ownership.files.map(([file,label])=>`<div><code>${escape(file)}</code><span>${escape(label)}</span></div>`).join('')}</div><div class="access-row"><div><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg><h3>${escape(t.ownership.securityTitle)}</h3></div><div><p>${escape(t.ownership.securityText)}</p><p class="section-note">${escape(t.ownership.securityDetail)}</p><a class="text-link" href="${doc('DEPLOYMENT',locale)}">${escape(t.ownership.securityLink)} ${arrow}</a></div></div></section>
    <section class="quickstart section container" id="start"><div><h2>${escape(t.quickstart.title)}</h2><p>${escape(t.quickstart.text)}</p><div class="start-links"><a class="text-link" href="${href(locale, true)}">${escape(t.quickstart.guide)} →</a><a class="text-link subtle-link" href="${doc('DEPLOYMENT', locale)}">${escape(t.quickstart.deploy)} ${arrow}</a></div></div><div>${terminal(t)}<div class="local-addresses"><span>${escape(t.quickstart.admin)} <code>127.0.0.1:8787/admin/</code></span><span>${escape(t.quickstart.docs)} <code>127.0.0.1:4321</code></span></div></div></section>
    <section class="faq section container"><h2>${escape(t.faq.title)}</h2><div class="faq-list">${t.faq.items.map(([question, answer], index) => `<details><summary>${escape(question)}<span aria-hidden="true">+</span></summary><div><p>${escape(answer)}</p>${index === 0 ? `<a class="text-link" href="https://developers.cloudflare.com/workers/platform/pricing/">${escape(t.faq.pricing)} ${arrow}</a>` : ''}</div></details>`).join('')}</div></section>
  `);
}

function guide(locale) {
  const t = content[locale];
  return shell(locale, true, `
    <div class="guide-hero container"><a class="back-link" href="${href(locale)}">← ${escape(t.guide.back)}</a><h1>${escape(t.guide.title)}</h1><p>${escape(t.guide.intro)}</p></div>
    <div class="guide-layout container"><aside class="guide-toc"><nav aria-label="${escape(t.guide.toc)}"><strong>${escape(t.guide.toc)}</strong>${t.guide.sections.map((section) => `<a href="#${section.id}">${escape(section.title)}</a>`).join('')}</nav></aside><div class="guide-content">
      ${t.guide.sections.map((section) => `<section id="${section.id}"><h2>${escape(section.title)}</h2>${section.steps ? `<ol>${section.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol>` : ''}${section.paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('')}${section.code ? terminal(t) : ''}${section.prompt ? `<blockquote>${escape(t.ai.prompt)}</blockquote>` : ''}${section.link ? `<a class="text-link" href="${doc(section.link === 'ai' ? 'WEBMCP' : 'DEPLOYMENT', locale)}">${escape(section.link === 'ai' ? t.footer.ai : t.quickstart.deploy)} ${arrow}</a>` : ''}</section>`).join('')}
      <section class="guide-more"><h2>${escape(t.guide.moreTitle)}</h2><p>${escape(t.guide.moreText)}</p><a class="text-link" href="${repository}/tree/main/docs">${escape(t.guide.moreLink)} ${arrow}</a></section>
    </div></div>
  `);
}

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets'), { recursive: true });
await cp(join(root, 'assets'), join(output, 'assets'), { recursive: true });
await cp(join(root, '..', 'src/assets/favicon.svg'), join(output, 'assets/favicon.svg'));
for (const name of ['style.css', 'site.js', 'theme.js']) await cp(join(root, name), join(output, 'assets', name));
for (const locale of ['en','ja']) {
  for (const name of [`edit-${locale}-1`,`edit-${locale}-2`,`preview-${locale}`]) {
    await cp(join(root,'captures',`${name}.jpg`),join(output,'assets',`capture-${name}.jpg`));
  }
}
for (const locale of ['en', 'ja']) {
  for (const isGuide of [false, true]) {
    const directory = join(output, path(locale, isGuide));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), isGuide ? guide(locale) : home(locale));
  }
}
const urls = ['en', 'ja'].flatMap((locale) => [false, true].map((isGuide) => new URL(path(locale, isGuide), site).href));
await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>\n`);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', site).href}\n`);
await writeFile(join(output, '.nojekyll'), '');
await writeFile(join(output, '404.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Cloudflare Starlight CMS</title><script src="${asset('theme.js')}"></script><link rel="stylesheet" href="${asset('style.css')}"><main class="guide-hero container"><p class="eyebrow">404</p><h1>Page not found</h1><p><a class="text-link" href="${href('en')}">English home →</a></p><p><a class="text-link" href="${href('ja')}" lang="ja">日本語のトップページ →</a></p></main></html>\n`);
console.log(`Built ${urls.length} English/Japanese pages in website/dist for ${site.href}`);
