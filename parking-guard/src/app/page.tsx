import { explainDecision } from '@/domain/municipality/submission-policy'
import { listMunicipalities } from '@/server/municipalities'

/**
 * Fase 0-pagina: de registry, eerlijk weergegeven.
 *
 * Dit is geen marketingpagina en geen mock. Hij leest de echte registry en toont
 * per gemeente wat wij vandaag werkelijk kunnen — inclusief de gemeenten waar
 * het antwoord "nog niets" is. De wizard komt in fase 3; tot die tijd is dit de
 * eerlijkste pagina die er kan staan.
 */
export const dynamic = 'force-dynamic'

function euro(cents: number | null): string {
  if (cents === null) return '—'
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`
}

export default async function HomePage() {
  const municipalities = await listMunicipalities()

  const weSubmit = municipalities.filter((m) => m.decision.kind === 'SEND_BY_US')
  const verified = municipalities.filter((m) => m.verificationStatus === 'VERIFIED')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600">Parking Guard Brussel</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Bewonerskaart — dekking per gemeente
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Deze pagina toont de stand van de gemeente-registry. Hij is opgebouwd uit officiële
          bronnen; wat niet gestaafd kon worden, staat leeg in plaats van ingevuld.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-2xl font-bold">{municipalities.length}</div>
          <div className="text-xs text-slate-500">gemeenten</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-2xl font-bold">{verified.length}</div>
          <div className="text-xs text-slate-500">geverifieerd</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-2xl font-bold">{weSubmit.length}</div>
          <div className="text-xs text-slate-500">wij dienen in</div>
        </div>
      </section>

      {weSubmit.length < verified.length && (
        <p className="mb-8 rounded-lg border border-warn-600/30 bg-warn-100/50 p-4 text-sm dark:bg-warn-600/10">
          Bij de meeste Brusselse gemeenten kunnen wij <strong>niet</strong> namens jou indienen.
          parking.brussels sloot zijn e-mailkanaal in maart 2026, en Brussel-Stad vraagt je eigen
          eID met pincode. Daar stellen wij je dossier compleet samen en dien je het zelf in.
        </p>
      )}

      <ul className="space-y-3">
        {municipalities.map((municipality) => {
          const canSubmit = municipality.decision.kind === 'SEND_BY_US'

          return (
            <li
              key={municipality.id}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {municipality.nameNl}
                  {municipality.nameFr !== municipality.nameNl && (
                    <span className="font-normal text-slate-500"> / {municipality.nameFr}</span>
                  )}
                </h2>
                <span className="text-xs text-slate-500">
                  {municipality.postcodes.join(', ')}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={
                    canSubmit
                      ? 'rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }
                >
                  {canSubmit ? 'Wij dienen in' : 'Jij dient zelf in'}
                </span>
                <span className="text-slate-500">
                  {municipality.cardManager === 'PARKING_BRUSSELS'
                    ? 'via parking.brussels'
                    : 'gemeente zelf'}
                </span>
                {municipality.firstCardPriceCents !== null && (
                  <span className="text-slate-500">
                    1e kaart {euro(municipality.firstCardPriceCents)}/jaar
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {explainDecision(municipality.decision, 'NL')}
              </p>

              {municipality.verificationNote && (
                <p className="mt-2 text-xs text-slate-500">
                  Nog niet volledig geverifieerd: {municipality.verificationNote}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800">
        <p>
          Bronnen en raadpleegdata staan in <code>docs/gemeenten.md</code>. Gegevens ouder dan zes
          maanden worden automatisch als verouderd gemarkeerd en opnieuw nagekeken.
        </p>
      </footer>
    </main>
  )
}
