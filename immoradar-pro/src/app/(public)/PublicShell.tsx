import Link from 'next/link'

/** De schil voor pagina's die zonder inlog leesbaar zijn: privacy, voorwaarden. */
export function PublicShell({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-base font-semibold tracking-tight text-ink-950">
        Lead<span className="text-brand-600">Revive</span>
      </Link>

      <p className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        Concept — laten nalezen door een jurist.
      </p>

      <article className="legal mt-4 rounded-xl border border-ink-200 bg-white p-6 text-sm leading-relaxed text-ink-800 sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-ink-950">{title}</h1>
        {children}
      </article>

      <p className="mt-6 text-xs text-ink-600">
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/voorwaarden" className="hover:underline">
          Voorwaarden
        </Link>
        <span className="mx-2">·</span>
        <Link href="/verwerkersovereenkomst" className="hover:underline">
          Verwerkersovereenkomst
        </Link>
        <span className="mx-2">·</span>
        <Link href="/login" className="hover:underline">
          Inloggen
        </Link>
      </p>
    </main>
  )
}

export function Section({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <section className="mt-6 space-y-2">
      <h2 className="text-base font-semibold text-ink-950">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Naam, ondernemingsnummer en adres van de uitbater. Zolang straat en nummer
 * niet ingevuld zijn (`LEGAL_ENTITY_ADDRESS`), staat enkel de gemeente er.
 */
export function LegalIdentity({
  name,
  vat,
  address,
  municipality,
  email,
}: {
  readonly name: string
  readonly vat: string
  readonly address: string
  readonly municipality?: string
  readonly email: string
}) {
  const location = address || municipality
  return (
    <p>
      {name || 'De uitbater van LeadRevive'}
      {vat && <>, ondernemingsnummer {vat}</>}
      {location && <>, gevestigd te {location}</>}
      {email && (
        <>
          {' '}
          — <a href={`mailto:${email}`} className="text-brand-700 underline">{email}</a>
        </>
      )}
      .
    </p>
  )
}
