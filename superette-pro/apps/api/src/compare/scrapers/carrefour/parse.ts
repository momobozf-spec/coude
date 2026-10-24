import { parseQuantityLabel } from '@superette/pricing';
import type { PackageUnit } from '@superette/pricing';

export interface CarrefourTileInput {
  id: string | null;
  name: string | null;
  brand: string | null;
  href: string | null;
  priceContent: string | null;
  priceText: string | null;
  packageText: string | null;
  promotionText: string | null;
  hasStrikePrice: boolean;
  tracking: string | null;
}

export interface CarrefourProduct {
  externalId: string;
  name: string;
  brand: string | null;
  barcode: null;
  productUrl: string;
  categoryPath: string | null;
  packageQuantity: number | null;
  packageUnit: PackageUnit | null;
  packCount: number;
  priceCents: number;
}

export type CarrefourParseResult = { ok: true; product: CarrefourProduct } | { ok: false; reason: string };

export function rejectCarrefourPage(html: string): string | null {
  if (/sec-if-cpt-container|<title>[^<]*(?:Access Denied|AntiBot|Captcha|Just a moment)/i.test(html)) return 'toegangscontrole';
  const canonicalTag = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(html)?.[0];
  const canonical = canonicalTag ? /\bhref=["']([^"']+)["']/i.exec(canonicalTag)?.[1] : null;
  if (!canonical) return 'Belgische canonical ontbreekt';
  try {
    const url = new URL(canonical);
    if (url.origin !== 'https://www.carrefour.be' || !url.pathname.startsWith('/nl/')) return 'geen Belgische Nederlandstalige Carrefour-bron';
  } catch { return 'ongeldige canonical'; }
  return null;
}

function cents(value: string | null): number | null {
  if (!value || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const result = Math.round(Number(value.trim().replace(',', '.')) * 100);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

export function parseCarrefourTile(tile: CarrefourTileInput, category: string | null): CarrefourParseResult {
  const fail = (reason: string): CarrefourParseResult => ({ ok: false, reason });
  if (!tile.id || !/^\d{1,64}$/.test(tile.id)) return fail('geen geldige productcode');
  const name = tile.name?.trim();
  if (!name || name.length > 200 || name.includes('\ufffd')) return fail('ontbrekende of beschadigde productnaam');
  if (/\bca\.|\bcirca\b|±|\+\s*\/\s*-|\b(?:KGM|LTR)\b/i.test(`${name} ${tile.packageText ?? ''}`)) return fail('wisselend gewicht of eenheidscode');
  // Deze bronpagina bevestigt "Per stuk". Andere verkoopbasissen eerst onderzoeken.
  if (tile.packageText?.trim().toLowerCase() !== 'per stuk') return fail('geen bevestigde stuk- of verpakkingsprijs');
  if (tile.promotionText?.trim() || tile.hasStrikePrice) return fail('promotie nog niet ondersteund; product overgeslagen');
  let url: URL;
  try { url = new URL(tile.href ?? '', 'https://www.carrefour.be'); } catch { return fail('ongeldige productlink'); }
  if (url.origin !== 'https://www.carrefour.be' || !url.pathname.startsWith('/nl/') || !url.pathname.endsWith(`/${tile.id}.html`)) return fail('productlink en productcode verschillen');
  const priceCents = cents(tile.priceContent);
  const visible = tile.priceText ? /^(\d+(?:[.,]\d{1,2})?)\s*€$/.exec(tile.priceText.trim()) : null;
  if (priceCents === null || !visible || cents(visible[1]!) !== priceCents) return fail('geen eenduidige zichtbare europrijs');
  if (tile.tracking) {
    try {
      const data = JSON.parse(tile.tracking) as { ecommerce?: { items?: { item_id?: unknown; currency?: unknown; price?: unknown }[] } };
      const items = data.ecommerce?.items;
      const item = items?.length === 1 ? items[0] : undefined;
      if (!item || String(item.item_id) !== tile.id || item.currency !== 'EUR' || typeof item.price !== 'number' || Math.round(item.price * 100) !== priceCents) return fail('tracking en zichtbare productprijs spreken elkaar tegen');
    } catch { return fail('onleesbare productmetadata'); }
  }
  // Alleen een expliciete inhoud aan het einde van de naam; geen afleiding uit prijs/liter.
  const size = /(?:^|\s)((?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l|stuks?))$/i.exec(name)?.[1];
  const pack = size ? parseQuantityLabel(size) : null;
  return { ok: true, product: {
    externalId: tile.id, name, brand: tile.brand?.trim().slice(0, 80) || null,
    barcode: null, productUrl: url.href, categoryPath: category,
    packageQuantity: pack?.quantity ?? null, packageUnit: pack?.unit ?? null,
    packCount: pack?.packCount ?? 1, priceCents,
  } };
}
