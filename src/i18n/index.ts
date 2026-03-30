import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import he from './locales/he.json';
import ko from './locales/ko.json';
import it from './locales/it.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import ur from './locales/ur.json';
import tr from './locales/tr.json';
import ja from './locales/ja.json';
import bn from './locales/bn.json';
import ru from './locales/ru.json';
import id from './locales/id.json';
import mr from './locales/mr.json';
import te from './locales/te.json';
import ta from './locales/ta.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  ar: { translation: ar },
  he: { translation: he },
  ko: { translation: ko },
  it: { translation: it },
  zh: { translation: zh },
  hi: { translation: hi },
  ur: { translation: ur },
  tr: { translation: tr },
  ja: { translation: ja },
  bn: { translation: bn },
  ru: { translation: ru },
  id: { translation: id },
  mr: { translation: mr },
  te: { translation: te },
  ta: { translation: ta },
};

// RTL languages
const rtlLanguages = ['ar', 'he', 'ur'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'flowist_language',
    },
    supportedLngs: ['en', 'es', 'fr', 'de', 'pt', 'ar', 'he', 'ko', 'it', 'zh', 'hi', 'ur', 'tr', 'ja', 'bn', 'ru', 'id', 'mr', 'te', 'ta'],
    interpolation: {
      escapeValue: false,
    },
  });

// Update document direction when language changes
i18n.on('languageChanged', (lng) => {
  const isRtl = rtlLanguages.includes(lng);
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

// Set initial direction
const isRtl = rtlLanguages.includes(i18n.language);
document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
document.documentElement.lang = i18n.language;

export default i18n;

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
];

export const isRtlLanguage = (langCode: string) => rtlLanguages.includes(langCode);
