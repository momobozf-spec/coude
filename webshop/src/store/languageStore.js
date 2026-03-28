import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations, defaultLanguage } from '../i18n'

const FLAGS = {
  nl: 'NL',
  en: 'EN',
  fr: 'FR',
  de: 'DE',
}

const LABELS = {
  nl: 'NL',
  en: 'EN',
  fr: 'FR',
  de: 'DE',
}

export { FLAGS, LABELS }

export const useLanguageStore = create(
  persist(
    (set, get) => ({
      language: defaultLanguage,
      setLanguage: (lang) => set({ language: lang }),
      t: (key, params = {}) => {
        const { language } = get()
        const keys = key.split('.')

        let value = translations[language]
        for (const currentKey of keys) {
          if (value === undefined) return key
          value = value[currentKey]
        }

        if (typeof value !== 'string') {
          value = translations[defaultLanguage]
          for (const currentKey of keys) {
            if (value === undefined) return key
            value = value[currentKey]
          }
        }

        if (typeof value !== 'string') return key

        return value.replace(
          /\{(\w+)\}/g,
          (_, param) => params[param] ?? `{${param}}`
        )
      },
    }),
    { name: 'jamal-jamila-language' }
  )
)
