// Render these temporary SVG compositions at 1100 × 800 in a browser,
// then encode the captured frames as looping GIFs with encode-demos.py.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const target = join(root, 'dist', 'assets', 'demo-frames');
await mkdir(target, { recursive: true });
const escape = text => text.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const text = {
  en: [
    ['Write in the browser', 'Edit the title and article in the visual editor.', 'Edit here'],
    ['Save the draft', 'Choose Save draft. Your edits stay private until you publish.', 'Save draft'],
    ['Open Preview', 'After saving, choose Preview draft to check the page.', 'Open Preview'],
    ['Review before publishing', 'This is the saved draft in Starlight. It is not the public site yet.'],
    ['Publish your changes', 'Return to the Admin and choose Publish, then confirm the request.', 'Publish'],
    ['Read the static site', 'After the build and deployment succeed, the updated site is public.'],
  ],
  ja: [
    ['ブラウザで編集', 'ビジュアルエディタで、タイトルや記事を編集します。', 'ここを編集'],
    ['下書きを保存', '「変更を保存」を選択。まだ公開サイトには反映されません。', '変更を保存'],
    ['プレビューを開く', '保存したあと、「保存内容をプレビュー」を選びます。', 'ここからプレビュー'],
    ['公開前に表示を確認', '保存した下書きをStarlightで確認。この画面はまだ非公開です。'],
    ['変更を公開', '管理画面に戻り、右上の「公開」を選んで確認します。', 'ここから公開'],
    ['静的サイトで配信', 'ビルドとデプロイが成功すると、更新内容が公開サイトに反映されます。'],
  ],
};
// Control positions use the original 1280px captures. Display-only frames
// have no arrows or outlines because there is no control to point at.
const geometry = {
  en: [
    {rect:[286,350,958,70],label:[770,480]},
    {rect:[866,117,90,36],label:[680,225]},
    {rect:[922,117,107,36],label:[740,225]},
    null,
    {rect:[1034,14,92,36],label:[790,160]},
    null,
  ],
  ja: [
    {rect:[286,325,958,70],label:[770,455]},
    {rect:[908,84,90,36],label:[720,200]},
    {rect:[896,84,152,36],label:[730,200]},
    null,
    {rect:[1057,14,70,36],label:[800,160]},
    null,
  ],
};
const manifest = [];
for (const locale of ['en','ja']) {
  const sources = [`edit-${locale}-1`, `edit-${locale}-1`, `edit-${locale}-2`, `preview-${locale}`, `edit-${locale}-2`, `public-${locale}`];
  const frames = [];
  for (const [index,name] of sources.entries()) {
    const data = (await readFile(join(root,'captures',`${name}.jpg`))).toString('base64');
    const [title,description,label] = text[locale][index];
    const g = geometry[locale][index];
    let annotation = '';
    if (g) {
      const [x,y,w,h] = g.rect;
      const [lx,ly] = g.label;
      const labelWidth = locale === 'ja' && index === 2 ? 280 : 235;
      const tx = x + w / 2;
      const ty = y + h + 4;
      annotation = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="#fff" stroke-width="10"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="#e05a2b" stroke-width="4"/><path d="M${lx+labelWidth/2} ${ly} Q${lx+labelWidth/2} ${ly-40} ${tx} ${ty}" fill="none" stroke="#fff" stroke-width="9"/><path d="M${lx+labelWidth/2} ${ly} Q${lx+labelWidth/2} ${ly-40} ${tx} ${ty}" fill="none" stroke="#e05a2b" stroke-width="4" marker-end="url(#arrow)"/><rect x="${lx}" y="${ly}" width="${labelWidth}" height="48" rx="7" fill="#fff" stroke="#e05a2b" stroke-width="3"/><text x="${lx+labelWidth/2}" y="${ly+32}" text-anchor="middle" fill="#8d3011" font-size="22" font-weight="600">${escape(label)}</text>`;
    }
    const height = name.startsWith('edit-ja') || name.startsWith('preview') ? 720 : 800;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800" viewBox="0 0 1100 800"><defs><marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto"><path d="M1 1 11 6 1 11" fill="none" stroke="#e05a2b" stroke-width="2" stroke-linejoin="round"/></marker></defs><rect width="1100" height="800" fill="#f5f6f8"/><rect width="1100" height="106" fill="#15161b"/><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Hiragino Sans,sans-serif"><text x="28" y="43" fill="#b5b5c0" font-size="19">${String(index+1).padStart(2,'0')} / ${sources.length}</text><text x="126" y="44" fill="#fff" font-size="27" font-weight="600">${escape(title)}</text><text x="28" y="81" fill="#d1d1da" font-size="18">${escape(description)}</text><g transform="translate(0 106) scale(.859375)"><image href="data:image/jpeg;base64,${data}" width="1280" height="${height}"/>${annotation}</g></g></svg>`;
    const file = `workflow-${locale}-${index+1}.svg`;
    await writeFile(join(target,file),svg);
    frames.push(file);
  }
  manifest.push({name:`workflow-${locale}`,frames,duration:3000});
}
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('Annotated SVG frames prepared in website/dist/assets/demo-frames/');
