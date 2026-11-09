/**
 * Deterministische productmatching tussen supermarkten.
 *
 * ## Lagen, van zeker naar onzeker
 *
 *  1. Dezelfde barcode                              → EXACT       (1,00)
 *  2. Zelfde merk + naam + inhoud (`matchKey`)      → EXACT       (0,95)
 *  3. Zelfde merk + naam, andere inhoud             → EQUIVALENT  (0,85)
 *  4. Ander merk, (vrijwel) dezelfde naam en inhoud → ALTERNATIVE (0,60–0,80)
 *  5. Lijkt erop maar niet genoeg                   → UNCERTAIN   (< 0,60)
 *  6. Niets gemeen                                  → geen match
 *
 * Geen AI hier. Wat deze functies niet zeker weten, komt als UNCERTAIN terug
 * en wacht op een mens. Een huismerk wordt nooit als EXACT voorgesteld.
 */
import type { BrandType, MatchType, NormalizedUnit } from '@superette/contracts';

/** Kleine letters, geen accenten, geen leestekens, enkele spaties. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Verwijdert hoeveelheden uit een productnaam: "Cola Zero 1,5 L" → "Cola Zero",
 * "Jupiler 6 x 33 cl" → "Jupiler", "Eieren 12 stuks" → "Eieren".
 */
export function stripQuantityTokens(name: string): string {
  return name
    .replace(/\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|kilo|g|gr|gram|ml|cl|l|lt|liter|litre|st|stk|stuks?|pcs?)\b/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|kilo|g|gr|gram|ml|cl|l|lt|liter|litre|st|stk|stuks?|pcs?|rollen|rol|zakjes|tabs|wasbeurten)\b/gi, ' ')
    .replace(/\b\d+\s*[x×]\b/gi, ' ')
    .replace(/\bx\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Woorden die niets over het product zeggen en matching alleen vertroebelen. */
const STOP_WORDS = new Set(['de', 'het', 'een', 'en', 'van', 'met', 'le', 'la', 'les', 'du', 'des', 'et', 'au', 'aux', 'the', 'of', 'and']);

export function normalizeBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  const normalized = normalizeText(brand);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Genormaliseerde productnaam zonder hoeveelheden.
 *
 * Huismerknamen ("Boni", "Everyday", "365") zeggen niets over het product en
 * worden weggelaten: "Boni halfvolle melk 1 l" → "halfvolle melk". A-merken
 * horen vaak bij de productidentiteit en blijven staan: "Coca-Cola Zero 1,5 L"
 * → "coca cola zero". Zo lijkt "Everyday Cola Zero" op "Coca-Cola Zero"
 * (alternatief), zonder dat "Zero" alleen overblijft.
 */
export function normalizeProductName(name: string, brand?: string | null, brandType?: BrandType): string {
  const base = normalizeText(stripQuantityTokens(name));
  const tokens = base.split(' ').filter((t) => t.length > 0 && !STOP_WORDS.has(t));

  const type = brandType ?? detectBrandType(brand);
  if (type !== 'STORE_BRAND') return tokens.join(' ');

  const brandTokens = new Set((normalizeBrand(brand) ?? '').split(' ').filter((t) => t.length > 0));
  const withoutBrand = tokens.filter((t) => !brandTokens.has(t));

  return (withoutBrand.length > 0 ? withoutBrand : tokens).join(' ');
}

/** `merk|naam|inhoud×aantal` — gelijk betekent hetzelfde product in dezelfde verpakking. */
export function buildMatchKey(product: {
  readonly normalizedBrand: string | null;
  readonly normalizedName: string;
  readonly normalizedQuantity: number | null;
  readonly normalizedUnit: NormalizedUnit | null;
  readonly packCount: number;
}): string {
  return [
    product.normalizedBrand ?? '-',
    product.normalizedName,
    product.normalizedQuantity !== null && product.normalizedUnit !== null
      ? `${product.normalizedQuantity}${product.normalizedUnit.toLowerCase()}`
      : '?',
    `x${product.packCount}`,
  ].join('|');
}

/**
 * Huismerken per keten. Genormaliseerde namen; een merk dat hier staat is een
 * huismerk van die keten. Uitbreidbaar zonder code elders te raken.
 */
export const STORE_BRANDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  delhaize: ['delhaize', '365', 'delhaize bio', 'taste of inspirations'],
  lidl: ['lidl', 'milbona', 'freeway', 'cien', 'pilos', 'vemondo', 'solevita', 'crownfield', 'chef select', 'w5', 'floralys', 'lupilu', 'toujours', 'bellarom', 'combino', 'primadonna', 'saskia'],
  colruyt: ['colruyt', 'boni', 'boni selection', 'everyday', 'kwaliteitsgarantie'],
  spar: ['spar', 'spar premium'],
  'albert-heijn': ['ah', 'albert heijn', 'ah basic', 'ah biologisch', 'ah excellent', 'zaanse hoeve'],
  jumbo: ['jumbo', 'jumbo huismerk'],
  carrefour: ['carrefour', 'carrefour classic', 'carrefour bio', 'carrefour extra', 'simpl', 'carrefour original', 'n 1', 'carrefour selection'],
});

