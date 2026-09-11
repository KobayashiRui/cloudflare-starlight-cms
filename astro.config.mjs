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
    logo: {
      src: './src/assets/logo.svg',
      alt: `${siteConfig.title} logo`,
      replacesTitle: true,
    },
    favicon: '/favicon.svg',
    customCss: ['./src/styles/starlight.css'],
    defaultLocale: 'root',
    locales: Object.fromEntries(siteConfig.locales.map(({ code, label }) => [
      code === siteConfig.defaultLocale ? 'root' : code, { label, lang: code },
    ])),
    sidebar: process.argv.includes('preview') ? [] : cmsSidebar(await loadSnapshot()),
  })],
});
