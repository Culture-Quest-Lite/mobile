import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import viTranslation from '@/locales/vi.json';
import enTranslation from '@/locales/en.json';
import { readStoredJson, writeStoredJson } from './persistent-json-storage';

const LANGUAGE_STORAGE_KEY = 'app_language';

async function getStoredLanguage(): Promise<string | null> {
  try {
    return readStoredJson<string | null>(LANGUAGE_STORAGE_KEY, null);
  } catch {
    return null;
  }
}

export async function setStoredLanguage(language: string): Promise<void> {
  writeStoredJson(LANGUAGE_STORAGE_KEY, language);
}

function getDeviceLanguage(): string {
  const locales = getLocales();
  const deviceLanguage = locales[0]?.languageCode;

  // Support vi and en, default to vi
  if (deviceLanguage === 'en') {
    return 'en';
  }
  return 'vi';
}

export async function initI18n() {
  const storedLanguage = await getStoredLanguage();
  const fallbackLanguage = storedLanguage || getDeviceLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        vi: { translation: viTranslation },
        en: { translation: enTranslation },
      },
      lng: fallbackLanguage,
      fallbackLng: 'vi',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });
}

export { i18n };
