/**
 * Promotieregels en hun effectieve prijs.
 *
 * ## De ene regel die alles stuurt
 *
 * Een promotie is pas een prijs als aan haar voorwaarde is voldaan. "2 voor
 * €5" is geen prijs van €2,50 per fles voor wie er één koopt. Daarom geeft elke
 * berekening `conditionMet` en `minimumQuantity` apart terug, en kiest de
 * vergelijker zelf wat ze toont: de prijs voor één verpakking, of de prijs die
 * je haalt als je het vereiste aantal meeneemt.
 *
 * Alle bedragen in integer-centen. Een promotie kan nooit duurder zijn dan de
 * gewone prijs: zou dat zo zijn (slecht ingevoerde feed), dan rekenen we de
 * gewone prijs en melden dat.
 */
import { applyPercentageDiscount, assertCents, divRoundHalfUp } from './money';

export type PromotionRule =
  /** Geen promotie: gewoon de schapprijs. */
  | { readonly kind: 'NONE' }
  /** Tijdelijke vaste promoprijs voor één verpakking. */
  | { readonly kind: 'FIXED_PRICE'; readonly priceCents: number }
  /** Procentuele korting op de stukprijs ("-30%"). */
  | { readonly kind: 'PERCENTAGE'; readonly percent: number }
  /** Koop X, krijg Y gratis ("1+1 gratis", "2+1 gratis"). */
  | { readonly kind: 'BUY_X_GET_Y_FREE'; readonly buy: number; readonly free: number }
  /** Vast bedrag voor een vast aantal ("2 voor €5"). */
  | { readonly kind: 'MULTIBUY'; readonly quantity: number; readonly totalCents: number }
  /** Staffel: vanaf N stuks een lagere stukprijs. */
  | { readonly kind: 'VOLUME_DISCOUNT'; readonly minimumQuantity: number; readonly unitPriceCents: number }
  /** Elke N-de aan korting ("2de aan -50%"). */
  | { readonly kind: 'NTH_AT_DISCOUNT'; readonly nth: number; readonly percent: number };

