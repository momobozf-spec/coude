import { AlertCircle, BadgeCheck, ExternalLink, FileText, HelpCircle } from 'lucide-react'
import type { ShariahAssessmentStatus } from '@prisma/client'

import type { Freshness } from '@/modules/financing/domain/freshness'
import { cn, formatDate } from '@/lib/utils'

/**
 * De shariah-herkomst van een product.
 *
 * ─── DE UI BEDENKT HIER NIETS ────────────────────────────────────────────────
 *
 * Label en formulering komen uit `ASSESSMENT_PRESENTATION` in de domeinlaag.
 * Deze component kiest alleen een icoon en een kleur. Er staat nergens een
 * mapping die "CERTIFIED" naar "halal" vertaalt — dat zou een religieuze claim
 * zijn die het platform niet doet.
 *
 * ─── EEN ONGELDIGE BEOORDELING KRIJGT GEEN BADGE ─────────────────────────────
 *
 * Is `publishable` false — bijvoorbeeld CERTIFIED zonder certificerend orgaan —
 * dan toont de component géén statusbadge maar een melding dat de onderbouwing
 * onvolledig is. Zo kan een sterk signaal niet op het scherm komen zonder dat
 * de gebruiker de herkomst kan controleren.
 */

const ICONS: Record<ShariahAssessmentStatus, typeof BadgeCheck> = {
  CERTIFIED: BadgeCheck,
  PROVIDER_CLAIMED: FileText,
  REVIEWED: FileText,
  UNVERIFIED: AlertCircle,
  UNKNOWN: HelpCircle,
}

const TONES: Record<ShariahAssessmentStatus, string> = {
  CERTIFIED: 'bg-[var(--color-olive-100)] text-[var(--color-olive-700)]',
  PROVIDER_CLAIMED: 'bg-[var(--color-sand-200)] text-[var(--color-ink-800)]',
  REVIEWED: 'bg-[var(--color-sand-200)] text-[var(--color-ink-800)]',
  UNVERIFIED: 'bg-[var(--color-amber-soft)]/40 text-[var(--color-amber-deep)]',
  UNKNOWN: 'border text-[var(--muted)]',
}

export interface AssessmentView {
  status: ShariahAssessmentStatus
  label: string
  statement: string
  certificationBody: string | null
  certificationUrl: string | null
  sourceUrl: string | null
  lastVerifiedAt: Date | null
  disclosure: string[]
  publishable: boolean
  problems: string[]
}

export function ShariahAssessmentBadge({
  assessment,
  className,
}: {
  assessment: AssessmentView
  className?: string
}) {
  if (!assessment.publishable) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-[var(--color-amber-soft)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-amber-deep)]',
          className,
        )}
      >
        <AlertCircle size={13} aria-hidden />
        Onderbouwing onvolledig
      </span>
    )
  }

  const Icon = ICONS[assessment.status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[assessment.status],
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      {/* Het label is tekst, niet alleen een kleur of icoon. */}
      {assessment.label}
    </span>
  )
}

/**
 * "Waarom staat deze status hier?" — de volledige herkomst.
 *
 * Dit blok is het hart van de belofte: de gebruiker ziet wie wat beweert, op
 * grond waarvan, en wanneer dat is nagekeken.
 */
export function ShariahAssessmentDetails({
  assessment,
  freshness,
}: {
  assessment: AssessmentView
  freshness: Freshness
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShariahAssessmentBadge assessment={assessment} />
        <span className="text-xs text-[var(--muted)]">{freshness.label}</span>
      </div>

      {!assessment.publishable && (
        <div
          role="alert"
          className="rounded-xl bg-[var(--color-amber-soft)]/25 px-3 py-2.5 text-sm text-[var(--color-amber-deep)]"
        >
          <p className="font-medium">We tonen deze status niet als feit.</p>
          <ul className="mt-1.5 space-y-0.5">
            {assessment.problems.map((problem) => (
              <li key={problem} className="text-xs leading-relaxed">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="space-y-3 text-sm">
        <Row label="Wat deze status betekent">{assessment.statement}</Row>

        {assessment.certificationBody && (
          <Row label="Vermeld orgaan">{assessment.certificationBody}</Row>
        )}

        {assessment.certificationUrl && (
          <Row label="Certificaat">
            <SourceLink href={assessment.certificationUrl}>Bekijk het certificaat</SourceLink>
          </Row>
        )}

        {assessment.sourceUrl ? (
          <Row label="Bron">
            <SourceLink href={assessment.sourceUrl}>
              Productinformatie van de aanbieder
            </SourceLink>
          </Row>
        ) : (
          <Row label="Bron">Geen bron opgegeven.</Row>
        )}

        <Row label="Laatst gecontroleerd">
          {assessment.lastVerifiedAt ? formatDate(assessment.lastVerifiedAt) : 'Nog niet geverifieerd'}
          <span className="mt-0.5 block text-xs text-[var(--muted)]">{freshness.detail}</span>
        </Row>
      </dl>

      <div className="border-t pt-3">
        {assessment.disclosure.map((line) => (
          <p key={line} className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 leading-relaxed">{children}</dd>
    </div>
  )
}

/** Bronlink met een beschrijvend label, niet "klik hier". */
function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--accent)] underline underline-offset-4"
    >
      {children}
      <ExternalLink size={12} aria-hidden />
      <span className="sr-only">(opent in een nieuw tabblad)</span>
    </a>
  )
}
