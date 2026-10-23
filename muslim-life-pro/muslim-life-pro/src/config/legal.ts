/**
 * The legal entity behind the service.
 *
 * Operator: Marhaba Data & AI Agent BV, enterprise number BE 1003.552.102,
 * Zaventem (Belgium), contact momobozf@gmail.com. These are the BV's real
 * details and serve as defaults; every value can be overridden from the
 * environment. EU consumer law and the GDPR's transparency duty require the
 * operator's name, geographic address, enterprise number and a contact address.
 *
 * TODO(Mohamed): set LEGAL_ENTITY_ADDRESS to the street, number and postcode
 * of the registered office. It is deliberately not in the code: it is not known
 * here and is never invented. Without it the pages show "Zaventem, Belgium".
 */
export const LEGAL_DEFAULTS = {
  name: 'Marhaba Data & AI Agent BV',
  vat: 'BE 1003.552.102',
  city: 'Zaventem',
  email: 'momobozf@gmail.com',
} as const

export interface LegalEntity {
  name: string
  vat: string
  /** Full registered-office address from LEGAL_ENTITY_ADDRESS, or null while not configured. */
  address: string | null
  /** What the pages show: the full address, or at least the municipality. */
  displayAddress: string
  email: string
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function legalEntity(env: NodeJS.ProcessEnv = process.env): LegalEntity {
  const address = clean(env['LEGAL_ENTITY_ADDRESS'])
  return {
    name: clean(env['LEGAL_ENTITY_NAME']) ?? LEGAL_DEFAULTS.name,
    vat: clean(env['LEGAL_ENTITY_VAT']) ?? LEGAL_DEFAULTS.vat,
    address,
    displayAddress: address ?? `${LEGAL_DEFAULTS.city}, Belgium`,
    email: clean(env['LEGAL_CONTACT_EMAIL']) ?? LEGAL_DEFAULTS.email,
  }
}

/** Legal texts carry a "draft — have a lawyer review" notice until LEGAL_TEXTS_REVIEWED=1. */
export function legalTextsReviewed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['LEGAL_TEXTS_REVIEWED'] === '1'
}

/** Version of the privacy notice a member consents to at registration. */
export const PRIVACY_VERSION = '2026-10-05'
