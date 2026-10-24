/**
 * Delhaize — van een publieke productpagina naar een product + aanbieding.
 *
 * Bron: de schema.org `Product`-gegevens (JSON-LD) die Delhaize zelf in elke
 * productpagina zet voor zoekmachines. We lezen niets uit interne API's of
 * app-state. Vastgesteld op 6 oktober 2026 op
 * `/nl/shop/…/Original-taste-PET/p/S1991061400921760000`:
 *
 *   name     "Original taste | PET"
 *   brand    { name: "Coca-Cola" }
 *   category "Klassieke cola"
 *   offers   { availability: InStock, priceSpecification: {
 *                @type: UnitPriceSpecification, price: 14.59, priceCurrency: "EUR",
 *                eligibleQuantity: { unitCode: "C62", value: 1 } } }      ← per STUK
 *   <title>  "Coca-Cola | Original taste | PET | 6 x 1,5 l | Delhaize"
 *
 * En op `/nl/shop/…/Rosbief-Gebakken/p/F2024091700147590000` (7 oktober 2026):
 *
 *   offers   { priceSpecification: { price: 36.69, priceCurrency: "EUR",
 *                eligibleQuantity: { unitCode: "KGM", value: 1 } } }       ← per KILO
 *   pagina   "+/- 180 gr", "+/- € 6,60", "+/- 36,69 €/kg"
 *
 * Dat tweede geval is een product met wisselend gewicht: Delhaize geeft enkel
 * een kiloprijs, de verpakkingsprijs is een schatting ("+/-"). Een kiloprijs
 * mag NOOIT als verpakkingsprijs opgeslagen worden (dan kost 180 g rosbief
 * € 36,69 in de app). Zulke producten slaan we daarom bewust over, met een
 * eigen reden in het rapport. De `unitCode` is een UN/CEFACT-code:
 * C62/H87 = stuk, KGM = kg, GRM = g, LTR = l, MLT = ml, CLT = cl. Een
 * onbekende code wordt ook overgeslagen — nooit raden.
 *
 * Wat er NIET in staat: EAN/GTIN en promoties. Matching met andere ketens
 * gebeurt dus op merk + naam + inhoud; de prijs is de actuele webshopprijs.
 *
 * Bewust niet overgenomen: afbeeldingen en productomschrijvingen (auteursrecht
 * van de keten). Wel een link naar de productpagina.
 *
 * Zuivere functie, geen netwerk: volledig testbaar met vastgelegde pagina's.
 */
import { parseQuantityLabel } from '@superette/pricing';
import type { Availability } from '@superette/contracts';

export interface DelhaizePageInput {
  readonly url: string;
  readonly title: string;
  /** De inhoud van elk `<script type="application/ld+json">`, ongeparsed. */
  readonly jsonLd: readonly string[];
}

export interface ParsedDelhaizeProduct {
  readonly externalId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly categoryPath: string | null;
  readonly productUrl: string;
  readonly packageQuantity: number | null;
  readonly packageUnit: 'G' | 'KG' | 'ML' | 'CL' | 'L' | 'PIECE' | null;
  readonly packCount: number;
  readonly priceCents: number;
  readonly availability: Availability;
}

/**
 * `kind` maakt het verschil tussen:
 *  - `unreadable`: de pagina had niet wat we verwachtten (geen Product, geen
 *    prijs). Veel van deze op rij wijst op een blokkade.
 *  - `skipped`: de pagina is prima leesbaar, maar we nemen het product bewust
 *    niet op (bv. alleen een kiloprijs). Dat is GEEN teken van blokkade.
 */
export type ParseResult =
  | { readonly ok: true; readonly product: ParsedDelhaizeProduct }
  | { readonly ok: false; readonly kind: 'unreadable' | 'skipped'; readonly reason: string };

const PRODUCT_ID = /\/p\/([A-Za-z0-9]{6,40})(?:[/?#]|$)/;

/** UN/CEFACT-codes voor "per stuk": de prijs geldt voor één verpakking. */
const PER_PIECE = new Set(['C62', 'H87']);
/** UN/CEFACT-codes voor een prijs per gewicht of volume. */
const PER_MEASURE: Readonly<Record<string, string>> = { KGM: 'kg', GRM: 'g', LTR: 'l', MLT: 'ml', CLT: 'cl' };

export const REASON_PER_MEASURE = (unit: string) => `alleen een prijs per ${unit} (wisselend gewicht), geen vaste verpakkingsprijs`;
export const REASON_UNKNOWN_UNIT = (code: string) => `prijs per onbekende eenheid "${code}"`;

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Alle JSON-LD-knopen plat, ook binnen `@graph` of arrays. */
function flattenLd(blocks: readonly string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const object = asObject(node);
    if (!object) return;
    out.push(object);
    if (Array.isArray(object['@graph'])) visit(object['@graph']);
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block));
    } catch {
      // Een kapot blok is geen reden om de pagina te verwerpen.
    }
  }
  return out;
}

function isProduct(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
}

