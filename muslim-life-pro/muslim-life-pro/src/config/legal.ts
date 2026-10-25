/**
 * The legal entity behind the service.
 *
 * Operator: Marhaba Cooperation BV, enterprise number BE 1037.222.285,
 * registered office Sweetstraat 13, 3870 Heers (Belgium), contact
 * momobozf@gmail.com. These are the BV's real details (the address comes from
 * the KBO/BCE register, public data) and serve as defaults; every value can be
 * overridden from the environment. EU consumer law and the GDPR's transparency
 * duty require the operator's name, geographic address, enterprise number and a
 * contact address.
 */
export const LEGAL_DEFAULTS = {
  name: 'Marhaba Cooperation BV',
  vat: 'BE 1037.222.285',
  address: 'Sweetstraat 13, 3870 Heers',
  city: 'Heers',
  email: 'momobozf@gmail.com',
} as const

export interface LegalEntity {
  name: string
  vat: string
  /** Full registered-office address from LEGAL_ENTITY_ADDRESS, else the one from the KBO register. */
  address: string
  /** What the pages show: the full registered-office address. */
  displayAddress: string
  email: string
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function legalEntity(env: NodeJS.ProcessEnv = process.env): LegalEntity {
  const address = clean(env['LEGAL_ENTITY_ADDRESS']) ?? LEGAL_DEFAULTS.address
  return {
    name: clean(env['LEGAL_ENTITY_NAME']) ?? LEGAL_DEFAULTS.name,
    vat: clean(env['LEGAL_ENTITY_VAT']) ?? LEGAL_DEFAULTS.vat,
    address,
    displayAddress: address,
    email: clean(env['LEGAL_CONTACT_EMAIL']) ?? LEGAL_DEFAULTS.email,
  }
}

/** Legal texts carry a "draft — have a lawyer review" notice until LEGAL_TEXTS_REVIEWED=1. */
export function legalTextsReviewed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['LEGAL_TEXTS_REVIEWED'] === '1'
}

/** Version of the privacy notice a member consents to at registration. */
export const PRIVACY_VERSION = '2026-10-05'
