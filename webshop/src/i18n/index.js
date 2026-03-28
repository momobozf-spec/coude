import nl from './translations/nl'
import fr from './translations/fr'
import de from './translations/de'
import en from './translations/en'

export const translations = { nl, fr, de, en }
export const defaultLanguage = 'nl'
export const supportedLanguages = ['nl', 'fr', 'de', 'en']

// Helper to get nested translation value by dot-separated key
export function getTranslation(lang, key) {
  const keys = key.split('.')
  let value = translations[lang]
  for (const k of keys) {
    if (value === undefined) return key
    value = value[k]
  }
  return value || translations[defaultLanguage] // fallback
}
