/**
 * Geparste Albert Heijn België-producten → importbestand (`albert-heijn.json`).
 *
 * De bestandsnaam en de keten-slug volgen de bestaande adapter
 * (`adapters/albert-heijn.adapter.ts`, key en slug `albert-heijn`), zodat
 * `npm run compare:sync -- albert-heijn` het bestand oppikt.
 *
 * Bron en status zoals bij Delhaize: `IMPORT_FILE`, `termsReviewed: false`
 * (de app toont de prijzen als niet geverifieerd), kanaal `BOTH` met de
 * expliciete voorwaarde dat het de webshopprijs is. Alleen ah.be — Belgische
 * prijzen, nooit ah.nl.
 *
 * Twee bronnen leveren producten aan:
 *  - `parse.ts`   — één productpagina (schema.org, met EAN);
 *  - `listing.ts` — een zelf opgeslagen zoek-/categoriepagina (met merk en
 *    actie-info, zonder EAN).
 */
import { feedFileSchema, type FeedFile } from '../../adapters/feed-schema';
import type { ParsedAhProduct } from './parse';

export const AH_SOURCE_LABEL = 'Publieke productpagina’s ah.be (schema.org-gegevens)';
export const AH_SAVED_PAGES_LABEL = 'Zelf opgeslagen pagina’s van ah.be';

export interface AhFeedProduct extends ParsedAhProduct {
  /** Categorie zoals de categoriepagina waar het product gevonden werd ze noemt. */
  readonly categoryPath: string | null;
  readonly brand?: string | null;
  /** Actie-informatie; zonder dit veld is het een gewone prijs. */
  readonly offer?: {
    readonly originalPriceCents?: number | null;
    readonly promotionType?: 'TEMPORARY';
    readonly promotionText?: string | null;
    readonly conditions?: string | null;
  };
}

export interface AhFeedOptions {
  readonly label?: string;
  readonly notes?: string;
}

const DEFAULT_NOTES =
  'Automatisch verzameld uit de schema.org Product-gegevens op publieke productpagina’s van ah.be, ' +
  'met respect voor robots.txt en een vertraging tussen verzoeken. Geen promoties: alleen de ' +
  'actuele webshopprijs. Geen afbeeldingen of omschrijvingen overgenomen.';

const BASE_CONDITIONS = 'Prijs van de Albert Heijn-webshop (ah.be); in de winkel kan ze afwijken.';

export function buildAhFeed(products: readonly AhFeedProduct[], observedAt: Date, options: AhFeedOptions = {}): FeedFile {
  // Eén rij per productcode, ook als een product in meerdere categorieën stond.
  const unique = new Map<string, AhFeedProduct>();
  for (const product of products) if (!unique.has(product.externalId)) unique.set(product.externalId, product);

  const feed = {
    version: 1 as const,
    chain: {
      slug: 'albert-heijn',
      name: 'Albert Heijn',
      websiteUrl: 'https://www.ah.be',
      loyaltyCardName: 'Bonuskaart',
    },
    source: {
      kind: 'IMPORT_FILE' as const,
      label: options.label ?? AH_SOURCE_LABEL,
      termsReviewed: false,
      notes: options.notes ?? DEFAULT_NOTES,
    },
    observedAt: observedAt.toISOString(),
    locations: [],
    products: [...unique.values()].map((product) => ({
      externalId: product.externalId,
      name: product.name,
      brand: product.brand ?? null,
      barcode: product.barcode,
      productUrl: product.productUrl,
      categoryPath: product.categoryPath,
      packageQuantity: product.packageQuantity,
      packageUnit: product.packageUnit,
      packCount: product.packCount,
    })),
    offers: [...unique.values()].map((product) => ({
      productExternalId: product.externalId,
      sourceReference: `${product.externalId}:web`,
      priceCents: product.priceCents,
      promotionType: product.offer?.promotionType ?? ('NONE' as const),
      ...(product.offer?.originalPriceCents ? { originalPriceCents: product.offer.originalPriceCents } : {}),
      ...(product.offer?.promotionText ? { promotionText: product.offer.promotionText } : {}),
      channel: 'BOTH' as const,
      conditions: product.offer?.conditions ? `${BASE_CONDITIONS} ${product.offer.conditions}` : BASE_CONDITIONS,
      availability: product.availability,
      observedAt: observedAt.toISOString(),
      confidence: 0.8,
    })),
  };

  return feedFileSchema.parse(feed);
}
