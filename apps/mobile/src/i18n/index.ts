import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ja from './ja.json';

export type Lang = 'en' | 'ja';

/** Device language without a native module: Intl is available on web, Hermes and JSC. */
export function deviceLanguage(): Lang {
  try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ja') ? 'ja' : 'en'; } catch { return 'en'; }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ja: { translation: ja } },
    lng: deviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** Apply the saved account language (from /me); falls back to the device language. */
export function applyLanguage(lang: Lang | null | undefined) {
  const next = lang ?? deviceLanguage();
  if (i18n.language !== next) void i18n.changeLanguage(next);
}

export default i18n;
