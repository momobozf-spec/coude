import 'server-only'

import { serverEnv } from '@/config/env'

/** Wie achter de dienst staat, uit LEGAL_ENTITY_* — nooit hardgecodeerd. */
export function legalIdentity() {
  const env = serverEnv()
  return {
    name: env.LEGAL_ENTITY_NAME || '[naam van de uitbater — LEGAL_ENTITY_NAME]',
    vat: env.LEGAL_ENTITY_VAT,
    address: env.LEGAL_ENTITY_ADDRESS || '[adres — LEGAL_ENTITY_ADDRESS]',
    email: env.LEGAL_CONTACT_EMAIL || '[contactadres — LEGAL_CONTACT_EMAIL]',
    configured: Boolean(env.LEGAL_ENTITY_NAME && env.LEGAL_ENTITY_ADDRESS && env.LEGAL_CONTACT_EMAIL),
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
      </header>
      {children}
    </article>
  )
}