export interface EffectivePrice {
  /** Aantal verpakkingen waarvoor gerekend is. */
  readonly quantity: number;
  /** Wat je betaalt voor `quantity` verpakkingen. */
  readonly totalCents: number;
  /** `totalCents / quantity`, afgerond op de cent. */
  readonly effectiveUnitCents: number;
  /** Wat je zonder promotie zou betalen. */
  readonly regularTotalCents: number;
  readonly savingsCents: number;
  /** Is de promotie bij dit aantal daadwerkelijk toegepast? */
  readonly conditionMet: boolean;
  /** Vanaf hoeveel verpakkingen de promotie geldt. 1 als er geen voorwaarde is. */
  readonly minimumQuantity: number;
  /** Korte Nederlandse toelichting wanneer de voorwaarde niet gehaald is. */
  readonly note: string | null;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} moet een positief geheel getal zijn, kreeg: ${value}`);
  }
}

/** Valideert de regel zelf. Werpt bij onzinnige waarden uit een feed. */
export function assertPromotionRule(rule: PromotionRule): void {
  switch (rule.kind) {
    case 'NONE':
      return;
    case 'FIXED_PRICE':
      assertCents(rule.priceCents, 'FIXED_PRICE.priceCents');
      return;
    case 'PERCENTAGE':
      if (!Number.isFinite(rule.percent) || rule.percent <= 0 || rule.percent > 100) {
        throw new RangeError(`PERCENTAGE.percent moet tussen 0 en 100 liggen, kreeg: ${rule.percent}`);
      }
      return;
    case 'BUY_X_GET_Y_FREE':
      assertPositiveInteger(rule.buy, 'BUY_X_GET_Y_FREE.buy');
      assertPositiveInteger(rule.free, 'BUY_X_GET_Y_FREE.free');
      return;
    case 'MULTIBUY':
      assertPositiveInteger(rule.quantity, 'MULTIBUY.quantity');
      assertCents(rule.totalCents, 'MULTIBUY.totalCents');
      if (rule.quantity < 2) {
        throw new RangeError('MULTIBUY.quantity moet minstens 2 zijn; gebruik FIXED_PRICE voor één stuk');
      }
      return;
    case 'VOLUME_DISCOUNT':
      assertPositiveInteger(rule.minimumQuantity, 'VOLUME_DISCOUNT.minimumQuantity');
      assertCents(rule.unitPriceCents, 'VOLUME_DISCOUNT.unitPriceCents');
      return;
    case 'NTH_AT_DISCOUNT':
      assertPositiveInteger(rule.nth, 'NTH_AT_DISCOUNT.nth');
      if (rule.nth < 2) {
        throw new RangeError('NTH_AT_DISCOUNT.nth moet minstens 2 zijn; gebruik PERCENTAGE voor elk stuk');
      }
      if (!Number.isFinite(rule.percent) || rule.percent <= 0 || rule.percent > 100) {
        throw new RangeError(`NTH_AT_DISCOUNT.percent moet tussen 0 en 100 liggen, kreeg: ${rule.percent}`);
      }
      return;
  }
}

/** Vanaf hoeveel verpakkingen de promotie van toepassing is. */
export function promotionMinimumQuantity(rule: PromotionRule): number {
  switch (rule.kind) {
    case 'NONE':
    case 'FIXED_PRICE':
    case 'PERCENTAGE':
      return 1;
    case 'BUY_X_GET_Y_FREE':
      return rule.buy + rule.free;
    case 'MULTIBUY':
      return rule.quantity;
    case 'VOLUME_DISCOUNT':
      return rule.minimumQuantity;
    case 'NTH_AT_DISCOUNT':
      return rule.nth;
  }
}

/**
 * Wat je betaalt voor `quantity` verpakkingen met deze promotie.
 *
 * Voor voorwaardelijke promoties wordt het aantal opgesplitst in volledige
 * promotiegroepen plus een rest tegen de gewone prijs. Drie flessen bij
 * "1+1 gratis" zijn dus één gratis fles en twee betaalde — niet anderhalf.
 */
export function effectivePrice(regularCents: number, rule: PromotionRule, quantity = 1): EffectivePrice {
  assertCents(regularCents, 'regularCents');
  assertPositiveInteger(quantity, 'quantity');
  assertPromotionRule(rule);

  const regularTotalCents = regularCents * quantity;
  const minimumQuantity = promotionMinimumQuantity(rule);

  let totalCents = regularTotalCents;
  let conditionMet = quantity >= minimumQuantity;

  switch (rule.kind) {
    case 'NONE':
      break;

    case 'FIXED_PRICE':
      totalCents = Math.min(rule.priceCents, regularCents) * quantity;
      break;

    case 'PERCENTAGE':
      totalCents = applyPercentageDiscount(regularCents, rule.percent) * quantity;
      break;

    case 'BUY_X_GET_Y_FREE': {
      const groupSize = rule.buy + rule.free;
      const groups = Math.floor(quantity / groupSize);
      const remainder = quantity - groups * groupSize;
      totalCents = (groups * rule.buy + remainder) * regularCents;
      break;
    }

    case 'MULTIBUY': {
      const groups = Math.floor(quantity / rule.quantity);
      const remainder = quantity - groups * rule.quantity;
      const groupPrice = Math.min(rule.totalCents, rule.quantity * regularCents);
      totalCents = groups * groupPrice + remainder * regularCents;
      break;
    }

    case 'VOLUME_DISCOUNT':
      if (conditionMet) {
        totalCents = Math.min(rule.unitPriceCents, regularCents) * quantity;
      }
      break;

    case 'NTH_AT_DISCOUNT': {
      const discounted = Math.floor(quantity / rule.nth);
      const fullPrice = quantity - discounted;
      totalCents = fullPrice * regularCents + discounted * applyPercentageDiscount(regularCents, rule.percent);
      break;
    }
  }

  // Een promotie die niets bespaart, is geen promotie. Dat gebeurt bij een
  // feed die "2 voor €5" meldt terwijl de fles €2,40 kost.
  if (rule.kind !== 'NONE' && totalCents >= regularTotalCents) {
    totalCents = regularTotalCents;
    conditionMet = false;
  }

  return {
    quantity,
    totalCents,
    effectiveUnitCents: divRoundHalfUp(totalCents, quantity),
    regularTotalCents,
    savingsCents: regularTotalCents - totalCents,
    conditionMet,
    minimumQuantity,
    note: conditionMet ? null : conditionNote(minimumQuantity),
  };
}

function conditionNote(minimumQuantity: number): string {
  if (minimumQuantity > 1) {
    return `Geldt vanaf ${minimumQuantity} stuks`;
  }
  // Onvoorwaardelijke promotie die toch niets bespaart: foute of verlopen feeddata.
  return 'Promotieprijs is niet lager dan de gewone prijs';
}

export interface BestUnitPrice {
  /** Laagste haalbare prijs per verpakking met deze promotie. */
  readonly unitCents: number;
  /** Bij welk aantal je die haalt. */
  readonly atQuantity: number;
  /** Of daarvoor een voorwaarde (minimumaantal) nodig is. */
  readonly conditional: boolean;
}

/**
 * De laagste prijs per verpakking die deze promotie oplevert, en bij welk
 * aantal. Dit is de "effectieve promotieprijs" die naast de gewone prijs
 * getoond wordt — mét de vermelding dat er bijvoorbeeld twee nodig zijn.
 */
export function bestEffectiveUnitPrice(regularCents: number, rule: PromotionRule): BestUnitPrice {
  const minimum = promotionMinimumQuantity(rule);
  const atMinimum = effectivePrice(regularCents, rule, minimum);

  return {
    unitCents: atMinimum.effectiveUnitCents,
    atQuantity: minimum,
    conditional: minimum > 1,
  };
}

/** Korte Nederlandse omschrijving zoals op een promotielabel. */
export function describePromotion(rule: PromotionRule): string | null {
  switch (rule.kind) {
    case 'NONE':
      return null;
    case 'FIXED_PRICE':
      return 'Promoprijs';
    case 'PERCENTAGE':
      return `-${formatPercent(rule.percent)}%`;
    case 'BUY_X_GET_Y_FREE':
      return `${rule.buy}+${rule.free} gratis`;
    case 'MULTIBUY':
      return `${rule.quantity} voor ${formatEuro(rule.totalCents)}`;
    case 'VOLUME_DISCOUNT':
      return `Vanaf ${rule.minimumQuantity} stuks: ${formatEuro(rule.unitPriceCents)} per stuk`;
    case 'NTH_AT_DISCOUNT':
      return `${rule.nth}de aan -${formatPercent(rule.percent)}%`;
  }
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : String(percent).replace('.', ',');
}

function formatEuro(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents - euros * 100;
  return `€${euros},${String(rest).padStart(2, '0')}`;
}