const ALL_STORE_BRANDS = new Set(Object.values(STORE_BRANDS).flat());

/**
 * Huismerk of A-merk? Een merk dat bij eender welke keten als huismerk bekend
 * is, is een huismerk. Onbekend merk → `UNKNOWN`, niet stilzwijgend A-merk.
 */
export function detectBrandType(brand: string | null | undefined, chainSlug?: string): BrandType {
  const normalized = normalizeBrand(brand);
  if (!normalized) return 'UNKNOWN';

  const chainBrands = chainSlug ? (STORE_BRANDS[chainSlug] ?? []) : [];
  if (chainBrands.includes(normalized) || ALL_STORE_BRANDS.has(normalized)) return 'STORE_BRAND';

  return 'NATIONAL_BRAND';
}

export interface MatchCandidate {
  readonly id: string;
  readonly normalizedName: string;
  readonly normalizedBrand: string | null;
  readonly brandType: BrandType;
  readonly barcode: string | null;
  /** `null` als de inhoud onbekend is; dan is alleen een barcode- of sleutelmatch mogelijk. */
  readonly normalizedQuantity: number | null;
  readonly normalizedUnit: NormalizedUnit | null;
  readonly packCount: number;
  readonly categoryId: string | null;
  readonly matchKey: string;
}

export interface MatchDecision {
  readonly matchType: MatchType;
  /** 0–1. */
  readonly confidence: number;
  /** Nederlandse uitleg, bruikbaar in de interface en in de beheerfase. */
  readonly reason: string;
}

/** Jaccard-gelijkenis van de woordverzamelingen. 1 = dezelfde woorden. */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter((t) => t.length > 0));
  const tokensB = new Set(b.split(' ').filter((t) => t.length > 0));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;

  return intersection / union;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Ligt de inhoud van `b` binnen een factor 2 van `a`? Een blikje naast een bak is geen alternatief. */
function comparableQuantity(a: MatchCandidate, b: MatchCandidate): boolean {
  if (a.normalizedQuantity === null || b.normalizedQuantity === null) return false;
  const ratio = a.normalizedQuantity / b.normalizedQuantity;
  return ratio >= 0.5 && ratio <= 2;
}

/**
 * Beoordeelt hoe `a` en `b` zich tot elkaar verhouden. Symmetrisch.
 *
 * Geeft `null` als ze niets met elkaar te maken hebben.
 */
