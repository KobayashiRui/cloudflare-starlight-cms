import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  output: 'static',
  integrations: [starlight({
    title: 'Cloudflare Starlight CMS',
    defaultLocale: 'root',
    locales: {
      root: { label: 'English', lang: 'en' },
      ja: { label: '日本語', lang: 'ja' },
    },
  })],
});
