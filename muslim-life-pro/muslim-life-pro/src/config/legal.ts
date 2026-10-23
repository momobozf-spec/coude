/**
 * The legal entity behind the service, from the environment.
 *
 * Nothing here is invented: an empty value is rendered as absent, and the
 * production start-up check warns about every missing field. EU consumer law
 * (and the GDPR's transparency duty) requires the seller's name, address,
 * enterprise number and a contact address on the site.
 */
export interface LegalEntity {
  name: string | null
  vat: string | null
  address: string | null
  email: string | null
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function legalEntity(env: NodeJS.ProcessEnv = process.env): LegalEntity {
  return {
    name: clean(env['LEGAL_ENTITY_NAME']),
    vat: clean(env['LEGAL_ENTITY_VAT']),
    address: clean(env['LEGAL_ENTITY_ADDRESS']),
    email: clean(env['LEGAL_CONTACT_EMAIL']),
  }
}

/** Version of the privacy notice a member consents to at registration. */
export const PRIVACY_VERSION = '2026-10-05'
