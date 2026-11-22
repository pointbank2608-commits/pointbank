import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import ko from './locales/ko';
import { lessonUxKo, lessonUxEn } from './lessonUxLocales';
import { textbookKo, textbookEn } from './textbookLocales';
import { parentPortalKo, parentPortalEn } from './parentPortalLocales';
import { aiMaterialsKo, aiMaterialsEn } from './aiMaterialsLocales';
import { lessonPptKo, lessonPptEn } from './lessonPptLocales';
import { animationSoloKo, animationSoloEn } from './animationSoloLocales';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: { ...ko, animationSolo: animationSoloKo, lessonUx: lessonUxKo, textbook: textbookKo, aiMaterials: aiMaterialsKo, lessonPpt: lessonPptKo, parentPortal: parentPortalKo } },
      en: { translation: { ...en, animationSolo: animationSoloEn, lessonUx: lessonUxEn, textbook: textbookEn, aiMaterials: aiMaterialsEn, lessonPpt: lessonPptEn, parentPortal: parentPortalEn } },
    },
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en'],
    interpolation: {
      escapeValue: false, // React 가 이미 XSS 를 막아줘서 이중 이스케이프 불필요
    },
    detection: {
      // localStorage 에 저장된 선택을 최우선으로, 없으면 브라우저 언어를 본다.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'classbank.lang',
    },
  });

export default i18n;
