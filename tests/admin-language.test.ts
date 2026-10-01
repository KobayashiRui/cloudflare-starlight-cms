import { describe, expect, it } from 'vitest';
import { resolveAdminLanguage, translate } from '../src/admin/i18n/language';
import { en } from '../src/admin/i18n/en';
import { ja } from '../src/admin/i18n/ja';

describe('Admin display language', () => {
  it('uses explicit selection before browser languages', () => {
    expect(resolveAdminLanguage('en', ['ja-JP', 'en'])).toBe('en');
    expect(resolveAdminLanguage('ja', ['en-US'])).toBe('ja');
  });
  it('uses the first supported browser language including regional variants', () => {
    expect(resolveAdminLanguage(null, ['fr-FR', 'ja-JP', 'en-US'])).toBe('ja');
    expect(resolveAdminLanguage(null, ['EN-us', 'ja'])).toBe('en');
    expect(resolveAdminLanguage('removed-language', ['ja'])).toBe('ja');
  });
  it('falls back to the configured default', () => {
    expect(resolveAdminLanguage(null, ['fr', 'de'])).toBe('en');
    expect(resolveAdminLanguage(null, [])).toBe('en');
  });
  it('has the same translation keys and preserves interpolation placeholders', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect((ja as Record<string, string>)[key]?.match(/\{\w+\}/g)?.sort() ?? []).toEqual(key.match(/\{\w+\}/g)?.sort() ?? []);
    }
  });
  it('interpolates values without interpreting user content', () => {
    expect(translate('ja', 'Revision {revision}', { revision: 3 })).toBe('バージョン 3');
    expect(translate('ja', 'Delete “{name}”?', { name: '<b>{revision}</b>' })).toBe('「<b>{revision}</b>」を削除しますか？');
    expect(translate('ja', 'Unexpected server detail')).toBe('Unexpected server detail');
    expect(translate('ja', '__proto__')).toBe('__proto__');
  });
});
