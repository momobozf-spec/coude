import 'server-only'

import { serverEnv } from '@/config/env'

/**
 * Wie achter de dienst staat.
 *
 * Uitbater: Marhaba Data & AI Agent BV, ondernemingsnummer BE 1003.552.102,
 * Zaventem, momobozf@gmail.com. Dat zijn de echte gegevens van de BV en de
 * standaardwaarden; LEGAL_ENTITY_* kan ze overschrijven.
 *
 * TODO(Mohamed): LEGAL_ENTITY_ADDRESS = straat, huisnummer en postcode van de
 * maatschappelijke zetel. Dat adres staat bewust niet in de code (niet gekend,
 * niet verzonnen); zonder staat er "Zaventem, België".
 */
export const LEGAL_DEFAULTS = {
  name: 'Marhaba Data & AI Agent BV',
  vat: 'BE 1003.552.102',
  city: 'Zaventem',
  email: 'momobozf@gmail.com',
} as const

export function legalIdentity() {
  const env = serverEnv()
  return {
    name: env.LEGAL_ENTITY_NAME || LEGAL_DEFAULTS.name,
    vat: env.LEGAL_ENTITY_VAT || LEGAL_DEFAULTS.vat,
    address: env.LEGAL_ENTITY_ADDRESS || `${LEGAL_DEFAULTS.city}, België`,
    email: env.LEGAL_CONTACT_EMAIL || LEGAL_DEFAULTS.email,
    /** true zodra ook het volledige adres van de zetel ingevuld is. */
    configured: Boolean(env.LEGAL_ENTITY_ADDRESS),
    googleLogin: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    email_provider: env.EMAIL_PROVIDER,
  }
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">Laatst bijgewerkt: {updated}</p>
        {process.env.LEGAL_TEXTS_REVIEWED === '1' ? null : (
          // Verdwijnt pas met LEGAL_TEXTS_REVIEWED=1, na nalezing door een jurist.
          <p className="mt-3 rounded-md border border-warning/40 bg-warning-subtle p-3 text-xs font-medium">
            Concept — laten nalezen door een jurist.
          </p>
        )}
      </header>
      {children}
    </article>
  )
}
