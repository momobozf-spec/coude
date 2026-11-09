/**
 * Van een opgeslagen aanbieding naar wat de app toont en waarmee het mandje
 * rekent. Zuiver: geen Prisma, geen Nest — alleen DTO's en `@superette/pricing`.
 */
import type { DataSourceKind, PriceStatus, ProductOffer, PromotionRuleInput } from '@superette/contracts';
import { effectivePrice, type PromotionRule } from '@superette/pricing';

/** Regels die pas gelden vanaf een aantal; `priceCents` is dan de gewone prijs. */
const CONDITIONAL_KINDS: ReadonlySet<PromotionRuleInput['kind']> = new Set([
  'BUY_X_GET_Y_FREE',
  'MULTIBUY',
  'VOLUME_DISCOUNT',
  'NTH_AT_DISCOUNT',
]);

export function isConditionalRule(rule: PromotionRuleInput | null | undefined): rule is PromotionRuleInput {
  return !!rule && CONDITIONAL_KINDS.has(rule.kind);
}

export interface LineCost {
  readonly totalCents: number;
  readonly regularTotalCents: number;
  readonly savingsCents: number;
  /** Of een voorwaardelijke promotie bij dit aantal is toegepast. */
  readonly conditionMet: boolean;
  readonly note: string | null;
}

/**
 * Wat `quantity` verpakkingen van deze aanbieding kosten.
 *
 * Onvoorwaardelijke promoties zitten al in `priceCents`; voorwaardelijke
 * worden hier toegepast via de rekenregel, en alleen als het aantal volstaat.
 */
export function lineCost(offer: Pick<ProductOffer, 'priceCents' | 'originalPriceCents' | 'promotionRule'>, quantity: number): LineCost {
  const regularUnit = offer.originalPriceCents ?? offer.priceCents;
  const regularTotalCents = regularUnit * quantity;

  if (isConditionalRule(offer.promotionRule)) {
    const result = effectivePrice(offer.priceCents, offer.promotionRule as PromotionRule, quantity);
    return {
      totalCents: result.totalCents,
      regularTotalCents: Math.max(regularTotalCents, result.regularTotalCents),
      savingsCents: Math.max(regularTotalCents, result.regularTotalCents) - result.totalCents,
      conditionMet: result.conditionMet,
      note: result.note,
    };
  }

  const totalCents = offer.priceCents * quantity;
  return {
    totalCents,
    regularTotalCents,
    savingsCents: Math.max(0, regularTotalCents - totalCents),
    conditionMet: true,
    note: null,
  };
}

export interface PriceStatusInput {
  readonly sourceKind: DataSourceKind;
  readonly observedAt: Date;
  readonly endsAt: Date | null;
  readonly confidence: number;
  readonly now: Date;
  /** Na zoveel uur zonder controle geldt een prijs als mogelijk verouderd. */
  readonly freshHours: number;
}

/** De status die naast elke prijs komt te staan. */
export function priceStatusFor(input: PriceStatusInput): PriceStatus {
  if (input.sourceKind === 'DEMO') return 'DEMO';
  if (input.endsAt && input.endsAt.getTime() < input.now.getTime()) return 'EXPIRED';
  if (input.confidence < 0.6 || input.sourceKind === 'MANUAL') return 'UNVERIFIED';

  const ageHours = (input.now.getTime() - input.observedAt.getTime()) / 3_600_000;
  return ageHours > input.freshHours ? 'STALE' : 'CURRENT';
}

/** Mag deze prijs meedoen in een vergelijking of alert? Verlopen prijzen niet. */
export function isUsableStatus(status: PriceStatus): boolean {
  return status !== 'EXPIRED';
}

/** Leesbare bronnaam per soort, voor de interface. */
export function sourceKindLabel(kind: DataSourceKind): string {
  switch (kind) {
    case 'DEMO':
      return 'Demogegevens';
    case 'IMPORT_FILE':
      return 'Importbestand';
    case 'OFFICIAL_API':
      return 'Officiële API';
    case 'MERCHANT_FEED':
      return 'Feed van de handelaar';
    case 'PARTNER_FEED':
      return 'Feed van een partnerketen';
    case 'MANUAL':
      return 'Handmatig ingevoerd';
  }
}
