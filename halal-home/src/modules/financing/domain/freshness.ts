/**
 * Hoe actueel is deze financieringsinformatie?
 *
 * Financieringsproducten wijzigen: marges, kosten, voorwaarden. Een pagina die
 * gegevens toont zonder te zeggen wanneer ze voor het laatst zijn nagekeken,
 * suggereert actualiteit die er niet is.
 *
 * ─── STALE IS GEEN FOUT ──────────────────────────────────────────────────────
 *
 * `STALE` betekent "dit is een tijd geleden nagekeken", niet "dit klopt niet".
 * De UI hoort het als context te tonen, niet als waarschuwing in rood. Wat wél
 * een duidelijk signaal verdient is `UNVERIFIED`: dan is er nooit iemand langs
 * geweest.
 */

export type FreshnessState = 'CURRENT' | 'STALE' | 'UNVERIFIED'

/**
 * Vanaf hoeveel dagen geldt informatie als verouderd.
 *
 * Een jaar is een redactionele keuze, geen wettelijke norm. Configureerbaar,
 * omdat een productblad een andere houdbaarheid heeft dan een fiscaal tarief.
 */
export const DEFAULT_STALE_AFTER_DAYS = 365

export interface Freshness {
  state: FreshnessState
  /** Wat de UI toont. Nooit alleen een kleur. */
  label: string
  /** Eén zin uitleg. */
  detail: string
  lastVerifiedAt: Date | null
  ageInDays: number | null
}

export function getFinancingFreshness(
  lastVerifiedAt: Date | null | undefined,
  options: { now?: Date; staleAfterDays?: number } = {},
): Freshness {
  const now = options.now ?? new Date()
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS

  if (!lastVerifiedAt) {
    return {
      state: 'UNVERIFIED',
      label: 'Nog niet geverifieerd',
      detail:
        'Deze gegevens zijn nog niet nagekeken bij de bron. Controleer ze bij de aanbieder voordat je erop rekent.',
      lastVerifiedAt: null,
      ageInDays: null,
    }
  }

  const ageInDays = Math.floor((now.getTime() - lastVerifiedAt.getTime()) / 86_400_000)
  const formatted = new Intl.DateTimeFormat('nl-BE', { dateStyle: 'long' }).format(lastVerifiedAt)

  if (ageInDays > staleAfterDays) {
    return {
      state: 'STALE',
      label: `Nagekeken op ${formatted}`,
      detail: `Dat is meer dan ${Math.round(staleAfterDays / 365)} jaar geleden. Voorwaarden kunnen intussen gewijzigd zijn.`,
      lastVerifiedAt,
      ageInDays,
    }
  }

  return {
    state: 'CURRENT',
    label: `Nagekeken op ${formatted}`,
    detail: 'Gecontroleerd bij de bron van de aanbieder.',
    lastVerifiedAt,
    ageInDays,
  }
}