export function evaluateMatch(a: MatchCandidate, b: MatchCandidate): MatchDecision | null {
  if (a.id === b.id) return null;

  if (a.barcode && b.barcode && a.barcode === b.barcode) {
    return { matchType: 'EXACT', confidence: 1, reason: 'Zelfde barcode' };
  }

  if (a.matchKey === b.matchKey) {
    return { matchType: 'EXACT', confidence: 0.95, reason: 'Zelfde merk, naam en inhoud' };
  }

  // Zonder bekende inhoud, of buiten dezelfde familie (gewicht / volume /
  // stuks), valt niets te vergelijken.
  if (a.normalizedUnit === null || b.normalizedUnit === null || a.normalizedUnit !== b.normalizedUnit) return null;

  const nameSimilarity = tokenSimilarity(a.normalizedName, b.normalizedName);
  const sameBrand = a.normalizedBrand !== null && a.normalizedBrand === b.normalizedBrand;
  const sameContents = a.normalizedQuantity === b.normalizedQuantity && a.packCount === b.packCount;
  const sameCategory = a.categoryId !== null && b.categoryId !== null && a.categoryId === b.categoryId;
  const categoryKnown = a.categoryId !== null && b.categoryId !== null;

  if (sameBrand) {
    if (nameSimilarity >= 0.8 && !sameContents) {
      return { matchType: 'EQUIVALENT', confidence: 0.85, reason: 'Zelfde product in een andere verpakkingsgrootte' };
    }
    if (nameSimilarity >= 0.4) {
      // Zelfde merk, bijna dezelfde naam: kan een smaakvariant zijn ("Zero" vs "Zero Lemon").
      return {
        matchType: 'UNCERTAIN',
        confidence: round2(Math.min(0.59, nameSimilarity * 0.8)),
        reason: 'Zelfde merk, maar de naam verschilt — mogelijk een variant',
      };
    }
    return null;
  }

  // Verschillend of onbekend merk: op zijn best een alternatief.
  if (categoryKnown && !sameCategory) return null;
  if (!comparableQuantity(a, b)) return nameSimilarity >= 0.6 ? uncertain(nameSimilarity, 'Vergelijkbaar product, maar een heel andere hoeveelheid') : null;

  const threshold = categoryKnown ? 0.6 : 0.7;
  if (nameSimilarity >= threshold) {
    const storeBrandInvolved = a.brandType === 'STORE_BRAND' || b.brandType === 'STORE_BRAND';
    return {
      matchType: 'ALTERNATIVE',
      confidence: round2(0.5 + nameSimilarity * 0.3),
      reason: storeBrandInvolved ? 'Huismerkalternatief' : 'Vergelijkbaar alternatief van een ander merk',
    };
  }

  if (nameSimilarity >= 0.4) return uncertain(nameSimilarity, 'Lijkt op elkaar, maar onvoldoende zekerheid');

  return null;
}

function uncertain(nameSimilarity: number, reason: string): MatchDecision {
  return { matchType: 'UNCERTAIN', confidence: round2(Math.min(0.59, nameSimilarity * 0.6)), reason };
}

const MATCH_RANK: Readonly<Record<MatchType, number>> = Object.freeze({ EXACT: 3, EQUIVALENT: 2, ALTERNATIVE: 1, UNCERTAIN: 0 });

/** De beste match uit een lijst kandidaten, of `null`. EXACT wint van alles, dan op confidence. */
export function findBestMatch(
  candidate: MatchCandidate,
  pool: readonly MatchCandidate[],
): { readonly match: MatchCandidate; readonly decision: MatchDecision } | null {
  let best: { match: MatchCandidate; decision: MatchDecision } | null = null;

  for (const other of pool) {
    const decision = evaluateMatch(candidate, other);
    if (!decision) continue;

    if (
      !best ||
      MATCH_RANK[decision.matchType] > MATCH_RANK[best.decision.matchType] ||
      (MATCH_RANK[decision.matchType] === MATCH_RANK[best.decision.matchType] && decision.confidence > best.decision.confidence)
    ) {
      best = { match: other, decision };
    }
  }

  return best;
}

/** Alle matches van minstens het gevraagde type, gesorteerd van zeker naar onzeker. */
export function findMatches(
  candidate: MatchCandidate,
  pool: readonly MatchCandidate[],
): ReadonlyArray<{ readonly match: MatchCandidate; readonly decision: MatchDecision }> {
  const results: Array<{ match: MatchCandidate; decision: MatchDecision }> = [];

  for (const other of pool) {
    const decision = evaluateMatch(candidate, other);
    if (decision) results.push({ match: other, decision });
  }

  return results.sort(
    (x, y) => MATCH_RANK[y.decision.matchType] - MATCH_RANK[x.decision.matchType] || y.decision.confidence - x.decision.confidence,
  );
}
