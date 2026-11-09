/**
 * Verpakkingseenheden en hun omzetting naar één basiseenheid per familie.
 *
 * ## Waarom integer-basiseenheden
 *
 * Een prijs per kilogram berekenen uit "1,5 L" en "750 ml" vraagt om één
 * gemeenschappelijke maat. We kiezen de *kleinste* praktische eenheid als
 * basis — gram, milliliter, stuk — en slaan die als geheel getal op. Dan is
 * "prijs per kg" gewoon `prijs × 1000 / gram`, zonder dat 0,75 ergens
 * 0,7499999 wordt.
 */

/** De eenheden die een supermarkt op een verpakking kan zetten. */
export const PACKAGE_UNITS = ['G', 'KG', 'ML', 'CL', 'L', 'PIECE'] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

/** De eenheden waarin we vergelijken. */
export const NORMALIZED_UNITS = ['KG', 'L', 'PIECE'] as const;
export type NormalizedUnit = (typeof NORMALIZED_UNITS)[number];

/**
 * Een hoeveelheid in de basiseenheid van haar familie:
 * gram voor `KG`, milliliter voor `L`, stuks voor `PIECE`. Altijd een geheel getal.
 */
export interface BaseQuantity {
  readonly amount: number;
  readonly unit: NormalizedUnit;
}

/** Hoeveel basiseenheden (g / ml / stuk) er in één verpakkingseenheid gaan. */
const BASE_FACTOR: Readonly<Record<PackageUnit, number>> = Object.freeze({
  G: 1,
  KG: 1000,
  ML: 1,
  CL: 10,
  L: 1000,
  PIECE: 1,
});

const FAMILY: Readonly<Record<PackageUnit, NormalizedUnit>> = Object.freeze({
  G: 'KG',
  KG: 'KG',
  ML: 'L',
  CL: 'L',
  L: 'L',
  PIECE: 'PIECE',
});

/** Hoeveel basiseenheden er in één genormaliseerde eenheid gaan (1 kg = 1000 g). */
export const BASE_PER_NORMALIZED: Readonly<Record<NormalizedUnit, number>> = Object.freeze({
  KG: 1000,
  L: 1000,
  PIECE: 1,
});

/** Tot welke vergelijkingsfamilie een verpakkingseenheid behoort. */
export function baseUnitOf(unit: PackageUnit): NormalizedUnit {
  return FAMILY[unit];
}

export function isPackageUnit(value: unknown): value is PackageUnit {
  return typeof value === 'string' && (PACKAGE_UNITS as readonly string[]).includes(value);
}

/**
 * Zet een verpakkingshoeveelheid om naar de basiseenheid.
 *
 * `1.5 L` → `{ amount: 1500, unit: 'L' }`, `33 CL` → `{ amount: 330, unit: 'L' }`,
 * `0.5 KG` → `{ amount: 500, unit: 'KG' }`.
 *
 * Geeft `null` als de hoeveelheid onbruikbaar is (nul, negatief, oneindig, of
 * zo klein dat ze naar 0 afrondt). We verzinnen dan liever niets.
 */
export function toBaseQuantity(quantity: number, unit: PackageUnit): BaseQuantity | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const amount = Math.round(quantity * BASE_FACTOR[unit]);
  if (amount <= 0) return null;

  return { amount, unit: FAMILY[unit] };
}

/** Eenheidstekst zoals ze op etiketten en in zoektermen voorkomt → onze code. */
const UNIT_ALIASES: ReadonlyArray<readonly [RegExp, PackageUnit]> = [
  [/^(kg|kilo|kilogram|kilos)$/i, 'KG'],
  [/^(g|gr|gram|grams|gramme|grammes)$/i, 'G'],
  [/^(ml|milliliter|millilitre|millilitres)$/i, 'ML'],
  [/^(cl|centiliter|centilitre)$/i, 'CL'],
  [/^(l|lt|ltr|liter|litre|liters|litres)$/i, 'L'],
  [/^(st|stk|stuk|stuks|pc|pcs|piece|pieces|pièce|pièces|x)$/i, 'PIECE'],
];

