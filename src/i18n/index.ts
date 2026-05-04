import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/assets/locales/en/common.json';
import ta from '@/assets/locales/ta/common.json';
import hi from '@/assets/locales/hi/common.json';
import kn from '@/assets/locales/kn/common.json';
import ml from '@/assets/locales/ml/common.json';
import te from '@/assets/locales/te/common.json';

const resources = {
  en: { translation: en },
  ta: { translation: ta },
  hi: { translation: hi },
  kn: { translation: kn },
  ml: { translation: ml },
  te: { translation: te },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
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
