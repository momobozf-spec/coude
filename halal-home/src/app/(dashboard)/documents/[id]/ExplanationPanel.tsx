'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  BookOpen,
  FileSearch,
  HelpCircle,
  Info,
  Lightbulb,
  Scale,
  Shield,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { requestExplanationAction } from '@/modules/documents/actions'
import { formatDate } from '@/lib/utils'

export interface ExplanationView {
  summary: string
  keyPoints: string[]
  attentionPoints: string[]
  questionsForProfessional: string[]
  disclaimer: string
  source: string
  createdAt: string
  outdated?: boolean
  outdatedNotice?: string
}

/**
 * De uitleg bij een document.
 *
 * ─── DE DISCLAIMER STAAT BOVENAAN, NIET ONDERAAN ─────────────────────────────
 *
 * Bewust vóór de inhoud. Een voorbehoud in kleine letters onder een scherm vol
 * uitleg leest niemand, en dan heeft het geen functie behalve juridische
 * dekking voor ons. Wie hier komt met zijn compromis moet éérst weten dat dit
 * geen juridisch oordeel is.
 *
 * De tekst komt uit `EXPLANATION_DISCLAIMER` in de domeinlaag en is een
 * verplicht veld op het resultaat — deze component kan hem niet weglaten.
 *
 * ─── EN DAARONDER: WAAR DE UITLEG ÓP GEBASEERD IS ────────────────────────────
 *
 * Er is nog geen tekstextractie. Geen enkele provider leest de inhoud van het
 * bestand; ze krijgen de categorie en wat metadata, verder niets. De uitleg
 * gaat dus over wat dit sóórt document doorgaans inhoudt, niet over wat er in
 * dít contract staat.
 *
 * Dat verschil moet de gebruiker vóóraf lezen, niet in een voetnoot achteraf.
 * Iemand die "waar mensen doorgaans op letten" aanziet voor "wat er in jouw
 * compromis staat", tekent op basis van een uitleg die zijn document nooit
 * gezien heeft. Daarom staat het hier onvoorwaardelijk — niet afhankelijk van
 * welke provider antwoordde, want geen van beide leest het bestand.
 *
 * Zodra er wél extractie is, hoort deze tekst mee te veranderen; zie
 * `describeDataSentToProvider` en `src/server/integrations/documentExplanation`.
 */