export function parseUnitToken(token: string): PackageUnit | null {
  const trimmed = token.trim();
  for (const [pattern, unit] of UNIT_ALIASES) {
    if (pattern.test(trimmed)) return unit;
  }
  return null;
}

export interface ParsedQuantity {
  /** Hoeveelheid per enkele verpakking, in `unit`. */
  readonly quantity: number;
  readonly unit: PackageUnit;
  /** Aantal verpakkingen in een multipack. 1 als het geen multipack is. */
  readonly packCount: number;
}

/**
 * Leest een hoeveelheid uit vrije tekst zoals ze op een etiket of in een
 * productnaam staat.
 *
 *   "1,5 L"        → { quantity: 1.5, unit: 'L', packCount: 1 }
 *   "500 g"        → { quantity: 500, unit: 'G', packCount: 1 }
 *   "6 x 33 cl"    → { quantity: 33, unit: 'CL', packCount: 6 }
 *   "4x100g"       → { quantity: 100, unit: 'G', packCount: 4 }
 *   "12 stuks"     → { quantity: 12, unit: 'PIECE', packCount: 1 }
 *   "2 x 1 kg"     → { quantity: 1, unit: 'KG', packCount: 2 }
 *
 * Geeft `null` als er geen hoeveelheid in de tekst te vinden is. We raden niet.
 */
export function parseQuantityLabel(text: string): ParsedQuantity | null {
  const normalized = text.replace(/ /g, ' ').trim();

  // Multipack: "6 x 33 cl", "4x100g", "2 × 1,5 l"
  const multipack =
    /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|ml|cl|l|lt|ltr|liter|litre|st|stk|stuks?)\b/i.exec(
      normalized,
    );
  if (multipack) {
    const packCount = Number(multipack[1]);
    const quantity = toNumber(multipack[2]!);
    const unit = parseUnitToken(multipack[3]!);
    if (unit && packCount > 0 && quantity > 0) {
      return { quantity, unit, packCount };
    }
  }

  // Enkelvoudig: "1,5 L", "500g", "750 ml", "12 stuks"
  const single =
    /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|ml|cl|l|lt|ltr|liter|litre|st|stk|stuks?|pcs?|pièces?)\b/i.exec(
      normalized,
    );
  if (single) {
    const quantity = toNumber(single[1]!);
    const unit = parseUnitToken(single[2]!);
    if (unit && quantity > 0) {
      return { quantity, unit, packCount: 1 };
    }
  }

  return null;
}

function toNumber(token: string): number {
  return Number(token.replace(',', '.'));
}

export type QuantityLocale = 'nl' | 'fr' | 'en';

/**
 * Toont een basishoeveelheid leesbaar: 1500 ml → "1,5 l", 500 g → "500 g",
 * 1000 g → "1 kg", 6 stuks → "6 stuks".
 */
export function formatBaseQuantity(base: BaseQuantity, locale: QuantityLocale = 'nl'): string {
  const number = (value: number, maxFraction = 2) =>
    new Intl.NumberFormat(locale === 'fr' ? 'fr-BE' : locale === 'en' ? 'en-BE' : 'nl-BE', {
      maximumFractionDigits: maxFraction,
    }).format(value);

  switch (base.unit) {
    case 'KG':
      return base.amount >= 1000 ? `${number(base.amount / 1000)} kg` : `${number(base.amount, 0)} g`;
    case 'L':
      return base.amount >= 1000 ? `${number(base.amount / 1000)} l` : `${number(base.amount, 0)} ml`;
    case 'PIECE': {
      const word = locale === 'fr' ? (base.amount === 1 ? 'pièce' : 'pièces') : locale === 'en' ? (base.amount === 1 ? 'piece' : 'pieces') : base.amount === 1 ? 'stuk' : 'stuks';
      return `${number(base.amount, 0)} ${word}`;
    }
  }
}

/** Het label achter "prijs per …": "kg", "l" of "stuk". */
export function perUnitLabel(unit: NormalizedUnit, locale: QuantityLocale = 'nl'): string {
  switch (unit) {
    case 'KG':
      return 'kg';
    case 'L':
      return 'l';
    case 'PIECE':
      return locale === 'fr' ? 'pièce' : locale === 'en' ? 'piece' : 'stuk';
  }
}
