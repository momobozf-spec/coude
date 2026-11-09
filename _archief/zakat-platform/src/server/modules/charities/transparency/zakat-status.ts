import { isIndependent } from '@/config/charity-sources'
import type { ScoredClaim } from '@/server/modules/charities/transparency/score'

/**
 * Zakat status labelling (§11, §26).
 *
 * This is the most dangerous label in the product. "Accepteert Zakat" on a
 * charity's own website is a statement by that charity about itself. Presenting
 * it as though the platform had validated the organisation as a religiously
 * sound Zakat destination would be a claim we have no basis for, about a
 * religious obligation — so the ladder below never collapses into a checkmark.
 *
 * Each level states exactly what is known, and no level is reachable without the
 * evidence that defines it.
 */

export type ZakatStatus =
  /** Nothing recorded either way. */
  | 'UNKNOWN'
  /** Somebody checked and the charity does not accept Zakat. */
  | 'DOES_NOT_ACCEPT'
  /** The charity says it accepts Zakat. Its own word. */
  | 'SELF_DECLARED'
  /** …and it has published a policy describing how Zakat is handled. */
  | 'POLICY_PUBLISHED'
  /** …and that policy describes where the funds actually go. */
  | 'ALLOCATION_DESCRIBED'
  /** An independent source confirms Zakat eligibility. */
  | 'INDEPENDENTLY_VERIFIED'

export interface ZakatStatusResult {
  status: ZakatStatus
  label: string
  /** Spelled out so the badge is never read as more than it is. */
  explanation: string
  /** Which claims produced this, for the sources section. */
  basedOn: string[]
}

const LEVELS: Record<ZakatStatus, { label: string; explanation: string }> = {
  UNKNOWN: {
    label: 'Onbekend',
    explanation:
      'We hebben geen bron over het Zakat-beleid van deze organisatie. Onbekend betekent ' +
      'niet dat de organisatie geen Zakat accepteert — alleen dat wij het niet weten.',
  },
  DOES_NOT_ACCEPT: {
    label: 'Accepteert geen Zakat',
    explanation: 'Volgens de geraadpleegde bron accepteert deze organisatie geen Zakat.',
  },
  SELF_DECLARED: {
    label: 'Zegt Zakat te accepteren',
    explanation:
      'De organisatie geeft zelf aan Zakat te accepteren. Dat is niet onafhankelijk ' +
      'gecontroleerd en is geen religieuze goedkeuring van deze bestemming.',
  },
  POLICY_PUBLISHED: {
    label: 'Zakat-beleid gepubliceerd',
    explanation:
      'De organisatie heeft een beleid gepubliceerd over hoe zij Zakat behandelt. Wij hebben ' +
      'vastgesteld dát dit beleid bestaat, niet dat het religieus juist is.',
  },
  ALLOCATION_DESCRIBED: {
    label: 'Zakat-besteding beschreven',
    explanation:
      'De organisatie beschrijft welke programma’s uit Zakat worden betaald. Beoordeel zelf, ' +
      'of met een geleerde, of dat aansluit bij de categorieën die voor jou gelden.',
  },
  INDEPENDENTLY_VERIFIED: {
    label: 'Onafhankelijk bevestigd',
    explanation:
      'Een bron buiten de organisatie bevestigt de Zakat-geschiktheid. Ook dit blijft een ' +
      'vaststelling over beschikbare documentatie, geen religieus oordeel van Barakah.',
  },
}

/**
 * Derive the status from current claims.
 *
 * The ladder is walked from the strongest level down, and each rung requires its
 * own evidence: `ACCEPTS_ZAKAT = YES` on its own can never produce anything
 * above SELF_DECLARED, no matter how well-evidenced another claim is.
 */
export function deriveZakatStatus(claims: readonly ScoredClaim[]): ZakatStatusResult {
  const byType = new Map(claims.map((c) => [c.type, c]))

  const accepts = byType.get('ACCEPTS_ZAKAT')
  const policy = byType.get('ZAKAT_POLICY_PUBLISHED')
  const allocation = byType.get('ZAKAT_ALLOCATION_DESCRIBED')
  const independent = byType.get('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED')

  const basedOn: string[] = []

  // Independent verification requires a claim that is both YES, VERIFIED, and
  // backed by a source that is actually independent of the charity.
  if (
    independent?.value === 'YES' &&
    independent.status === 'VERIFIED' &&
    independent.source &&
    isIndependent(independent.source.sourceType)
  ) {
    basedOn.push('ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED')
    return build('INDEPENDENTLY_VERIFIED', basedOn)
  }

  // Everything below here needs the charity to accept Zakat at all.
  if (!accepts || accepts.value === 'UNKNOWN') return build('UNKNOWN', basedOn)
  if (accepts.value === 'NO') return build('DOES_NOT_ACCEPT', ['ACCEPTS_ZAKAT'])

  basedOn.push('ACCEPTS_ZAKAT')

  if (allocation?.value === 'YES' && allocation.source) {
    basedOn.push('ZAKAT_ALLOCATION_DESCRIBED')
    return build('ALLOCATION_DESCRIBED', basedOn)
  }

  if (policy?.value === 'YES' && policy.source) {
    basedOn.push('ZAKAT_POLICY_PUBLISHED')
    return build('POLICY_PUBLISHED', basedOn)
  }

  return build('SELF_DECLARED', basedOn)
}

function build(status: ZakatStatus, basedOn: string[]): ZakatStatusResult {
  return { status, ...LEVELS[status], basedOn }
}

/** Tone for the badge. Notice that nothing below the top rung reads as success. */
export const ZAKAT_STATUS_TONES: Record<
  ZakatStatus,
  'neutral' | 'info' | 'success' | 'warning'
> = {
  UNKNOWN: 'neutral',
  DOES_NOT_ACCEPT: 'neutral',
  SELF_DECLARED: 'info',
  POLICY_PUBLISHED: 'info',
  ALLOCATION_DESCRIBED: 'info',
  INDEPENDENTLY_VERIFIED: 'success',
}

/**
 * What the `verified` badge on a charity means, verbatim, wherever it appears (§13).
 */
export const VERIFICATION_BADGE_MEANING =
  'De identiteit van de organisatie is gecontroleerd tegen minstens één officieel register. ' +
  'Dit zegt niets over de financiën, de activiteiten, de impact of het Zakat-beleid, en is ' +
  'geen aanbeveling.'
