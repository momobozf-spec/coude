import type { CharityClaimType } from '@/generated/prisma/client'

/**
 * The transparency factor set and its version (§6, §8).
 *
 * ── What this measures ───────────────────────────────────────────────────────
 * Only whether specific public information **exists and can be checked**. It is
 * not a judgement about impact, ethics, management quality, or religious
 * suitability, and the UI is required to say so wherever the number appears (§7).
 *
 * Every factor below can be answered by pointing at a document. Anything that
 * would need an opinion is deliberately absent.
 *
 * ── Versioning ───────────────────────────────────────────────────────────────
 * `TRANSPARENCY_SCORE_VERSION` changes whenever a weight, a factor or a rule
 * changes. A stored score always records the version that produced it, so an old
 * number stays explainable even after the rules move on (§6).
 */

export const TRANSPARENCY_SCORE_VERSION = 'transparency@1'

export interface TransparencyFactor {
  claimType: CharityClaimType
  label: string
  /** Relative weight within the factor set. */
  weight: number
  /**
   * How long evidence stays fresh, in months. A 2022 annual report is not the
   * same evidence in 2026, and the score has to show that (§10).
   */
  freshnessMonths: number
  /** Shown next to the factor so a user can see what was actually checked. */
  description: string
}

export const TRANSPARENCY_FACTORS: readonly TransparencyFactor[] = [
  {
    claimType: 'REGISTERED_ENTITY',
    label: 'Geregistreerde organisatie',
    weight: 20,
    // Registration does not go stale the way a yearly document does.
    freshnessMonths: 60,
    description: 'De organisatie staat ingeschreven in een officieel register.',
  },
  {
    claimType: 'ANNUAL_REPORT_PUBLISHED',
    label: 'Jaarverslag gepubliceerd',
    weight: 15,
    freshnessMonths: 24,
    description: 'Er is een jaarverslag beschikbaar.',
  },
  {
    claimType: 'FINANCIAL_STATEMENTS_PUBLISHED',
    label: 'Financiële cijfers gepubliceerd',
    weight: 15,
    freshnessMonths: 24,
    description: 'Er zijn financiële overzichten beschikbaar.',
  },
  {
    claimType: 'AUDITOR_DISCLOSED',
    label: 'Accountant bekendgemaakt',
    weight: 10,
    freshnessMonths: 24,
    description: 'De organisatie maakt bekend wie de cijfers controleert.',
  },
  {
    claimType: 'GOVERNANCE_DISCLOSED',
    label: 'Bestuur bekendgemaakt',
    weight: 10,
    freshnessMonths: 36,
    description: 'Wie de organisatie bestuurt, is openbaar.',
  },
  {
    claimType: 'ADMIN_COST_DISCLOSED',
    label: 'Beheerskosten gepubliceerd',
    weight: 10,
    freshnessMonths: 24,
    description: 'De organisatie publiceert welk deel aan beheer opgaat.',
  },
  {
    claimType: 'IMPACT_REPORT_PUBLISHED',
    label: 'Resultatenrapportage',
    weight: 5,
    freshnessMonths: 24,
    // Note the wording: that a report exists, not that the impact was good.
    description: 'Er is een rapportage over uitgevoerde projecten beschikbaar.',
  },
  {
    claimType: 'CONTACT_DETAILS_PUBLISHED',
    label: 'Contactgegevens gepubliceerd',
    weight: 5,
    freshnessMonths: 36,
    description: 'De organisatie is bereikbaar via gepubliceerde contactgegevens.',
  },
  {
    claimType: 'ZAKAT_POLICY_PUBLISHED',
    label: 'Zakat-beleid gepubliceerd',
    weight: 5,
    freshnessMonths: 36,
    description: 'Er is een gepubliceerd beleid over hoe Zakat wordt behandeld.',
  },
  {
    claimType: 'ZAKAT_ALLOCATION_DESCRIBED',
    label: 'Zakat-besteding beschreven',
    weight: 5,
    freshnessMonths: 36,
    description: 'De organisatie beschrijft waar Zakat-middelen naartoe gaan.',
  },
] as const

export const TOTAL_FACTOR_WEIGHT = TRANSPARENCY_FACTORS.reduce((sum, f) => sum + f.weight, 0)

const BY_TYPE = new Map(TRANSPARENCY_FACTORS.map((f) => [f.claimType, f]))

export function factorFor(claimType: CharityClaimType): TransparencyFactor | undefined {
  return BY_TYPE.get(claimType)
}

/**
 * Below this share of known factors, a score is technically computable but not
 * meaningful — 100% over two known factors says almost nothing. The result
 * carries the flag and the UI leads with the coverage instead (§9).
 */
export const MINIMUM_MEANINGFUL_COVERAGE = 40

/**
 * The public explanation of what the score is, shown wherever it appears (§7).
 * Deliberately states the limits before anything else.
 */
export const TRANSPARENCY_DISCLAIMER =
  'Deze score beoordeelt uitsluitend of bepaalde openbare informatie beschikbaar en ' +
  'controleerbaar is. Het is geen oordeel over de kwaliteit, de impact of de ' +
  'islamitische geschiktheid van een organisatie, en geen aanbeveling.'
