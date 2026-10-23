// Render these temporary SVG compositions in a browser at 1200 × 630 and save
// JPEG captures as assets/social-{en,ja}.jpg. Run after build.mjs; a subsequent
// build removes the temporary previews from dist.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from './content.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const escape = value => value.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
for (const locale of ['en','ja']) {
  const capture = (await readFile(join(root,'assets',`editor-${locale}.jpg`))).toString('base64');
  const lines = content[locale].hero;
  const note = locale === 'ja' ? 'ブラウザで編集・静的サイトとして公開' : 'Write in the browser. Publish a static site.';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><clipPath id="screen"><rect x="720" y="175" width="840" height="472" rx="10"/></clipPath></defs><rect width="1200" height="630" fill="#101115"/><g fill="#f2f2f5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Hiragino Sans,sans-serif"><text x="55" y="68" font-size="23" font-weight="500">Cloudflare Starlight CMS</text>${lines.map((line,i)=>`<text x="55" y="${230+i*88}" font-size="${locale==='ja'?47:60}" font-weight="600" letter-spacing="-2">${escape(line)}</text>`).join('')}<text x="58" y="403" font-size="${locale==='ja'?23:24}" fill="#aaaab5">${escape(note)}</text><text x="58" y="563" font-size="17" fill="#aaaab5">Open source · Your Cloudflare · MIT</text></g><rect x="719" y="174" width="842" height="474" rx="11" fill="#fff"/><image x="720" y="175" width="840" height="472" preserveAspectRatio="xMinYMin slice" clip-path="url(#screen)" href="data:image/jpeg;base64,${capture}"/></svg>`;
  await writeFile(join(root,'dist','assets',`social-preview-${locale}.svg`),svg);
}
console.log('Temporary social previews: assets/social-preview-en.svg and assets/social-preview-ja.svg');
