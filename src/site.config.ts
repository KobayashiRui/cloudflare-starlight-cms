/** Fork this repository and edit these public site settings. Secrets belong in Cloudflare. */
export const siteConfig = {
  title: 'Cloudflare Starlight CMS',
  url: '', // Set the production origin, e.g. https://docs.example.com
  defaultLocale: 'en',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
  ],
} as const;
