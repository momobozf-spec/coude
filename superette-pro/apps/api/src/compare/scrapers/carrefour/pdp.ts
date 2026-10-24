/**
 * Carrefour België — één publieke productpagina (PDP) → product.
 *
 * Bron: carrefour.be/nl/<slug>/<code>.html, zoals de officiële sitemap ze noemt
 * (sitemap_index.xml). Vastgesteld op 24 oktober 2026; robots.txt laat deze
 * pagina's toe (alleen winkelmand, account, zoeken en filters zijn verboden).
 *
 * Een pagina bevat de prijs op drie plaatsen. We nemen een product alleen over
 * als die drie exact overeenkomen:
 *   1. schema.org JSON-LD   {"@type":"Product", "sku", "offers":{"price","priceCurrency"}}
 *   2. zichtbare prijs      <span class="sales"> … <span class="value" content="6.25"> … <span>6,25 €</span>
 *   3. analytics            js-pdp-analytics → ecommerce.items[0] {item_id, price, currency}
 * Daarnaast moet de inhoud ("250g") kloppen met de eenheidsprijs die Carrefour
 * zelf vermeldt ("25,00 €/kg"), tot op 1 cent. Klopt die niet, dan nemen we de
 * inhoud niet over. Nooit raden.
 *
 * Promoties (doorgestreepte prijs, promolabel) slaan we over tot de voorwaarden
 * ondersteund zijn, net als bij de opgeslagen categoriepagina's.
 *
 * Zuivere functie, geen netwerk.
 */
import { parseQuantityLabel, toBaseQuantity, type PackageUnit } from '@superette/pricing';
import { rejectCarrefourPage, type CarrefourProduct } from './parse';

export const CARREFOUR_ORIGIN = 'https://www.carrefour.be';
/** Productpagina's in het Nederlands: /nl/<slug>/<8 cijfers>.html */
export const CARREFOUR_PDP_PATH = /^\/nl\/[a-z0-9-]+\/(\d{6,14})\.html$/;

export type CarrefourAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface CarrefourPdpProduct extends CarrefourProduct {
  readonly availability: CarrefourAvailability;
}

export type CarrefourPdpResult =
  | { ok: true; product: CarrefourPdpProduct }
  | { ok: false; kind: 'skipped' | 'unreadable'; reason: string };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_, dec: string) => String.fromCodePoint(Number(dec)));
}

function squash(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function toCents(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text.replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function jsonLdProduct(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]!) as unknown;
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        if (item && typeof item === 'object' && (item as { '@type'?: unknown })['@type'] === 'Product') {
          return item as Record<string, unknown>;
        }
      }
    } catch {
      // onleesbaar blok: verder zoeken, het eindoordeel volgt hieronder
    }
  }
  return null;
}

function analyticsItem(html: string): { id: string; price: number; currency: string; brand: string | null } | null {
  const tag = /<[^>]+class=["'][^"']*js-pdp-analytics[^"']*["'][^>]*>/i.exec(html)?.[0];
  const raw = tag ? /\bcontent='([^']*)'/.exec(tag)?.[1] ?? /\bcontent="([^"]*)"/.exec(tag)?.[1] : null;
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeEntities(raw)) as { ecommerce?: { items?: { item_id?: unknown; price?: unknown; currency?: unknown; item_brand?: unknown }[] } };
    const items = data.ecommerce?.items;
    const item = items?.length === 1 ? items[0] : undefined;
    if (!item || typeof item.price !== 'number' || typeof item.currency !== 'string') return null;
    return { id: String(item.item_id), price: item.price, currency: item.currency, brand: typeof item.item_brand === 'string' ? item.item_brand : null };
  } catch {
    return null;
  }
}

