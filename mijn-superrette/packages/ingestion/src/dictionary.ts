import { eq } from 'drizzle-orm';
import { brands, retailers, synonyms, type Database } from '@superrette/database';
import { DEFAULT_DICTIONARY, extendDictionary, ProductNormalizer, type NormalizerDictionary } from '@superrette/product-matching';

/** Build the normaliser dictionary from defaults plus admin-managed brands and synonyms. */
export async function loadDictionary(db: Database): Promise<NormalizerDictionary> {
  const brandRows = await db
    .select({ slug: brands.slug, name: brands.name, aliases: brands.aliases, impliesTokens: brands.impliesTokens, retailerSlug: retailers.slug })
    .from(brands)
    .leftJoin(retailers, eq(retailers.id, brands.privateLabelRetailerId));
  const synonymRows = await db.select().from(synonyms);
  return extendDictionary(DEFAULT_DICTIONARY, {
    brands: brandRows
      .filter((b) => b.aliases.length > 0)
      .map((b) => ({ slug: b.slug, name: b.name, aliases: b.aliases, impliesTokens: b.impliesTokens, privateLabelOf: b.retailerSlug })),
    synonyms: Object.fromEntries(synonymRows.map((s) => [s.phrase, s.token])),
  });
}

export async function createNormalizer(db: Database): Promise<ProductNormalizer> {
  return new ProductNormalizer(await loadDictionary(db));
}
