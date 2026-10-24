/**
 * ALDI België — van een publieke productpagina naar product + aanbieding.
 *
 * Vastgesteld op 7 oktober 2026 op `https://www.aldi.be/product/coca-cola-zero-6057.html`:
 *
 *   JSON-LD Product   name "Coca-Cola zero", sku "6057",
 *                     brand { name: "COCA-COLA®" },
 *                     offers { price: 1.79, priceCurrency: "EUR", availability: InStock }
 *   JSON-LD BreadcrumbList  … / "Water, frisdrank, sappen en siroop" / "Frisdrank" / <product>
 *   zichtbaar         "1.79", daaronder "1 l" in `span.tag__marker--salesunit`
 *
 * De INHOUD staat niet in de JSON-LD, alleen zichtbaar op de pagina (de
 * "verkoopeenheid"). De scraper geeft die tekst mee als `salesUnit`.
 *
 * Een prijs per gewicht of volume (UN/CEFACT-code in eligibleQuantity /
 * referenceQuantity) is nooit een verpakkingsprijs. Een verkoopeenheid met
 * "ca.", "±", "+/-" of "per kg" betekent wisselend gewicht: bewust overgeslagen,
 * zoals bij Delhaize.
 *
 * Afbeeldingen en omschrijvingen nemen we niet over. Zuivere functie, geen netwerk.
 */
import { parseQuantityLabel } from '@superette/pricing';
import type { Availability } from '@superette/contracts';

export const ALDI_ORIGIN = 'https://www.aldi.be';

export interface AldiPageInput {
  readonly url: string;
  readonly jsonLd: readonly string[];
  /** Tekst van de zichtbare verkoopeenheid ("1 l", "6 x 33 cl"), of null. */
  readonly salesUnit: string | null;
}

