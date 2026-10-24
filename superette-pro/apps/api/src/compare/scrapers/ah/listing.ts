/**
 * Albert Heijn België — producten uit een ZELF OPGESLAGEN zoek- of
 * categoriepagina van ah.be (Ctrl+S in je eigen browser).
 *
 * Overgenomen uit de proef "gratis supermarkt-scraper" (extractAH), met
 * deze bewuste keuzes:
 *  - GEEN live ophalen. ah.be weigert geautomatiseerde bezoekers (HTTP 403
 *    voor onze eerlijke bot, 7 oktober 2026). De proef deed zich voor als
 *    browser ("User-Agent: Mozilla/5.0"); dat nemen we niet over. Een pagina
 *    die jij zelf bezoekt en bewaart, is gewoon menselijk gebruik.
 *  - Alleen de resultatenlijst (`products: [...]` met `__typename: "Product"`),
 *    geen bonusbanners of aanbevelingen.
 *  - Alleen ah.be in het Belgisch-Nederlands (`lang="nl-BE"`); ah.nl wordt
 *    geweigerd.
 *  - Promoties worden nooit stil de gewone prijs:
 *      * geen korting            → prijs = `now`
 *      * korting op één artikel  → prijs = `now`, oude prijs = `was`, TEMPORARY
 *      * korting op meerdere     → prijs = `was` (de gewone stukprijs) en de
 *        artikelen ("2 voor …")    actietekst als voorwaarde; zonder `was`
 *                                  overslaan (stukprijs niet te kennen)
 *  - Inhoud uit `salesUnitSize` ("1 l"); "ca."/"per kg" = wisselend gewicht →
 *    overgeslagen, zoals bij Delhaize en ALDI.
 *
 * Zuivere functies, geen netwerk.
 */
import { parseQuantityLabel } from '@superette/pricing';
import type { Availability } from '@superette/contracts';
import type { AhFeedProduct } from './feed';

export interface AhListingResult {
  readonly products: AhFeedProduct[];
  readonly skipped: Record<string, number>;
}

const PRODUCT_PATH = /^\/producten\/product\/(wi\d{3,12})(?:\/[a-z0-9-]*)?$/;
const VARIABLE_WEIGHT = /\bca\.|±|\+\/-|\bper\s*(kg|kilo|100\s*g|stuk)\b/i;
const BLOCK_PAGE = /sec-if-cpt-container|<title>[^<]*(?:Access Denied|AntiBot)|automated queries/i;

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!value || typeof value !== 'object') return;
  visit(value as Record<string, unknown>);
  for (const child of Object.values(value)) walk(child, visit);
}

/**
 * Controleert of de HTML een Belgische ah.be-pagina is en geen blokkadepagina.
 * Geeft een reden terug als dat niet zo is, anders `null`.
 */
export function rejectAhPage(html: string): string | null {
  if (BLOCK_PAGE.test(html)) return 'de pagina is een toegangscontrole, geen productpagina';
  if (!/<html[^>]*\blang=["']nl-BE["']/i.test(html)) return 'geen Belgisch-Nederlandse pagina (lang="nl-BE" ontbreekt)';
  if (!/https:\/\/www\.ah\.be\b/.test(html)) return 'geen verwijzing naar www.ah.be; is dit wel een ah.be-pagina?';
  if (/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ah\.nl/i.test(html)) return 'Nederlandse pagina (ah.nl); alleen ah.be is toegelaten';
  return null;
}

export function extractAhListing(html: string): AhListingResult {
  const found = new Map<string, AhFeedProduct>();
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);

  for (const match of html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs)) {
    let payload: unknown;
    try {
      payload = (JSON.parse(match[1]!) as unknown[])[1];
    } catch {
      continue;
    }
    if (typeof payload !== 'string') continue;

    for (const line of payload.split('\n')) {
      let value: unknown;
      try {
        value = JSON.parse(line.slice(line.indexOf(':') + 1));
      } catch {
        continue;
      }
      walk(value, (node) => {
        // Alleen de resultatenlijst; bonusbanners en aanbevelingen hebben geen `products`-array.
        if (!Array.isArray(node.products)) return;
        for (const raw of node.products as Record<string, unknown>[]) {
          if (!raw || raw.__typename !== 'Product' || typeof raw.title !== 'string') continue;
          const id = typeof raw.webPath === 'string' ? PRODUCT_PATH.exec(raw.webPath)?.[1] : undefined;
          if (!id) continue;
          if (found.has(id)) continue;

          const price = (raw.priceV2 ?? {}) as Record<string, Record<string, unknown> | null | undefined>;
          const now = money(price.now?.amount);
          if (now === null || now === 0) {
            skip('geen prijs');
            continue;
          }
          const was = money(price.was?.amount);
          const discount = (price.discount ?? null) as { description?: unknown; multipleItemPromotion?: unknown } | null;
          const description = typeof discount?.description === 'string' ? discount.description.trim().slice(0, 200) : null;

          const size = typeof raw.salesUnitSize === 'string' ? raw.salesUnitSize.trim() : null;
          if (size && VARIABLE_WEIGHT.test(size)) {
            skip('wisselend gewicht (ca./per kg), geen vaste verpakkingsprijs');
            continue;
          }
          const pack = size ? parseQuantityLabel(size) : null;

          let priceCents: number;
          let offer: AhFeedProduct['offer'];
          if (!discount) {
            priceCents = Math.round(now * 100);
          } else if (discount.multipleItemPromotion === true) {
            if (was === null) {
              skip('actie op meerdere artikelen zonder gewone stukprijs');
              continue;
            }
            priceCents = Math.round(was * 100);
            offer = {
              conditions: description ? `Actie bij AH: ${description} (geldt bij aankoop van meerdere artikelen).` : null,
            };
          } else {
            priceCents = Math.round(now * 100);
            offer =
              was !== null && was > now
                ? { originalPriceCents: Math.round(was * 100), promotionType: 'TEMPORARY', promotionText: description }
                : { promotionText: description };
          }

          const orderable = (raw.availability as { isOrderable?: unknown } | undefined)?.isOrderable;
          const availability: Availability = orderable === true ? 'IN_STOCK' : orderable === false ? 'OUT_OF_STOCK' : 'UNKNOWN';
          const brand = typeof raw.brand === 'string' && raw.brand.trim() !== '' ? raw.brand.trim().slice(0, 80) : null;

          found.set(id, {
            externalId: id,
            name: raw.title.trim().slice(0, 200),
            brand,
            barcode: null,
            productUrl: `https://www.ah.be/producten/product/${id}`,
            packageQuantity: pack?.quantity ?? null,
            packageUnit: pack?.unit ?? null,
            packCount: pack?.packCount ?? 1,
            priceCents,
            availability,
            categoryPath: null,
            ...(offer ? { offer } : {}),
          });
        }
      });
    }
  }
  return { products: [...found.values()], skipped };
}
