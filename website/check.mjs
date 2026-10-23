import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const home = await readFile(join(output, 'index.html'), 'utf8');
const site = new URL(home.match(/<link rel="canonical" href="([^"]+)"/)[1]);
const pages = ['index.html', 'getting-started/index.html', 'ja/index.html', 'ja/getting-started/index.html'];
const decode = (value) => value.replace(/&amp;/g, '&');
const idSets = new Map();
for (const page of pages) {
  const html = await readFile(join(output, page), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${page}`);
  idSets.set(page, new Set(ids));
}
let checked = 0;
for (const page of pages) {
  const html = await readFile(join(output, page), 'utf8');
  const locale = page.startsWith('ja/') ? 'ja' : 'en';
  const route = page.replace(/index\.html$/, '');
  const url = new URL(route, site);
  assert.ok(html.includes(`<html lang="${locale}">`), `Wrong language: ${page}`);
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `Expected one H1: ${page}`);
  assert.ok(html.includes(`<link rel="canonical" href="${url.href}">`), `Wrong canonical: ${page}`);
  for (const language of ['en', 'ja', 'x-default']) assert.ok(html.includes(`hreflang="${language}"`), `Missing alternate: ${page}`);
  assert.ok(html.includes('name="description"'), `Missing description: ${page}`);
  assert.ok(html.includes('property="og:image"'), `Missing social image: ${page}`);
  assert.ok(html.includes('WebMCP'), `Missing AI documentation: ${page}`);
  assert.ok(!html.includes('undefined'), `Unresolved content: ${page}`);
  JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1]);
  const languages = html.match(/<select data-language-select[^>]*>([^]*?)<\/select>/)[1];
  const languageLinks = [...languages.matchAll(/value="([^"]+)"/g)].map((match) => match[1]);
  const guide = page.includes('getting-started/');
  assert.deepEqual(languageLinks, [site.pathname + (guide ? 'getting-started/' : ''), site.pathname + 'ja/' + (guide ? 'getting-started/' : '')], `Language selector lost the page route: ${page}`);
  const links = [...html.matchAll(/\b(?:href|src|srcset)="([^"]+)"/g)].map((match) => match[1]);
  links.push(html.match(/property="og:image" content="([^"]+)"/)[1]);
  for (const link of [...links, ...languageLinks]) {
    const target = new URL(decode(link), url);
    if (target.origin !== site.origin) {
      // Keep links to repository docs honest without depending on a network connection.
      const prefix = 'https://github.com/KobayashiRui/cloudflare-starlight-cms/blob/main/';
      if (target.href.startsWith(prefix)) await access(join(root, '..', target.pathname.split('/blob/main/')[1]));
      continue;
    }
    assert.ok(target.pathname.startsWith(site.pathname), `Link escaped the GitHub Pages base: ${target.href}`);
    const relative = decodeURIComponent(target.pathname.slice(site.pathname.length));
    const file = relative.endsWith('/') || !relative ? `${relative}index.html` : relative;
    await access(join(output, file));
    if (target.hash && idSets.has(file)) assert.ok(idSets.get(file).has(decodeURIComponent(target.hash.slice(1))), `Broken fragment: ${target.href}`);
    checked++;
  }
}
for (const locale of ['en', 'ja']) {
  for (const name of [`editor-${locale}`, `public-${locale}`, `public-${locale}-dark`, `social-${locale}`]) {
    const image = await readFile(join(output, 'assets', `${name}.jpg`));
    assert.equal(image.readUInt16BE(0), 0xffd8, 'Screenshots must be real JPEG files');
    assert.equal(image.readUInt16BE(image.length - 2), 0xffd9, 'Screenshot is incomplete');
  }
}
for (const locale of ['en','ja']) {
  for (const kind of ['workflow']) {
    const name = `${kind}-${locale}`;
    const gif = await readFile(join(output, 'assets', `${name}.gif`));
    assert.equal(gif.toString('ascii', 0, 6), 'GIF89a', `Not an animated GIF: ${name}`);
    assert.equal(gif.readUInt16LE(6), 1100, `Wrong GIF width: ${name}`);
    assert.equal(gif.readUInt16LE(8), 800, `Wrong GIF height: ${name}`);
    assert.equal(gif[gif.length - 1], 0x3b, `Incomplete GIF: ${name}`);
  }
}
const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
for (const page of pages) assert.ok(sitemap.includes(new URL(page.replace(/index\.html$/, ''), site).href), `Missing sitemap URL: ${page}`);
assert.ok((await readFile(join(output, 'robots.txt'), 'utf8')).includes(new URL('sitemap.xml', site).href));
assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', '404.html', 'assets', 'getting-started', 'index.html', 'ja', 'robots.txt', 'sitemap.xml'].sort());
console.log(`Checked ${pages.length} localized pages, ${checked} internal links/assets, repository docs, screenshots, and SEO metadata.`);