function section(html: string, className: string): string | null {
  const start = new RegExp(`<div[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i').exec(html);
  if (!start) return null;
  // Tot de volgende wrapper of maximaal 4000 tekens: genoeg voor één prijsblok.
  const rest = html.slice(start.index + start[0].length, start.index + start[0].length + 4000);
  const end = rest.search(/<div[^>]+class=["'][^"']*-wrapper\b/i);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function breadcrumb(html: string): string | null {
  const desktop = /<div[^>]+class=["'][^"']*desktop-breadcrumb[^"']*["'][^>]*>([\s\S]*?)<div[^>]+class=["'][^"']*mobile-breadcrumb/i.exec(html)?.[1];
  if (!desktop) return null;
  const names = [...desktop.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => squash(m[1]!)).filter(Boolean);
  const path = names.filter((name) => name.toLowerCase() !== 'home');
  return path.length ? path.join(' > ').slice(0, 200) : null;
}

/** Eenheidsprijs zoals Carrefour ze toont: "25,00 €/kg", "1,35 €/l", "0,42 €/st". */
function unitPrice(text: string | null): { cents: number; per: 'KG' | 'L' | 'PIECE' } | null {
  if (!text) return null;
  const match = /(\d+[.,]\d{2})\s*\S{0,3}\s*\/\s*(kg|l|st|stuk)\b/i.exec(text);
  if (!match) return null;
  const cents = toCents(match[1]!);
  const per = match[2]!.toLowerCase() === 'kg' ? 'KG' : match[2]!.toLowerCase() === 'l' ? 'L' : 'PIECE';
  return cents === null ? null : { cents, per };
}

/** Alle hoeveelheden in een productnaam, multipacks eerst: "6 x 33 cl", "140 g", "1,5 L". */
function quantityMentions(name: string): string[] {
  const multipacks = [...name.matchAll(/\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l)\b/gi)].map((m) => m[0]);
  const singles = [...name.matchAll(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l)\b/gi)].map((m) => m[0]);
  return [...multipacks, ...singles];
}

export function parseCarrefourProductPage(url: string, html: string): CarrefourPdpResult {
  const skip = (reason: string): CarrefourPdpResult => ({ ok: false, kind: 'skipped', reason });
  const broken = (reason: string): CarrefourPdpResult => ({ ok: false, kind: 'unreadable', reason });

  const rejected = rejectCarrefourPage(html);
  if (rejected) return broken(rejected);

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { return broken('ongeldige URL'); }
  const code = CARREFOUR_PDP_PATH.exec(parsedUrl.pathname)?.[1];
  if (parsedUrl.origin !== CARREFOUR_ORIGIN || !code) return skip('geen Nederlandstalige Carrefour-productpagina');

  const ld = jsonLdProduct(html);
  if (!ld) return broken('geen schema.org Product');
  const sku = typeof ld.sku === 'string' ? ld.sku : typeof ld.mpn === 'string' ? ld.mpn : null;
  if (sku !== code) return broken('productcode in de pagina verschilt van de URL');
  const offers = (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) as Record<string, unknown> | undefined;
  if (!offers || offers.priceCurrency !== 'EUR') return skip('geen europrijs');
  const ldCents = toCents(offers.price);
  if (ldCents === null) return skip('geen prijs in schema.org');

  const pricing = section(html, 'price-wrapper');
  if (!pricing) return broken('prijsblok ontbreekt');
  if (/strike|\blist\b|price-old|promo/i.test(pricing)) return skip('promotie nog niet ondersteund; product overgeslagen');
  const tags = section(html, 'tags-wrapper');
  if (tags && squash(tags)) return skip('promolabel aanwezig; product overgeslagen');
  const contentCents = toCents(/<span[^>]+class=["']value["'][^>]*\bcontent=["']([^"']+)["']/i.exec(pricing)?.[1] ?? null);
  // Het eerste bedrag in het zichtbare prijsblok; niet afhankelijk van hoe het €-teken gecodeerd is.
  const visible = /(\d+[.,]\d{2})/.exec(squash(pricing));
  const visibleCents = visible ? toCents(visible[1]!) : null;
  if (contentCents !== ldCents || visibleCents !== ldCents) return broken('zichtbare prijs en schema.org spreken elkaar tegen');

  const tracking = analyticsItem(html);
  if (!tracking || tracking.id !== code || tracking.currency !== 'EUR' || Math.round(tracking.price * 100) !== ldCents) {
    return broken('analytics en zichtbare prijs spreken elkaar tegen');
  }

  const name = typeof ld.name === 'string' ? decodeEntities(ld.name).trim() : '';
  if (!name || name.length > 200 || name.includes('�')) return broken('ontbrekende of beschadigde productnaam');
  const brandField = ld.brand as { name?: unknown } | string | undefined;
  const brand = (typeof brandField === 'string' ? brandField : typeof brandField?.name === 'string' ? brandField.name : null) ?? tracking.brand;

  // Inhoud: alleen overnemen als ze Carrefours eigen eenheidsprijs exact verklaart (op 1 cent).
  // Kandidaten: eerst het verpakkingsveld, dan elke hoeveelheid in de naam ("4 Stuks 140 g" → 140 g).
  let packageQuantity: number | null = null;
  let packageUnit: PackageUnit | null = null;
  let packCount = 1;
  const perUnit = unitPrice(squash(section(html, 'price-per-unit-wrapper') ?? ''));
  if (perUnit) {
    const packageText = squash(section(html, 'package-info-wrapper') ?? '');
    const candidates = [packageText, ...quantityMentions(name)];
    for (const text of candidates) {
      const pack = text ? parseQuantityLabel(text) : null;
      if (!pack) continue;
      const base = toBaseQuantity(pack.quantity * pack.packCount, pack.unit);
      if (!base || base.unit !== perUnit.per) continue;
      const expected = base.unit === 'PIECE' ? Math.round(ldCents / base.amount) : Math.round((ldCents * 1000) / base.amount);
      if (Math.abs(expected - perUnit.cents) <= 1) {
        packageQuantity = pack.quantity;
        packageUnit = pack.unit;
        packCount = pack.packCount;
        break;
      }
    }
  }

  const availabilityText = typeof offers.availability === 'string' ? offers.availability : '';
  const availability: CarrefourAvailability = /InStock$/i.test(availabilityText)
    ? 'IN_STOCK'
    : /OutOfStock$/i.test(availabilityText)
      ? 'OUT_OF_STOCK'
      : 'UNKNOWN';

  return {
    ok: true,
    product: {
      externalId: code,
      name,
      brand: brand ? decodeEntities(brand).trim().slice(0, 80) || null : null,
      barcode: null,
      productUrl: `${CARREFOUR_ORIGIN}${parsedUrl.pathname}`,
      categoryPath: breadcrumb(html),
      packageQuantity,
      packageUnit,
      packCount,
      priceCents: ldCents,
      availability,
    },
  };
}

/** Productlinks uit een Carrefour-sitemap: alleen Nederlandstalige productpagina's, zonder dubbels. */
export function carrefourProductUrlsFromSitemap(xml: string): string[] {
  const urls = new Set<string>();
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]!));
      if (url.origin === CARREFOUR_ORIGIN && CARREFOUR_PDP_PATH.test(url.pathname) && !url.search) urls.add(url.href);
    } catch {
      // ongeldige loc negeren
    }
  }
  return [...urls];
}
