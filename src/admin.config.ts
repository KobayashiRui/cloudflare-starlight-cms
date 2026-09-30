/** Admin display languages are independent of the site's document languages. */
export const adminConfig = {
  defaultLanguage: 'en',
  languages: [
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
  ],
} as const;
