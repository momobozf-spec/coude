/**
 * Beslist of een prijsalert afgaat. Zuiver, zonder database.
 *
 * ## Regels
 *
 *  - Een alert gaat af als een geldige, vergelijkbare prijs onder of gelijk
 *    aan de grens komt (of de korting minstens het minimum haalt).
 *  - Een promotie met minimumaantal telt met haar prijs voor één verpakking.
 *    "2 voor €5" is geen €2,50 voor wie er één wil.
 *  - Klantenkaart-, persoonlijke en online-prijzen tellen alleen mee als de
 *    gebruiker dat expliciet toestaat.
 *  - Onzekere matches tellen nooit mee.
 *  - Na een melding staat de alert "ontwapend" (`armed = false`). Hij gaat pas
 *    opnieuw af bij een nieuwe, lagere prijs, of nadat de prijs eerst weer
 *    boven de grens is geweest.
 */
import type { AlertComparisonType, AlertMatchPreference, MatchType, ProductOffer } from '@superette/contracts';

export interface AlertRule {
  readonly status: 'ACTIVE' | 'PAUSED';
  readonly comparisonType: AlertComparisonType;
  readonly targetPriceCents: number | null;
  readonly minimumDiscountPercentage: number | null;
  readonly matchPreference: AlertMatchPreference;
  readonly includeLoyaltyOffers: boolean;
  readonly includePersonalizedOffers: boolean;
  readonly includeOnlineOffers: boolean;
  readonly armed: boolean;
  readonly lastTriggeredPriceCents: number | null;
}

export interface AlertCandidate {
  readonly offer: ProductOffer;
  readonly matchType: MatchType;
}

export interface AlertEvaluationOptions {
  /** Mogen demoprijzen een alert laten afgaan? Alleen buiten productie. */
  readonly allowDemo: boolean;
}

export interface AlertEvaluation {
  readonly triggered: boolean;
  /** Het aanbod dat het dichtst bij (of voorbij) het doel ligt. */
  readonly best: { readonly candidate: AlertCandidate; readonly comparedValue: number } | null;
  readonly thresholdMet: boolean;
  /** De alert mag opnieuw op scherp: de prijs ligt weer boven de grens. */
  readonly rearm: boolean;
  readonly reason: string;
}

const PREFERENCE_ALLOWS: Readonly<Record<AlertMatchPreference, readonly MatchType[]>> = Object.freeze({
  EXACT: ['EXACT'],
  EQUIVALENT: ['EXACT', 'EQUIVALENT'],
  ALTERNATIVE: ['EXACT', 'EQUIVALENT', 'ALTERNATIVE'],
});

/** De waarde waarmee de alert vergelijkt, of `null` als die niet te bepalen is. */
export function comparedValue(offer: ProductOffer, type: AlertComparisonType): number | null {
  switch (type) {
    case 'PACKAGE_PRICE':
      return offer.priceCents;
    case 'UNIT_PRICE':
      return offer.unitPrice?.cents ?? null;
    case 'DISCOUNT_PERCENTAGE':
      return offer.discountPercentage;
  }
}

export function isEligible(
  rule: AlertRule,
  candidate: AlertCandidate,
  options: AlertEvaluationOptions,
): { ok: true } | { ok: false; reason: string } {
  const { offer, matchType } = candidate;

  if (!PREFERENCE_ALLOWS[rule.matchPreference].includes(matchType)) return { ok: false, reason: `match ${matchType} niet toegestaan` };
  if (offer.provenance.status === 'EXPIRED') return { ok: false, reason: 'verlopen' };
  if (offer.provenance.isDemo && !options.allowDemo) return { ok: false, reason: 'demogegevens' };
  if (offer.availability === 'OUT_OF_STOCK') return { ok: false, reason: 'niet op voorraad' };
  if (offer.requiresLoyaltyCard && !rule.includeLoyaltyOffers) return { ok: false, reason: 'klantenkaart vereist' };
  if (offer.isPersonalized && !rule.includePersonalizedOffers) return { ok: false, reason: 'persoonlijke aanbieding' };
  if (offer.channel === 'ONLINE' && !rule.includeOnlineOffers) return { ok: false, reason: 'alleen online' };
  if (comparedValue(offer, rule.comparisonType) === null) return { ok: false, reason: 'niet vergelijkbaar' };

  return { ok: true };
}

