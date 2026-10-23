import { appBaseUrl } from '@/config/env'

export const siteConfig = {
  name: 'Barakah',
  tagline: 'Zakat & Sadaqah, met inzicht',
  description:
    'Bereken je Zakat transparant, houd je Sadaqah bij en ontdek goede doelen waarvan je weet waar je geld heen gaat.',
  /** Runtimewaarde, niet de bij de build ingeplakte (zie appBaseUrl). */
  get url(): string {
    return appBaseUrl()
  },
  locale: 'nl-BE',
} as const

/**
 * The disclaimer shown wherever a religious ruling could be inferred. The product
 * explains a calculation; it does not issue fatwa (§2, §35).
 */
export const RELIGIOUS_DISCLAIMER =
  'Barakah rekent volgens de methode die jij instelt en laat elke stap zien. Het is geen vervanging voor religieus advies — raadpleeg bij twijfel een betrouwbare geleerde.'
