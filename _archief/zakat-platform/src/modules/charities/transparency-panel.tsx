import { AlertTriangle, CircleHelp, Info } from 'lucide-react'

import { Badge, Card, CardContent } from '@/components/ui'
import { SOURCE_TYPE_LABELS, tierOf } from '@/config/charity-sources'
import { TRANSPARENCY_DISCLAIMER } from '@/server/modules/charities/transparency/factors'
import { FRESHNESS_LABELS } from '@/server/modules/charities/transparency/freshness'
import type { TransparencyScoreResult } from '@/server/modules/charities/transparency/score'
import type { ClaimView } from '@/server/modules/charities/detail-service'
import { formatDate } from '@/lib/dates'

/**
 * Score explanation and per-claim evidence (§6, §7, §12, §30).
 *
 * The number never appears without the disclaimer and the coverage figure next
 * to it, and every factor line states what was checked and why it earned what it
 * earned. Status is carried by text and icon, never by colour alone.
 */

export function TransparencyPanel({ result }: { result: TransparencyScoreResult }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div>
          <h2 className="text-sm font-semibold">Transparantiescore</h2>
          <p className="mt-1 text-xs text-muted">{TRANSPARENCY_DISCLAIMER}</p>
        </div>

        {result.score === null ? (
          <p className="text-sm">
            Nog geen score: er is voor deze organisatie nog geen enkele factor onderzocht.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="tabular text-3xl font-semibold">{result.score}/100</p>
              <p className="text-sm text-muted">
                op basis van {result.coverage}% van de factoren
              </p>
            </div>

            {!result.hasSufficientCoverage ? (
              <p className="flex items-start gap-2 rounded-lg bg-warning-subtle/50 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Er is te weinig onderzocht om deze score betekenisvol te maken. Lees hem
                  samen met de dekking hierboven.
                </span>
              </p>
            ) : null}
          </>
        )}

        <div>
          <h3 className="text-sm font-semibold">Hoe is dit opgebouwd?</h3>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {result.components.map((component) => (
              <li key={component.claimType} className="flex flex-col gap-1 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <ComponentIcon assessed={component.assessed} earned={component.earned} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{component.label}</p>
                      {component.description ? (
                        <p className="text-xs text-muted">{component.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <span className="tabular shrink-0 text-sm text-muted">
                    {component.assessed
                      ? `${component.earned} / ${component.weight}`
                      : 'niet meegeteld'}
                  </span>
                </div>

                <p className="pl-6 text-xs text-muted">{component.reason}</p>

                {component.sourceType ? (
                  <p className="pl-6 text-xs text-muted">
                    {SOURCE_TYPE_LABELS[component.sourceType]} ·{' '}
                    {tierOf(component.sourceType).label} ·{' '}
                    {FRESHNESS_LABELS[component.freshness]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {result.warnings.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">Aandachtspunten</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {result.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 text-xs text-muted">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="border-t border-border pt-3 text-xs text-muted">
          Berekend met versie {result.version} op {formatDate(result.calculatedAt)}. Dezelfde
          gegevens leveren altijd exact dezelfde score op.
        </p>
      </CardContent>
    </Card>
  )
}

function ComponentIcon({ assessed, earned }: { assessed: boolean; earned: number }) {
  if (!assessed) {
    return <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted" aria-label="Niet onderzocht" />
  }
  if (earned > 0) {
    return <Info className="mt-0.5 size-4 shrink-0 text-success" aria-label="Meegeteld" />
  }
  return (
    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Geen punten" />
  )
}

/**
 * The per-claim evidence table — the "why do we show this?" section (§12).
 */
export function ClaimEvidence({ claims }: { claims: readonly ClaimView[] }) {
  if (claims.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-5 text-sm text-muted">
          Er zijn nog geen onderzochte claims voor deze organisatie. Dat betekent niet dat de
          informatie ontbreekt bij de organisatie zelf — alleen dat wij het niet hebben
          gecontroleerd.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div>
          <h2 className="text-sm font-semibold">Waarom zien we deze informatie?</h2>
          <p className="mt-1 text-xs text-muted">
            Elke uitspraak hieronder heeft een eigen bron. Een bron bewijst alleen de claim
            waar hij bij staat, niet de hele organisatie.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {claims.map((claim) => (
            <li key={claim.type} className="flex flex-col gap-1.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{claim.label}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={valueTone(claim.value)}>{VALUE_LABELS[claim.value]}</Badge>
                  <Badge tone="neutral">{STATUS_LABELS[claim.status]}</Badge>
                </div>
              </div>

              {claim.valueText ? (
                <p className="text-xs text-muted">{claim.valueText}</p>
              ) : null}
              {claim.note ? <p className="text-xs text-muted">{claim.note}</p> : null}

              {claim.source ? (
                <div className="flex flex-col gap-0.5 text-xs text-muted">
                  <span>
                    Bron:{' '}
                    <a
                      href={claim.source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-medium text-primary underline"
                    >
                      {claim.source.title}
                    </a>{' '}
                    ({SOURCE_TYPE_LABELS[claim.source.sourceType]})
                  </span>
                  {claim.source.publisher ? <span>Uitgever: {claim.source.publisher}</span> : null}
                  {claim.source.publishedAt ? (
                    <span>Gepubliceerd: {formatDate(claim.source.publishedAt)}</span>
                  ) : null}
                  {claim.source.retrievedAt ? (
                    <span>Geraadpleegd: {formatDate(claim.source.retrievedAt)}</span>
                  ) : null}
                  <span>
                    Actualiteit: {FRESHNESS_LABELS[claim.freshness]} — {claim.freshnessReason}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Geen bron beschikbaar. Deze uitspraak is niet gecontroleerd.
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const VALUE_LABELS: Record<string, string> = {
  YES: 'Ja',
  NO: 'Nee',
  UNKNOWN: 'Onbekend',
}

const STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Gecontroleerd tegen bron',
  SELF_REPORTED: 'Door organisatie opgegeven',
  UNVERIFIED: 'Niet gecontroleerd',
  DISPUTED: 'Betwist',
}

function valueTone(value: string): 'success' | 'neutral' | 'warning' {
  if (value === 'YES') return 'success'
  if (value === 'NO') return 'warning'
  return 'neutral'
}
