import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import pl from './pl.json'

export const LANGUAGES = ['pl', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'strollway.language'

function isLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value)
}

/** Saved choice first, then the browser language, then Polish. */
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // localStorage can be blocked (private mode); fall back to the browser.
  }
  const browser = navigator.language.slice(0, 2).toLowerCase()
  return isLanguage(browser) ? browser : 'pl'
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Not critical: the choice just will not survive a reload.
  }
}

void i18n.use(initReactI18next).init({
  resources: { pl: { translation: pl }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'pl',
  interpolation: { escapeValue: false }, // React already escapes output.
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n