export interface ParsedAldiProduct {
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
 * `unreadable`: niet wat we verwachtten (veel op rij = blokkade?).
 * `skipped`: leesbaar, maar bewust niet opgenomen.
 */
export type AldiParseResult =
  | { readonly ok: true; readonly product: ParsedAldiProduct }
  | { readonly ok: false; readonly kind: 'unreadable' | 'skipped'; readonly reason: string };

/** "/product/coca-cola-zero-6057.html" → "6057". */
export const PRODUCT_URL = /^https:\/\/www\.aldi\.be\/product\/(?:[a-z0-9-]+-)?(\d{2,10})\.html$/;
const PRODUCT_ID = PRODUCT_URL;
const VARIABLE_WEIGHT = /\bca\.|±|\+\/-|\bper\s*(kg|kilo|100\s*g)\b|\bkg-prijs\b/i;
const PER_MEASURE: Readonly<Record<string, string>> = { KGM: 'kg', GRM: 'g', LTR: 'l', MLT: 'ml', CLT: 'cl' };
const PER_PIECE = new Set(['C62', 'H87']);

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** HTML-entiteiten die ALDI soms laat staan ("LAY&apos;S" → "LAY'S"). */
function decodeEntities(value: string): string {
  return value
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&quot;|&#0?34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = decodeEntities(value).trim();
  return cleaned !== '' ? cleaned : null;
}

function nodes(blocks: readonly string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
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

const isType = (node: Record<string, unknown>, type: string) =>
  node['@type'] === type || (Array.isArray(node['@type']) && (node['@type'] as unknown[]).includes(type));

/** "COCA-COLA®" → "COCA-COLA". */
function cleanBrand(value: string | null): string | null {
  const cleaned = value?.replace(/[®™©]/g, '').trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

/** Kruimelpad zonder "ALDI België", "Producten" en het product zelf. */
function categoryFrom(all: Record<string, unknown>[]): string | null {
  const crumbs = all.find((node) => isType(node, 'BreadcrumbList'));
  const items = Array.isArray(crumbs?.itemListElement) ? (crumbs!.itemListElement as unknown[]) : [];
  const names = items
    .map((entry) => asObject(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((entry) => text(entry.name) ?? text(asObject(entry.item)?.name));
  // Positie 1 = ALDI België, 2 = Producten, laatste = het product.
  const middle = names.slice(2, -1).filter((name): name is string => name !== null);
  return middle.length > 0 ? middle.join('/').slice(0, 200) : null;
}

export function parseAldiProductPage(input: AldiPageInput): AldiParseResult {
  const id = PRODUCT_ID.exec(input.url)?.[1];
  if (!id) return { ok: false, kind: 'unreadable', reason: 'geen productcode in de URL' };

  const all = nodes(input.jsonLd);
  const product = all.find((node) => isType(node, 'Product'));
  if (!product) return { ok: false, kind: 'unreadable', reason: 'geen schema.org Product op de pagina' };

  const name = text(product.name);
  if (!name) return { ok: false, kind: 'unreadable', reason: 'Product zonder naam' };

  const offer = asObject(Array.isArray(product.offers) ? product.offers[0] : product.offers);
  const spec = asObject(offer?.priceSpecification);
  const direct = offer?.price !== undefined && offer?.price !== null;
  const raw = direct ? offer?.price : spec?.price;
  // Echte ALDI-pagina's kunnen een leesbaar Product/Offer in EUR hebben
  // zonder prijs (diagnose 8 oktober: kropsla, Chinese kool, sjalotten,
  // ijsbergsla). Geen prijs verzinnen en dit niet als botblokkade tellen.
  const offerTypes = offer?.['@type'];
  const recognizedOffer = offerTypes === 'Offer' || (Array.isArray(offerTypes) && offerTypes.includes('Offer'));
  const sourceCurrency = text(offer?.priceCurrency) ?? text(spec?.priceCurrency);
  if ((raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) && recognizedOffer && sourceCurrency?.toUpperCase() === 'EUR') {
    return { ok: false, kind: 'skipped', reason: 'leesbare ALDI-productpagina zonder vermelde prijs; product overgeslagen' };
  }
  const price = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.')) : NaN;
  if (!Number.isFinite(price) || price <= 0) return { ok: false, kind: 'unreadable', reason: 'Product zonder prijs' };
  const currency = text(offer?.priceCurrency) ?? text(spec?.priceCurrency);
  if (currency && currency.toUpperCase() !== 'EUR') return { ok: false, kind: 'skipped', reason: `prijs in ${currency}, niet in EUR` };

  if (!direct) {
    const quantity = asObject(spec?.eligibleQuantity) ?? asObject(spec?.referenceQuantity);
    if (quantity) {
      const code = (text(quantity.unitCode) ?? '').toUpperCase();
      const value = typeof quantity.value === 'number' ? quantity.value : Number(quantity.value ?? 1);
      if (PER_MEASURE[code]) {
        return { ok: false, kind: 'skipped', reason: `alleen een prijs per ${PER_MEASURE[code]} (wisselend gewicht), geen vaste verpakkingsprijs` };
      }
      if (!(PER_PIECE.has(code) && value === 1)) {
        return { ok: false, kind: 'skipped', reason: `prijs per onbekende eenheid "${value} ${code || '(leeg)'}"` };
      }
    }
  }

  const salesUnit = text(input.salesUnit);
  if (salesUnit && VARIABLE_WEIGHT.test(salesUnit)) {
    return { ok: false, kind: 'skipped', reason: 'wisselend gewicht (verkoopeenheid met ca./per kg), geen vaste verpakkingsprijs' };
  }
  const pack = salesUnit ? parseQuantityLabel(salesUnit) : null;

  const availabilityText = text(offer?.availability) ?? '';
  const availability: Availability = /InStock|LimitedAvailability|InStoreOnly|OnlineOnly/i.test(availabilityText)
    ? 'IN_STOCK'
    : /OutOfStock|SoldOut|Discontinued/i.test(availabilityText)
      ? 'OUT_OF_STOCK'
      : 'UNKNOWN';

  return {
    ok: true,
    product: {
      externalId: id,
      name: name.slice(0, 200),
      brand: cleanBrand(text(asObject(product.brand)?.name) ?? text(product.brand)),
      categoryPath: categoryFrom(all),
      productUrl: input.url.slice(0, 500),
      packageQuantity: pack?.quantity ?? null,
      packageUnit: pack?.unit ?? null,
      packCount: pack?.packCount ?? 1,
      priceCents: Math.round(price * 100),
      availability,
    },
  };
}
