import { siteConfig } from './site.config.ts';
export const defaultLocale = siteConfig.defaultLocale;
export const supportedLocales = siteConfig.locales.map(({ code }) => code);
export type SupportedLocale = (typeof supportedLocales)[number];
export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.some((locale) => locale === value);
}
export function localeLabel(value: SupportedLocale): string {
  return siteConfig.locales.find(({ code }) => code === value)?.label ?? value;
}
