/**
 * Lidl België — van een producttegel op een publieke categoriepagina naar
 * product + aanbiedingen.
 *
 * Bron: het attribuut `data-grid-data` dat lidl.be server-side op elke tegel
 * zet (JSON). Vastgesteld op 6 oktober 2026 op `/c/nl-BE/voeding-drank/s10068374`.
 * Relevante velden, letterlijk zoals Lidl ze noemt:
 *
 *   productId, canonicalUrl ("/p/nl-BE/<slug>/p<id>"), fullTitle, title
 *   brand          { name, showBrand }
 *   price          { price, oldPrice, currencyCode, variantsHaveDifferentPrices,
 *                    basePrice { text: "600 g - 8,32 EUR/kg" },
 *                    discount { deletedPrice, discountText: "2E AAN -50%", percentageDiscount, showFrom } }
 *   lidlPlus[]     { price {…zelfde vorm…}, lidlPlusText, highlightText }   ← aparte app-prijs
 *   storeStartDate, storeEndDate (Unix-seconden), stockAvailability.badgeInfo.badges[].text
 *   keyfacts.wonCategoryPrimary ("…/Vlees & gevogelte/Gevogelte")
 *
 * Wat de categoriepagina NIET heeft: een EAN (alleen interne Lidl-nummers).
 * Het zijn bovendien weekpromoties in de winkel, geen vast assortiment.
 *
 * Belangrijk bij meervoudsacties ("2E AAN -50%", "1 + 1 GRATIS"): Lidl zet
 * dan de prijs voor het hele pakket in `price` en `oldPrice`, en `basePrice`
 * beschrijft dat pakket ("2 x 6 x 33 cl - 1,02 EUR/l" = twee sixpacks samen
 * voor € 4,04). Wij slaan het op als één verpakking met een MULTIBUY-regel,
 * zodat het mandje correct rekent bij 1 stuk én bij 2 stuks.
 *
 * Elke inhoud wordt nagerekend met de eenheidsprijs die Lidl zelf vermeldt.
 * Klopt die niet tot op 1 cent, dan nemen we de inhoud niet over. Nooit raden.
 *
 * Zuivere functie, geen netwerk.
 */
import { parseQuantityLabel, type PackageUnit } from '@superette/pricing';
import type { PromotionRuleInput, PromotionType } from '@superette/contracts';

export const LIDL_ORIGIN = 'https://www.lidl.be';

export interface ParsedLidlOffer {
  readonly kind: 'STORE' | 'LIDL_PLUS';
  /** Gewone prijs van één verpakking, in centen. */
  readonly priceCents: number;
  readonly originalPriceCents: number | null;
  readonly promotionType: PromotionType;
  readonly promotionText: string | null;
  readonly promotionRule: PromotionRuleInput | null;
  readonly requiresLoyaltyCard: boolean;
  readonly conditions: string;
}

