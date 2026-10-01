import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAdminLanguage, languageStorageKey, resolveAdminLanguage, translate, type AdminLanguage, type MessageValues } from './language';

const LanguageContext = createContext<{
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
  t: (text: string, values?: MessageValues) => string;
} | null>(null);

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<AdminLanguage>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(languageStorageKey); } catch { /* Browser preferences are optional. */ }
    return resolveAdminLanguage(saved, navigator.languages.length ? navigator.languages : [navigator.language]);
  });
  const setLanguage = useCallback((next: AdminLanguage) => {
    if (!isAdminLanguage(next)) return;
    updateLanguage(next);
    try { localStorage.setItem(languageStorageKey, next); } catch { /* Switching still works without storage. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string, values?: MessageValues) => translate(language, text, values) }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAdminI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('AdminLanguageProvider is missing.');
  return context;
}
