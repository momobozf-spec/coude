/**
 * Albert Heijn België — van een publieke productpagina naar product + aanbieding.
 *
 * Bron: het schema.org `Product`-blok (JSON-LD) dat ah.be server-side in elke
 * productpagina zet. Vastgesteld op 6 oktober 2026 op
 * `/producten/product/wi604571/houdbare-half-volle-melk-bel`:
 *
 *   name     "Houdbare half volle melk bel reserveren | Albert Heijn"   ← SEO-achtervoegsel
 *   sku      "wi604571"
 *   gtin13   "8719587243909"                                           ← EAN, goud voor matching
 *   weight   { value: "1 l" }
 *   offers   { price: "0.85", priceCurrency: "EUR", availability: InStock }
 *
 * Geen merk in de JSON-LD (bij dit product ook niet op de pagina). Geen
 * promoties: alleen de actuele prijs. Afbeeldingen en omschrijvingen nemen we
 * niet over.
 *
 * Zuivere functie, geen netwerk.
 */
import { parseQuantityLabel } from '@superette/pricing';
import type { Availability } from '@superette/contracts';

export interface AhPageInput {
  readonly url: string;
  readonly jsonLd: readonly string[];
}

export interface ParsedAhProduct {
  readonly externalId: string;
  readonly name: string;
  readonly barcode: string | null;
  readonly productUrl: string;
  readonly packageQuantity: number | null;
  readonly packageUnit: 'G' | 'KG' | 'ML' | 'CL' | 'L' | 'PIECE' | null;
  readonly packCount: number;
  readonly priceCents: number;
  readonly availability: Availability;
}

/**
 * `unreadable`: de pagina had niet wat we verwachtten (veel op rij = blokkade?).
 * `skipped`: leesbaar, maar bewust niet opgenomen (bv. alleen een kiloprijs).
 */
export type AhParseResult =
  | { readonly ok: true; readonly product: ParsedAhProduct }
  | { readonly ok: false; readonly kind: 'unreadable' | 'skipped'; readonly reason: string };

/**
 * Prijs per gewicht/volume (UN/CEFACT-code in `eligibleQuantity` of
 * `referenceQuantity`) is GEEN verpakkingsprijs. Zelfde les als bij Delhaize
 * (Rosbief: € 36,69 per kg werd € 36,69 voor 180 g). C62/H87 = per stuk.
 */
const PER_MEASURE: Readonly<Record<string, string>> = { KGM: 'kg', GRM: 'g', LTR: 'l', MLT: 'ml', CLT: 'cl' };
const PER_PIECE = new Set(['C62', 'H87']);

function priceBasisProblem(spec: Record<string, unknown> | null): string | null {
  const quantity = asObject(spec?.eligibleQuantity) ?? asObject(spec?.referenceQuantity);
  if (!quantity) return null;
  const code = (text(quantity.unitCode) ?? '').toUpperCase();
  const measure = PER_MEASURE[code];
  if (measure) return `alleen een prijs per ${measure} (wisselend gewicht), geen vaste verpakkingsprijs`;
  const value = typeof quantity.value === 'number' ? quantity.value : Number(quantity.value ?? 1);
  if (PER_PIECE.has(code) && value === 1) return null;
  return `prijs per onbekende eenheid "${value} ${code || '(leeg)'}"`;
}

const PRODUCT_ID = /\/producten\/product\/(wi\d{3,12})(?:[/?#]|$)/;
const SEO_SUFFIX = /\s+reserveren\s*\|\s*Albert Heijn\s*$/i;

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function findProduct(blocks: readonly string[]): Record<string, unknown> | null {
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const object = asObject(node);
      if (object && object['@type'] === 'Product') return object;
    }
  }
  return null;
}

/** EAN-13 of EAN-8 met geldig controlecijfer; anders `null` (nooit een kapotte barcode doorgeven). */
export function validEan(value: unknown): string | null {
  const code = text(value);
  if (!code || !/^\d{8}$|^\d{13}$/.test(code)) return null;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? code : null;
}

export function parseAhProductPage(input: AhPageInput): AhParseResult {
  const id = PRODUCT_ID.exec(input.url)?.[1];
  if (!id) return { ok: false, kind: 'unreadable', reason: 'geen productcode in de URL' };

  const product = findProduct(input.jsonLd);
  if (!product) return { ok: false, kind: 'unreadable', reason: 'geen schema.org Product op de pagina' };

  const name = text(product.name)?.replace(SEO_SUFFIX, '').trim();
  if (!name) return { ok: false, kind: 'unreadable', reason: 'Product zonder naam' };

  const offer = asObject(Array.isArray(product.offers) ? product.offers[0] : product.offers);
  const spec = asObject(offer?.priceSpecification);
  const direct = offer?.price !== undefined && offer?.price !== null;
  const rawPrice = direct ? offer?.price : spec?.price;
  const price = typeof rawPrice === 'number' ? rawPrice : typeof rawPrice === 'string' ? Number(rawPrice.replace(',', '.')) : NaN;
  if (!Number.isFinite(price) || price <= 0) return { ok: false, kind: 'unreadable', reason: 'Product zonder prijs' };
  const currency = text(offer?.priceCurrency) ?? text(spec?.priceCurrency);
  if (currency && currency.toUpperCase() !== 'EUR') return { ok: false, kind: 'skipped', reason: `prijs in ${currency}, niet in EUR` };
  if (!direct) {
    const problem = priceBasisProblem(spec);
    if (problem) return { ok: false, kind: 'skipped', reason: problem };
  }

  const availabilityText = text(offer?.availability) ?? '';
  const availability: Availability = /InStock|LimitedAvailability/i.test(availabilityText)
    ? 'IN_STOCK'
    : /OutOfStock|SoldOut|Discontinued/i.test(availabilityText)
      ? 'OUT_OF_STOCK'
      : 'UNKNOWN';

  // Inhoud uit `weight.value` ("1 l", "6 x 33 cl"); anders uit de naam. Nooit raden.
  const weight = text(asObject(product.weight)?.value);
  const pack = (weight ? parseQuantityLabel(weight) : null) ?? parseQuantityLabel(name);

  return {
    ok: true,
    product: {
      externalId: id,
      name: name.slice(0, 200),
      barcode: validEan(product.gtin13 ?? product.gtin),
      productUrl: `https://www.ah.be/producten/product/${id}`,
      packageQuantity: pack?.quantity ?? null,
      packageUnit: pack?.unit ?? null,
      packCount: pack?.packCount ?? 1,
      priceCents: Math.round(price * 100),
      availability,
    },
  };
}
