import { adminConfig } from '../../admin.config';
import { en } from './en';
import { ja } from './ja';

export type AdminLanguage = typeof adminConfig.languages[number]['code'];
export type MessageValues = Record<string, string | number>;
export type AdminMessage = string | { text: string; values: MessageValues };
const dictionaries: Record<AdminLanguage, Record<string, string>> = { en, ja };
export const languageStorageKey = 'cms.admin.language';

export function isAdminLanguage(value: string | null): value is AdminLanguage {
  return adminConfig.languages.some((language) => language.code === value);
}

export function resolveAdminLanguage(saved: string | null, browserLanguages: readonly string[]): AdminLanguage {
  if (isAdminLanguage(saved)) return saved;
  for (const locale of browserLanguages) {
    const language = locale.toLowerCase().split('-')[0] ?? '';
    if (isAdminLanguage(language)) return language;
  }
  return adminConfig.defaultLanguage;
}

export function translate(language: AdminLanguage, text: string, values: MessageValues = {}): string {
  const dictionary = dictionaries[language];
  const template = Object.hasOwn(dictionary, text) ? dictionary[text] ?? text : text;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

export function message(text: string, values: MessageValues): AdminMessage {
  return { text, values };
}
