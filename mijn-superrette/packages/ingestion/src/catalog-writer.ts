import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  brands,
  categories,
  productBarcodes,
  productMatches,
  products,
  productVariants,
  retailerProducts,
  retailers,
  type Database,
} from '@superrette/database';
import type { DataOrigin, MatchConfidence, MatchMethod, MatchStatus } from '@superrette/domain';
import { formatQuantity } from '@superrette/i18n';
import type { MatchCandidate, NormalizedProduct } from '@superrette/product-matching';
import { humanize, stripDiacritics } from '@superrette/shared';

type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/** Searchable text for trigram search: brand, name, canonical tokens. */
export function buildSearchText(n: NormalizedProduct): string {
  return [n.brand?.name.toLowerCase(), n.name, ...n.tokens].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function sizeLabelFor(n: NormalizedProduct): string | null {
  if (!n.netContent) return null;
  if (n.soldByWeight) return 'per kg';
  // Multipacks of measured items read "6 x 330 ml"; counted items read "12 stuks".
  if (n.packCount > 1 && n.quantity && n.quantity.unit !== 'piece') {
    return formatQuantity(n.quantity, { locale: 'nl', packCount: n.packCount });
  }
  return formatQuantity(humanize(n.netContent), { locale: 'nl' });
}

/** Retailer title without its quantity expression: "Coca-Cola Zero Sugar 1,5L" -> "Coca-Cola Zero Sugar". */
export function cleanTitle(title: string, quantitySource: string | null): string {
  let result = title;
  if (quantitySource) {
    const idx = stripDiacritics(title).toLowerCase().indexOf(quantitySource.toLowerCase());
    if (idx >= 0) result = `${title.slice(0, idx)} ${title.slice(idx + quantitySource.length)}`;
  }
  return result.replace(/\s+/g, ' ').replace(/[\s,/-]+$/g, '').trim() || title;
}

export async function upsertBrand(tx: Tx, n: NormalizedProduct): Promise<string | null> {
  if (!n.brand) return null;
  let privateLabelRetailerId: string | null = null;
  if (n.brand.privateLabelOf) {
    const [r] = await tx.select({ id: retailers.id }).from(retailers).where(eq(retailers.slug, n.brand.privateLabelOf));
    privateLabelRetailerId = r?.id ?? null;
  }
  const [row] = await tx
    .insert(brands)
    .values({ slug: n.brand.slug, name: n.brand.name, privateLabelRetailerId })
    .onConflictDoUpdate({ target: brands.slug, set: { updatedAt: new Date() } })
    .returning({ id: brands.id });
  return row!.id;
}

async function categoryIdFor(tx: Tx, slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const [row] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  return row?.id ?? null;
}

/** Attach GTINs to a variant; a GTIN already owned by another variant is left untouched (conflict for review). */
export async function attachBarcodes(tx: Tx, variantId: string, gtins: readonly string[], source: string): Promise<void> {
  if (gtins.length === 0) return;
  await tx
    .insert(productBarcodes)
    .values(gtins.map((gtin) => ({ gtin, variantId, source })))
    .onConflictDoNothing();
}

export interface CanonicalSource {
  title: string;
  normalized: NormalizedProduct;
  quantitySource: string | null;
  dataOrigin: DataOrigin;
  sourceProvider: string;
  imageUrl?: string | null;
}

/** Create Product + ProductVariant from a normalised retailer product. */
export async function createCanonical(tx: Tx, source: CanonicalSource): Promise<string> {
  const n = source.normalized;
  const brandId = await upsertBrand(tx, n);
  const categoryId = await categoryIdFor(tx, n.categorySlug);
  const name = cleanTitle(source.title, source.quantitySource);
  const [product] = await tx
    .insert(products)
    .values({
      name,
      brandId,
      categoryId,
      productType: n.productType,
      variantTokens: n.variants,
      flavours: n.flavours,
      dietary: n.dietary,
      imageUrl: source.imageUrl ?? null,
      dataOrigin: source.dataOrigin,
    })
    .returning({ id: products.id });
  const sizeLabel = sizeLabelFor(n);
  const [variant] = await tx
    .insert(productVariants)
    .values({
      productId: product!.id,
      displayName: sizeLabel && !(n.soldByWeight && /kilo|kg/i.test(name)) ? `${name} ${sizeLabel}` : name,
      quantityAmount: n.quantity?.amount ?? null,
      quantityUnit: n.quantity?.unit ?? null,
      packCount: n.packCount,
      netContentAmount: n.netContent?.amount ?? null,
      netContentUnit: n.netContent?.unit ?? null,
      soldByWeight: n.soldByWeight,
      sizeLabel,
      tokens: n.tokens,
      searchText: buildSearchText(n),
      signature: n.signature,
      normalized: n as unknown as Record<string, unknown>,
      // Without a GTIN we cannot be sure this is not a duplicate: flag for review.
      needsReview: n.gtins.length === 0,
      imageUrl: source.imageUrl ?? null,
      dataOrigin: source.dataOrigin,
    })
    .returning({ id: productVariants.id });
  await attachBarcodes(tx, variant!.id, n.gtins, source.sourceProvider);
  return variant!.id;
}

/** Candidate canonical variants for matching: GTIN hits, same signature, or trigram-similar text. */
export async function findCandidates(tx: Tx, n: NormalizedProduct, limit = 25): Promise<MatchCandidate[]> {
  const text = buildSearchText(n);
  const gtinArray = n.gtins.length > 0 ? sql`ARRAY[${sql.join(n.gtins.map((g) => sql`${g}`), sql`, `)}]::text[]` : sql`ARRAY[]::text[]`;
  const rows = await tx.execute<{ id: string; normalized: NormalizedProduct }>(sql`
    SELECT v.id, v.normalized
    FROM catalog.product_variants v
    WHERE v.id IN (SELECT b.variant_id FROM catalog.product_barcodes b WHERE b.gtin = ANY(${gtinArray}))
       OR v.signature = ${n.signature}
       OR v.search_text % ${text}
    ORDER BY similarity(v.search_text, ${text}) DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({ productId: r.id, normalized: r.normalized }));
}

export async function mappingMemory(tx: Tx, retailerProductId: string): Promise<{ confirmedProductId: string | null; rejectedProductIds: string[] }> {
  const rows = await tx
    .select({ variantId: productMatches.variantId, status: productMatches.status })
    .from(productMatches)
    .where(and(eq(productMatches.retailerProductId, retailerProductId), inArray(productMatches.status, ['CONFIRMED', 'REJECTED'])));
  return {
    confirmedProductId: rows.find((r) => r.status === 'CONFIRMED')?.variantId ?? null,
    rejectedProductIds: rows.filter((r) => r.status === 'REJECTED').map((r) => r.variantId),
  };
}

export interface MatchRecord {
  retailerProductId: string;
  variantId: string;
  confidence: MatchConfidence;
  method: MatchMethod;
  score: number;
  status: MatchStatus;
  reasons: string[];
  alternatives: { variantId: string; score: number; confidence: string }[];
}

export async function recordMatch(tx: Tx, m: MatchRecord): Promise<void> {
  await tx
    .insert(productMatches)
    .values(m)
    .onConflictDoUpdate({
      target: [productMatches.retailerProductId, productMatches.variantId],
      // Never downgrade a human decision.
      set: {
        confidence: sql`CASE WHEN ${productMatches.status} IN ('CONFIRMED','REJECTED') THEN ${productMatches.confidence} ELSE excluded.confidence END`,
        score: sql`CASE WHEN ${productMatches.status} IN ('CONFIRMED','REJECTED') THEN ${productMatches.score} ELSE excluded.score END`,
        status: sql`CASE WHEN ${productMatches.status} IN ('CONFIRMED','REJECTED') THEN ${productMatches.status} ELSE excluded.status END`,
        reasons: sql`excluded.reasons`,
        alternatives: sql`excluded.alternatives`,
        updatedAt: new Date(),
      },
    });
}

/** Link a retailer product to a variant (used by pipeline and admin review). */
export async function linkRetailerProduct(tx: Tx, retailerProductId: string, variantId: string | null): Promise<void> {
  await tx.update(retailerProducts).set({ variantId, updatedAt: new Date() }).where(eq(retailerProducts.id, retailerProductId));
}