export interface ParsedLidlProduct {
  readonly externalId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly productUrl: string;
  readonly categoryPath: string | null;
  readonly packageQuantity: number | null;
  readonly packageUnit: PackageUnit | null;
  readonly packCount: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export type LidlTileResult =
  | {
      readonly ok: true;
      readonly product: ParsedLidlProduct;
      readonly offers: readonly ParsedLidlOffer[];
      /** Wat we bewust lieten vallen (bv. een app-prijs zonder inhoud), voor het rapport. */
      readonly skipped: readonly string[];
    }
  | { readonly ok: false; readonly reason: string };

type Json = Record<string, unknown>;

const CANONICAL = /^\/p\/nl-BE\/[a-z0-9-]+\/p(\d{4,12})$/;

function obj(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function euroToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function isoFromSeconds(value: unknown): string | null {
  // Tussen 2020 en 2100; alles daarbuiten is geen geldige datum voor ons.
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1_577_836_800 || value > 4_102_444_800) return null;
  return new Date(value * 1000).toISOString();
}

// ── Inhoud ──────────────────────────────────────────────────────────────

interface Pack {
  readonly quantity: number;
  readonly unit: PackageUnit;
  readonly packCount: number;
}

const BASE_FACTOR: Record<PackageUnit, number> = { G: 1, KG: 1000, ML: 1, CL: 10, L: 1000, PIECE: 1 };

const VARIABLE_WEIGHT = /\bca\.(?=\s|\d|$)|\bcirca\b|±|\+\s*\/\s*-|\bper\s*(?:kg|kilo(?:gram)?|l|liter)\b|\bprijs\s*(?:\/|per\s+)(?:kg|l)\b/i;
const UNIT_PRICE_ONLY = /(?:EUR|€)\s*\/\s*(?:kg|kilo|l|liter)\b|\b(?:kg|kilo|l|liter)\s*(?:prijs|price)\b/i;

function containsUnitCode(value: unknown): boolean {
  if (typeof value === 'string') return /\b(?:KGM|LTR)\b/i.test(value);
  if (Array.isArray(value)) return value.some(containsUnitCode);
  return !!obj(value) && Object.values(value as Json).some(containsUnitCode);
}

/** Alleen labels vóór de eenheidsprijs; "600 g - 8,32 EUR/kg" is vaste inhoud. */
function variablePriceReason(price: Json): string | null {
  const labels = [text(obj(price.basePrice)?.text), text(obj(price.packaging)?.text)].filter((label): label is string => label !== null);
  for (const raw of labels) {
    const label = raw.split(/\s+[-–—]\s+/)[0] ?? '';
    if (VARIABLE_WEIGHT.test(label) || UNIT_PRICE_ONLY.test(label)) {
      return 'wisselend gewicht of eenheidsprijs, geen vaste verpakkingsprijs';
    }
  }
  // KGM/LTR zijn broncodes. Zoek de waarden zonder onbekende veldnamen te raden.
  return containsUnitCode(price) ? 'eenheidscode KGM/LTR, geen vaste verpakkingsprijs' : null;
}

/** "600 g - 8,32 EUR/kg" → { label: "600 g", unitPrice: { cents: 832, per: 'KG' } } */
export function splitBasePrice(raw: string): { label: string; unitPriceCents: number | null; per: 'KG' | 'L' | null } {
  const [label, ...rest] = raw.split(/\s+-\s+/);
  const stated = /(\d+(?:,\d{1,2})?)\s*EUR\s*\/\s*(kg|l)\b/i.exec(rest.join(' - '));
  return {
    label: (label ?? '').trim(),
    unitPriceCents: stated ? Math.round(Number(stated[1]!.replace(',', '.')) * 100) : null,
    per: stated ? (stated[2]!.toLowerCase() === 'kg' ? 'KG' : 'L') : null,
  };
}

/** Zoals `parseQuantityLabel`, maar ook "2 x 6 x 33 cl" (= 12 blikjes). */
export function parsePack(label: string): Pack | null {
  const nested = /^(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(.+)$/i.exec(label.trim());
  if (nested) {
    const inner = parseQuantityLabel(nested[3]!);
    if (!inner || inner.packCount !== 1) return null;
    return { quantity: inner.quantity, unit: inner.unit, packCount: Number(nested[1]) * Number(nested[2]) };
  }
  return parseQuantityLabel(label);
}

/** Klopt `cents` voor `pack` met de eenheidsprijs die Lidl vermeldt (±1 cent)? */
function matchesUnitPrice(cents: number, pack: Pack, stated: { unitPriceCents: number | null; per: 'KG' | 'L' | null }): boolean {
  if (stated.unitPriceCents === null || stated.per === null) return true; // niets om na te rekenen
  const family = pack.unit === 'PIECE' ? 'PIECE' : ['G', 'KG'].includes(pack.unit) ? 'KG' : 'L';
  if (family !== stated.per) return false;
  const base = pack.quantity * BASE_FACTOR[pack.unit] * pack.packCount; // gram of milliliter
  return Math.abs(Math.round((cents * 1000) / base) - stated.unitPriceCents) <= 1;
}

// ── Actieteksten ────────────────────────────────────────────────────────

/**
 * Hoeveel verpakkingen een actie samen prijst. `null` = geen meervoudsactie,
 * `undefined` = een actietekst die we niet kennen (dan liever niets).
 */
function bundleSize(discountText: string | null): { size: number; type: PromotionType } | null | undefined {
  if (!discountText) return null;
  const free = /^(\d+)\s*\+\s*(\d+)\s*GRATIS$/i.exec(discountText);
  if (free) return { size: Number(free[1]) + Number(free[2]), type: 'BUY_X_GET_Y' };
  const nth = /^(\d+)\s*E\s+AAN\s+-\s*\d+\s*%$/i.exec(discountText);
  if (nth) return { size: Number(nth[1]), type: 'MULTIBUY' };
  const forN = /^(\d+)\s+VOOR\b/i.exec(discountText);
  if (forN) return { size: Number(forN[1]), type: 'MULTIBUY' };
  if (/^-\s*\d+\s*%$/.test(discountText)) return null; // gewone procentkorting
  return undefined;
}

interface PriceRead {
  readonly regularCents: number;
  readonly originalCents: number | null;
  readonly type: PromotionType;
  readonly label: string | null;
  readonly rule: PromotionRuleInput | null;
  readonly pack: Pack | null;
}

/**
 * Leest één `price`-blok (gewoon of Lidl Plus). Geeft een reden terug als
 * het niet eenduidig is.
 */
function readPrice(price: Json, highlight: string | null): PriceRead | string {
  const currency = text(price.currencyCode);
  if (currency && currency !== 'EUR') return `prijs in ${currency}`;
  if (price.variantsHaveDifferentPrices === true) return 'varianten met verschillende prijzen';

  const discount = obj(price.discount);
  if (discount?.showFrom === true || discount?.showUpTo === true) return '"vanaf"-prijs';

  const cents = euroToCents(price.price);
  if (cents === null) return 'geen prijs';
  const oldCents = euroToCents(price.oldPrice) ?? euroToCents(discount?.deletedPrice);
  if (oldCents !== null && oldCents < cents) return 'oude prijs lager dan nieuwe';

  const base = splitBasePrice(text(obj(price.basePrice)?.text) ?? '');
  const discountText = text(discount?.discountText);
  const bundle = bundleSize(discountText);
  if (bundle === undefined) return `onbekende actietekst "${discountText}"`;

  if (bundle) {
    // Pakketprijs → prijs per verpakking + MULTIBUY-regel.
    if (oldCents === null || oldCents % bundle.size !== 0) return `pakketprijs niet deelbaar door ${bundle.size}`;
    const regularCents = oldCents / bundle.size;
    let pack: Pack | null = null;
    if (base.label) {
      const lead = new RegExp(`^${bundle.size}\\s*[x×]\\s*(.+)$`, 'i').exec(base.label);
      if (!lead) return `inhoud "${base.label}" past niet bij "${discountText}"`;
      const single = parsePack(lead[1]!);
      const whole = single ? { ...single, packCount: single.packCount * bundle.size } : null;
      if (!single || !whole || !matchesUnitPrice(cents, whole, base)) return `inhoud "${base.label}" klopt niet met de eenheidsprijs`;
      pack = single;
    }
    return {
      regularCents,
      originalCents: null,
      type: bundle.type,
      label: discountText,
      rule: { kind: 'MULTIBUY', quantity: bundle.size, totalCents: cents },
      pack,
    };
  }

  let pack: Pack | null = null;
  if (base.label) {
    const parsed = parsePack(base.label);
    // Inhoud die niet klopt laten we weg; de prijs zelf blijft bruikbaar.
    pack = parsed && matchesUnitPrice(cents, parsed, base) ? parsed : null;
  }
  const percentage = discount?.percentageDiscount;
  const percent = typeof percentage === 'number' && percentage > 0 ? `-${percentage}%` : null;
  return {
    regularCents: cents,
    originalCents: oldCents !== null && oldCents > cents ? oldCents : null,
    type: oldCents !== null && oldCents > cents ? 'TEMPORARY' : 'NONE',
    label: discountText ?? highlight ?? (oldCents !== null && oldCents > cents ? percent : null),
    rule: null,
    pack,
  };
}

// ── Tegel ───────────────────────────────────────────────────────────────

export function parseLidlTile(raw: string): LidlTileResult {
  let tile: Json | null;
  try {
    tile = obj(JSON.parse(raw));
  } catch {
    return { ok: false, reason: 'tegel is geen geldige JSON' };
  }
  if (!tile) return { ok: false, reason: 'tegel is geen object' };
  if (containsUnitCode(tile)) return { ok: false, reason: 'eenheidscode KGM/LTR, geen vaste verpakkingsprijs' };

  const canonical = text(tile.canonicalUrl) ?? text(tile.canonicalPath);
  const id = canonical ? CANONICAL.exec(canonical)?.[1] : undefined;
  if (!canonical || !id) return { ok: false, reason: 'geen productlink' };
  if (tile.productId !== undefined && String(tile.productId) !== id) return { ok: false, reason: 'productId en link verschillen' };

  const keyfacts = obj(tile.keyfacts);
  const name = (text(tile.fullTitle) ?? text(keyfacts?.fullTitle) ?? text(tile.title))?.replace(/\*+$/, '').trim();
  if (!name) return { ok: false, reason: 'product zonder naam' };

  if (VARIABLE_WEIGHT.test(name)) return { ok: false, reason: 'wisselend gewicht, geen vaste verpakkingsprijs' };
  const priceBlocks = [obj(tile.price), ...(Array.isArray(tile.lidlPlus) ? tile.lidlPlus.map((entry) => obj(obj(entry)?.price)) : [])];
  for (const block of priceBlocks) {
    if (!block) continue;
    const reason = variablePriceReason(block);
    if (reason) return { ok: false, reason };
  }

  const brandObject = obj(tile.brand);
  const brand = brandObject?.showBrand === true ? text(brandObject.name) : null;

  const category = text(keyfacts?.wonCategoryPrimary);
  // Lidl's eerste twee niveaus zijn intern ("Werelden van nood/Eten en dichtbij voedsel");
  // een herhaling tussen haakjes ("Diepvriesvoeding (Diepvriesvoeding)") laten we weg.
  const categoryPath = category
    ? category
        .split('/')
        .slice(2)
        .map((part) => part.trim().replace(/^(.+?)\s*\(\1\)$/, '$1'))
        .filter(Boolean)
        .join(' / ') || null
    : null;

  const startsAt = isoFromSeconds(tile.storeStartDate);
  let endsAt = isoFromSeconds(tile.storeEndDate);
  if (startsAt && endsAt && endsAt <= startsAt) endsAt = null;

  const badges = obj(obj(tile.stockAvailability)?.badgeInfo)?.badges;
  const badge = Array.isArray(badges) ? text(obj(badges[0])?.text) : null;
  const storeCondition = badge ?? 'Prijs in de Lidl-winkels.';

  const offers: ParsedLidlOffer[] = [];
  const skipped: string[] = [];
  let pack: Pack | null = null;

  const price = obj(tile.price);
  if (price && price.price !== undefined) {
    const read = readPrice(price, null);
    if (typeof read === 'string') return { ok: false, reason: read };
    pack = read.pack;
    offers.push({
      kind: 'STORE',
      priceCents: read.regularCents,
      originalPriceCents: read.originalCents,
      promotionType: read.type,
      promotionText: read.label,
      promotionRule: read.rule,
      requiresLoyaltyCard: false,
      conditions: storeCondition,
    });
  }

  const plus = Array.isArray(tile.lidlPlus) ? obj(tile.lidlPlus[0]) : null;
  const plusPrice = obj(plus?.price);
  if (plusPrice) {
    const read = readPrice(plusPrice, text(plus?.highlightText));
    if (typeof read === 'string') {
      skipped.push(`Lidl Plus: ${read}`);
    } else if (pack && read.pack && (pack.quantity !== read.pack.quantity || pack.unit !== read.pack.unit || pack.packCount !== read.pack.packCount)) {
      skipped.push('Lidl Plus: andere inhoud dan de gewone prijs');
    } else {
      pack ??= read.pack;
      offers.push({
        kind: 'LIDL_PLUS',
        priceCents: read.regularCents,
        originalPriceCents: read.originalCents,
        promotionType: 'LOYALTY_CARD',
        promotionText: read.label,
        promotionRule: read.rule,
        requiresLoyaltyCard: true,
        conditions: [text(plus?.lidlPlusText) ?? 'Met de Lidl Plus-app', badge].filter(Boolean).join(' · '),
      });
    }
  }

  if (offers.length === 0) return { ok: false, reason: skipped[0] ?? 'geen prijs' };

  return {
    ok: true,
    product: {
      externalId: id,
      name: name.slice(0, 200),
      brand,
      productUrl: `${LIDL_ORIGIN}${canonical}`,
      categoryPath,
      packageQuantity: pack?.quantity ?? null,
      packageUnit: pack?.unit ?? null,
      packCount: pack?.packCount ?? 1,
      startsAt,
      endsAt,
    },
    offers,
    skipped,
  };
}
