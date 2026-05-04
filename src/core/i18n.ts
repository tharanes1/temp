import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: require('@/assets/locales/en/common.json') },
    ta: { translation: require('@/assets/locales/ta/common.json') },
    hi: { translation: require('@/assets/locales/hi/common.json') },
    kn: { translation: require('@/assets/locales/kn/common.json') },
    ml: { translation: require('@/assets/locales/ml/common.json') },
    te: { translation: require('@/assets/locales/te/common.json') }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