/** Is de grens gehaald? Lager-of-gelijk voor prijzen, hoger-of-gelijk voor korting. */
export function meetsThreshold(rule: AlertRule, value: number): boolean {
  if (rule.comparisonType === 'DISCOUNT_PERCENTAGE') {
    return rule.minimumDiscountPercentage !== null && value >= rule.minimumDiscountPercentage;
  }
  return rule.targetPriceCents !== null && value <= rule.targetPriceCents;
}

/** Is `a` een betere waarde dan `b` voor dit vergelijkingstype? */
function isBetter(type: AlertComparisonType, a: number, b: number): boolean {
  return type === 'DISCOUNT_PERCENTAGE' ? a > b : a < b;
}

export function evaluateAlert(rule: AlertRule, candidates: readonly AlertCandidate[], options: AlertEvaluationOptions): AlertEvaluation {
  if (rule.status === 'PAUSED') {
    return { triggered: false, best: null, thresholdMet: false, rearm: false, reason: 'Alert is gepauzeerd' };
  }

  let best: { candidate: AlertCandidate; comparedValue: number } | null = null;
  const rejections = new Set<string>();

  for (const candidate of candidates) {
    const eligible = isEligible(rule, candidate, options);
    if (!eligible.ok) {
      rejections.add(eligible.reason);
      continue;
    }
    const value = comparedValue(candidate.offer, rule.comparisonType)!;
    if (!best || isBetter(rule.comparisonType, value, best.comparedValue)) {
      best = { candidate, comparedValue: value };
    }
  }

  if (!best) {
    return {
      triggered: false,
      best: null,
      thresholdMet: false,
      rearm: false,
      reason: rejections.size > 0 ? `Geen geldige prijs (${[...rejections].join(', ')})` : 'Geen prijzen beschikbaar',
    };
  }

  const thresholdMet = meetsThreshold(rule, best.comparedValue);

  if (!thresholdMet) {
    return {
      triggered: false,
      best,
      thresholdMet: false,
      // Weer boven de grens: de volgende daling mag opnieuw melden.
      rearm: !rule.armed,
      reason: 'Grens nog niet bereikt',
    };
  }

  if (rule.armed) {
    return { triggered: true, best, thresholdMet: true, rearm: false, reason: 'Grens bereikt' };
  }

  // Al eerder gemeld: alleen opnieuw bij een relevante nieuwe daling.
  const previous = rule.lastTriggeredPriceCents;
  if (previous !== null && isBetter(rule.comparisonType, best.comparedValue, previous)) {
    return { triggered: true, best, thresholdMet: true, rearm: false, reason: 'Nieuwe daling onder de grens' };
  }

  return { triggered: false, best, thresholdMet: true, rearm: false, reason: 'Al gemeld voor deze prijs' };
}

/** Afgeleide toestand voor het overzicht: bereikt, bijna, actief, gepauzeerd, onbeschikbaar. */
export function derivedState(
  rule: AlertRule,
  best: { comparedValue: number } | null,
): 'ACTIVE' | 'REACHED' | 'ALMOST' | 'PAUSED' | 'UNAVAILABLE' {
  if (rule.status === 'PAUSED') return 'PAUSED';
  if (!best) return 'UNAVAILABLE';
  if (meetsThreshold(rule, best.comparedValue)) return 'REACHED';

  if (rule.comparisonType === 'DISCOUNT_PERCENTAGE') {
    const minimum = rule.minimumDiscountPercentage ?? 0;
    return minimum > 0 && best.comparedValue >= minimum - 5 ? 'ALMOST' : 'ACTIVE';
  }

  const target = rule.targetPriceCents ?? 0;
  // "Bijna": binnen 10 % boven het doel.
  return target > 0 && best.comparedValue <= Math.round(target * 1.1) ? 'ALMOST' : 'ACTIVE';
}