/**
 * Voor welke hoeveelheid geldt de prijs?
 *  - geen `eligibleQuantity`/`referenceQuantity`: per verpakking (zoals een
 *    gewone schema.org-Offer);
 *  - `value` 1 met C62/H87: per verpakking;
 *  - KGM/GRM/LTR/MLT/CLT: per gewicht of volume → geen verpakkingsprijs;
 *  - al het andere (onbekende code, hoeveelheid ≠ 1): niet bruikbaar.
 */
type PriceBasis = { readonly kind: 'package' } | { readonly kind: 'measure'; readonly unit: string } | { readonly kind: 'unknown'; readonly code: string };

function basisOf(spec: Record<string, unknown> | null): PriceBasis {
  const quantity = asObject(spec?.eligibleQuantity) ?? asObject(spec?.referenceQuantity);
  if (!quantity) return { kind: 'package' };
  const code = (text(quantity.unitCode) ?? '').toUpperCase();
  const measure = PER_MEASURE[code];
  if (measure) return { kind: 'measure', unit: measure };
  const value = typeof quantity.value === 'number' ? quantity.value : Number(quantity.value ?? 1);
  if (PER_PIECE.has(code) && value === 1) return { kind: 'package' };
  return { kind: 'unknown', code: code === '' ? '(leeg)' : `${value} ${code}` };
}

function priceOf(offers: unknown): { price: number; currency: string | null; basis: PriceBasis } | null {
  const list = Array.isArray(offers) ? offers : [offers];
  for (const entry of list) {
    const offer = asObject(entry);
    if (!offer) continue;
    const spec = asObject(offer.priceSpecification);
    // Staat de prijs rechtstreeks op de offer, dan is het een gewone verpakkingsprijs.
    const direct = offer.price !== undefined && offer.price !== null;
    const raw = direct ? offer.price : spec?.price;
    const price = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.')) : NaN;
    if (Number.isFinite(price) && price > 0) {
      return {
        price,
        currency: text(offer.priceCurrency) ?? text(spec?.priceCurrency),
        basis: direct ? { kind: 'package' } : basisOf(spec),
      };
    }
  }
  return null;
}

function availabilityOf(offers: unknown): Availability {
  const offer = asObject(Array.isArray(offers) ? offers[0] : offers);
  const value = text(offer?.availability) ?? '';
  if (/InStock|LimitedAvailability|InStoreOnly|OnlineOnly/i.test(value)) return 'IN_STOCK';
  if (/OutOfStock|SoldOut|Discontinued/i.test(value)) return 'OUT_OF_STOCK';
  return 'UNKNOWN';
}

/**
 * De verpakking staat niet in de JSON-LD maar wel in de paginatitel:
 * "Merk | Naam | Variant | 6 x 1,5 l | Delhaize". We nemen het laatste
 * segment vóór "Delhaize" waarin een hoeveelheid te lezen is.
 */
function packageFromTitle(title: string) {
  const segments = title.split('|').map((part) => part.trim()).filter(Boolean);
  if (segments.at(-1)?.toLowerCase() === 'delhaize') segments.pop();
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    const parsed = parseQuantityLabel(segments[i]!);
    if (parsed) return parsed;
  }
  return null;
}

export function parseDelhaizeProductPage(input: DelhaizePageInput): ParseResult {
  const id = PRODUCT_ID.exec(input.url)?.[1];
  if (!id) return { ok: false, kind: 'unreadable', reason: 'geen productcode in de URL' };

  const product = flattenLd(input.jsonLd).find(isProduct);
  if (!product) return { ok: false, kind: 'unreadable', reason: 'geen schema.org Product op de pagina' };

  const name = text(product.name)?.replace(/\s*\|\s*/g, ' ');
  if (!name) return { ok: false, kind: 'unreadable', reason: 'Product zonder naam' };

  const priced = priceOf(product.offers);
  if (!priced) return { ok: false, kind: 'unreadable', reason: 'Product zonder prijs' };
  if (priced.currency && priced.currency.toUpperCase() !== 'EUR') {
    return { ok: false, kind: 'skipped', reason: `prijs in ${priced.currency}, niet in EUR` };
  }
  if (priced.basis.kind === 'measure') return { ok: false, kind: 'skipped', reason: REASON_PER_MEASURE(priced.basis.unit) };
  if (priced.basis.kind === 'unknown') return { ok: false, kind: 'skipped', reason: REASON_UNKNOWN_UNIT(priced.basis.code) };

  const brandNode = asObject(product.brand);
  const brand = text(brandNode?.name) ?? text(product.brand);
  const pack = packageFromTitle(input.title);

  return {
    ok: true,
    product: {
      externalId: id,
      name: name.slice(0, 200),
      brand: brand ? brand.slice(0, 80) : null,
      categoryPath: text(product.category)?.slice(0, 200) ?? null,
      productUrl: (text(product.url) ?? input.url).slice(0, 500),
      packageQuantity: pack?.quantity ?? null,
      packageUnit: pack?.unit ?? null,
      packCount: pack?.packCount ?? 1,
      priceCents: Math.round(priced.price * 100),
      availability: availabilityOf(product.offers),
    },
  };
}