export function ExplanationPanel({
  documentId,
  categoryLabel,
  canExplain,
  dataSentToProvider,
  initial,
  previousCount,
}: {
  documentId: string
  /** Het label van de gekozen categorie, bv. "Verkoopovereenkomst". */
  categoryLabel: string
  canExplain: boolean
  dataSentToProvider: string[]
  initial: ExplanationView | null
  previousCount: number
}) {
  const [explanation, setExplanation] = useState<ExplanationView | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await requestExplanationAction({ documentId })

      if (!result.ok || !result.data) {
        setError(result.error ?? 'De uitleg kon niet gemaakt worden.')
        return
      }
      setExplanation({ ...result.data, outdated: false })
    })
  }

  return (
    <Card>
      <CardHeader
        title="Uitleg bij dit document"
        description="In gewone taal, met vragen die je aan je notaris kan stellen."
      />

      {/* Het voorbehoud, altijd zichtbaar — ook vóór er uitleg is. */}
      <div className="mb-4 rounded-xl border border-[var(--color-amber-deep)]/25 bg-[var(--color-amber-soft)]/15 px-4 py-3">
        <p className="flex gap-2 text-sm font-medium text-[var(--color-amber-deep)]">
          <Scale size={15} className="mt-0.5 shrink-0" aria-hidden />
          Uitleg, geen juridisch advies
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          {explanation?.disclaimer ??
            'Halal Home legt uit wat een document doorgaans inhoudt. Wij beoordelen niet of het ' +
              'juridisch in orde is en vervangen je notaris of advocaat niet.'}
        </p>
      </div>

      {/* Onvoorwaardelijk en vóór de uitleg: waar hij op gebaseerd is. Zie de
          kop van dit bestand. */}
      <div className="mb-4 rounded-xl border border-[var(--color-sand-300)] bg-[var(--color-sand-100)] px-4 py-3">
        <p className="flex gap-2 text-sm font-medium">
          <FileSearch size={15} className="mt-0.5 shrink-0" aria-hidden />
          Gebaseerd op de documentsoort, niet op je bestand
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          We lezen de inhoud van je bestand niet. Deze uitleg gaat over wat een{' '}
          <span className="font-medium">{categoryLabel.toLowerCase()}</span> doorgaans inhoudt, op
          basis van de categorie die je koos en de gegevens eromheen. Wat er precies in jouw
          document staat — bedragen, termijnen, voorwaarden — hebben wij niet gezien. Lees je
          document zelf, en leg het voor aan je notaris.
        </p>
      </div>

      {explanation ? (
        <div className="space-y-5">
          {explanation.outdated && explanation.outdatedNotice && (
            <p
              role="status"
              className="rounded-xl bg-[var(--color-sand-100)] px-3 py-2.5 text-sm text-[var(--muted)]"
            >
              {explanation.outdatedNotice}
            </p>
          )}

          <Section icon={<BookOpen size={15} aria-hidden />} title="Samenvatting">
            <p className="text-sm leading-relaxed">{explanation.summary}</p>
          </Section>

          {explanation.keyPoints.length > 0 && (
            <Section icon={<Lightbulb size={15} aria-hidden />} title="Belangrijkste punten">
              <ul className="space-y-1.5">
                {explanation.keyPoints.map((point) => (
                  <li key={point} className="text-sm leading-relaxed">
                    — {point}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {explanation.attentionPoints.length > 0 && (
            <Section
              icon={<AlertTriangle size={15} aria-hidden />}
              title="Waar mensen doorgaans op letten"
            >
              <ul className="space-y-1.5">
                {explanation.attentionPoints.map((point) => (
                  <li key={point} className="text-sm leading-relaxed">
                    — {point}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {explanation.questionsForProfessional.length > 0 && (
            <Section
              icon={<HelpCircle size={15} aria-hidden />}
              title="Vragen voor je notaris of advocaat"
            >
              {/* Dit is het moment waarop we naar de professional verwijzen in
                  plaats van zelf antwoord te geven. */}
              <ul className="space-y-1.5">
                {explanation.questionsForProfessional.map((question) => (
                  <li key={question} className="text-sm leading-relaxed">
                    — {question}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="border-t pt-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
              <Shield size={12} aria-hidden />
              {explanation.source === 'FIXTURE'
                ? 'Vaste uitleg per documentsoort, geschreven en nagelezen door een mens. Deze tekst is niet gebaseerd op de inhoud van jouw bestand.'
                : 'Gegenereerd door een taalmodel op basis van de aangeleverde gegevens.'}
              <span>· {formatDate(explanation.createdAt)}</span>
            </p>

            {previousCount > 0 && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Er {previousCount === 1 ? 'is' : 'zijn'} {previousCount} eerdere{' '}
                {previousCount === 1 ? 'uitleg' : 'uitleggen'} bewaard. Nieuwe uitleg vervangt de
                oude nooit.
              </p>
            )}
          </div>

          {canExplain && (
            <Button type="button" variant="secondary" onClick={generate} disabled={pending}>
              {pending ? 'Bezig…' : 'Opnieuw uitleggen'}
            </Button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            We kunnen uitleggen waarvoor dit soort document dient, waar mensen op letten, en welke
            vragen zinnig zijn voor je notaris.
          </p>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-[var(--muted)] underline-offset-4 hover:underline">
              Wat wordt er precies verstuurd?
            </summary>
            {/* Transparant over de gegevensstroom, vóór de gebruiker klikt. */}
            <ul className="mt-2 space-y-1 border-l-2 border-[var(--color-sand-300)] pl-3">
              {dataSentToProvider.map((line) => (
                <li key={line} className="text-xs leading-relaxed text-[var(--muted)]">
                  {line}
                </li>
              ))}
            </ul>
          </details>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
            >
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={generate}
            disabled={pending || !canExplain}
            className="mt-4"
          >
            <Info size={15} aria-hidden />
            {pending ? 'Bezig…' : 'Leg dit document uit'}
          </Button>

          {!canExplain && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Dit document is niet beschikbaar, dus we kunnen er geen uitleg bij geven.
            </p>
          )}

          <p aria-live="polite" className="sr-only">
            {pending ? 'Bezig met uitleg maken' : ''}
          </p>
        </div>
      )}
    </Card>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}
