/**
 * Translation records use language codes. The Starlight adapter maps the
 * default language to an unprefixed URL when public i18n is enabled.
 */
export const defaultLocale = 'en' as const;
export const supportedLocales = [defaultLocale, 'ja'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}
