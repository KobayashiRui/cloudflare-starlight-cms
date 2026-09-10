import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { siteConfig } from './src/site.config.ts';
import { loadSnapshot } from './src/starlight/source.ts';
import { cmsSidebar } from './src/starlight/sidebar.ts';

export default defineConfig({
  site: siteConfig.url || undefined,
  output: 'static',
  integrations: [starlight({
    title: siteConfig.title,
    defaultLocale: 'root',
    locales: Object.fromEntries(siteConfig.locales.map(({ code, label }) => [
      code === siteConfig.defaultLocale ? 'root' : code, { label, lang: code },
    ])),
    sidebar: process.argv.includes('preview') ? [] : cmsSidebar(await loadSnapshot()),
  })],
});
