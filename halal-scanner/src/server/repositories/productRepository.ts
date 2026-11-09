import type {
  ConfidenceLevel,
  ExternalSource,
  IngredientOrigin,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { normalizeIngredientName } from "@/server/halal/normalizers/text";
import type { ParsedIngredient } from "@/types/product";

/**
 * Alle databasetoegang rond producten. Buiten deze module wordt geen enkele
 * Prisma-query op Product/ProductIngredient/ProductRevision uitgevoerd.
 */

export type Db = PrismaClient | Prisma.TransactionClient;

/** Velden die een externe bron mag schrijven. Zie EXTERNALLY_MANAGED_FIELDS. */
export interface ExternalFieldValues {
  name: string | null;
  brandName: string | null;
  imageUrl: string | null;
  ingredientsRaw: string | null;
  ingredientsLang: string | null;
  categories: string[];
  labels: string[];
  countries: string[];
  allergens: string[];
  externalId: string | null;
  externalUpdatedAt: Date | null;
}

const productWithRelations = {
  ingredients: {
    orderBy: { position: "asc" },
    include: { ingredient: { select: { id: true, name: true, defaultStatus: true } } },
  },
  analyses: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      findings: {
        orderBy: { position: "asc" },
        include: {
          source: true,
          eNumber: { select: { id: true, code: true, name: true } },
          ingredient: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productWithRelations;
}>;

export async function findProductByBarcode(
  barcode: string,
  db: Db = defaultPrisma,
): Promise<ProductWithRelations | null> {
  return db.product.findUnique({
    where: { barcode },
    include: productWithRelations,
  });
}

export async function findProductById(
  id: string,
  db: Db = defaultPrisma,
): Promise<ProductWithRelations | null> {
  return db.product.findUnique({ where: { id }, include: productWithRelations });
}

export interface ProductSearchParams {
  query: string;
  limit: number;
  offset: number;
}

export interface ProductSearchHit {
  id: string;
  barcode: string;
  name: string | null;
  brandName: string | null;
  imageUrl: string | null;
  halalStatus: ProductWithRelations["halalStatus"];
  confidenceLevel: ConfidenceLevel;
  lastAnalyzedAt: Date | null;
}

/**
 * Lokale zoekopdracht op naam, merk of barcode.
 *
 * Bewust alleen lokaal: elke toetsaanslag doorzetten naar een externe API zou
 * die API belasten en de zoekfunctie traag maken. Externe zoekintegratie kan
 * later achter een expliciete `includeExternal`-vlag.
 *
 * `contains` zonder leading anchor gebruikt de b-tree index niet. Bij groei is
 * een pg_trgm GIN-index op (name, brandName) de volgende stap; voor de MVP-
 * datasetgrootte is dit ruim voldoende.
 */
export async function searchProducts(
  params: ProductSearchParams,
  db: Db = defaultPrisma,
): Promise<{ hits: ProductSearchHit[]; total: number }> {
  const term = params.query.trim();

  const where: Prisma.ProductWhereInput = {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { brandName: { contains: term, mode: "insensitive" } },
      // Cijferreeksen zijn vrijwel altijd een (deel van een) barcode.
      ...(/^\d+$/.test(term) ? [{ barcode: { startsWith: term } }] : []),
    ],
  };

  const [hits, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ lastAnalyzedAt: "desc" }, { updatedAt: "desc" }],
      skip: params.offset,
      take: params.limit,
      select: {
        id: true,
        barcode: true,
        name: true,
        brandName: true,
        imageUrl: true,
        halalStatus: true,
        confidenceLevel: true,
        lastAnalyzedAt: true,
      },
    }),
    db.product.count({ where }),
  ]);

  return { hits, total };
}

/** Koppelt of maakt het merk op basis van de merknaam uit de externe bron. */
async function resolveBrandId(
  brandName: string | null,
  db: Db,
): Promise<string | null> {
  if (!brandName) return null;
  const normalizedName = normalizeIngredientName(brandName);
  if (!normalizedName) return null;

  const brand = await db.brand.upsert({
    where: { normalizedName },
    update: {},
    create: { name: brandName, normalizedName },
    select: { id: true },
  });
  return brand.id;
}

export interface CreateProductInput extends ExternalFieldValues {
  barcode: string;
  externalSource: ExternalSource;
  sourceConfidence: ConfidenceLevel;
  ingredientsOrigin: IngredientOrigin | null;
  ingredientsHash: string | null;
  parsedIngredients: ParsedIngredient[];
  syncedAt: Date;
}

export async function createProductWithRevision(
  input: CreateProductInput,
  db: Db = defaultPrisma,
): Promise<ProductWithRelations> {
  const brandId = await resolveBrandId(input.brandName, db);

  const product = await db.product.create({
    data: {
      barcode: input.barcode,
      name: input.name,
      brandName: input.brandName,
      brandId,
      imageUrl: input.imageUrl,
      ingredientsRaw: input.ingredientsRaw,
      ingredientsLang: input.ingredientsLang,
      categories: input.categories,
      labels: input.labels,
      countries: input.countries,
      allergens: input.allergens,
      externalSource: input.externalSource,
      externalId: input.externalId,
      externalUpdatedAt: input.externalUpdatedAt,
      lastSyncedAt: input.syncedAt,
      sourceConfidence: input.sourceConfidence,
      ingredientsOrigin: input.ingredientsOrigin,
      revision: 1,
    },
    select: { id: true },
  });

  await db.productRevision.create({
    data: {
      productId: product.id,
      revision: 1,
      changedFields: ["created"],
      name: input.name,
      brandName: input.brandName,
      imageUrl: input.imageUrl,
      ingredientsRaw: input.ingredientsRaw,
      ingredientsLang: input.ingredientsLang,
      categories: input.categories,
      labels: input.labels,
      countries: input.countries,
      allergens: input.allergens,
      ingredientsHash: input.ingredientsHash,
      externalSource: input.externalSource,
      externalId: input.externalId,
      externalUpdatedAt: input.externalUpdatedAt,
      ingredientsOrigin: input.ingredientsOrigin,
    },
  });

  if (input.parsedIngredients.length > 0 && input.ingredientsOrigin) {
    await replaceProductIngredients(
      product.id,
      input.parsedIngredients,
      input.ingredientsOrigin,
      db,
    );
  }

  const created = await findProductById(product.id, db);
  if (!created) throw new Error(`Product ${product.id} verdween direct na aanmaken.`);
  return created;
}

export interface UpdateProductInput {
  productId: string;
  nextRevision: number;
  changedFields: string[];
  fields: Partial<ExternalFieldValues>;
  ingredientsHash: string | null;
  ingredientsOrigin: IngredientOrigin | null;
  /** Null = ingrediëntenlijst niet aanraken (bv. door een mens beheerd). */
  parsedIngredients: ParsedIngredient[] | null;
  externalSource: ExternalSource;
  sourceConfidence: ConfidenceLevel;
  syncedAt: Date;
}

export async function updateProductWithRevision(
  input: UpdateProductInput,
  db: Db = defaultPrisma,
): Promise<ProductWithRelations> {
  const brandId =
    input.fields.brandName !== undefined
      ? await resolveBrandId(input.fields.brandName, db)
      : undefined;

  const current = await db.product.update({
    where: { id: input.productId },
    data: {
      ...input.fields,
      ...(brandId !== undefined ? { brandId } : {}),
      externalSource: input.externalSource,
      sourceConfidence: input.sourceConfidence,
      lastSyncedAt: input.syncedAt,
      revision: input.nextRevision,
      ...(input.ingredientsOrigin ? { ingredientsOrigin: input.ingredientsOrigin } : {}),
    },
    select: {
      id: true,
      name: true,
      brandName: true,
      imageUrl: true,
      ingredientsRaw: true,
      ingredientsLang: true,
      categories: true,
      labels: true,
      countries: true,
      allergens: true,
      externalId: true,
      externalUpdatedAt: true,
      ingredientsOrigin: true,
    },
  });

  await db.productRevision.create({
    data: {
      productId: input.productId,
      revision: input.nextRevision,
      changedFields: input.changedFields,
      name: current.name,
      brandName: current.brandName,
      imageUrl: current.imageUrl,
      ingredientsRaw: current.ingredientsRaw,
      ingredientsLang: current.ingredientsLang,
      categories: current.categories,
      labels: current.labels,
      countries: current.countries,
      allergens: current.allergens,
      ingredientsHash: input.ingredientsHash,
      externalSource: input.externalSource,
      externalId: current.externalId,
      externalUpdatedAt: current.externalUpdatedAt,
      ingredientsOrigin: current.ingredientsOrigin,
    },
  });

  if (input.parsedIngredients && input.ingredientsOrigin) {
    await replaceProductIngredients(
      input.productId,
      input.parsedIngredients,
      input.ingredientsOrigin,
      db,
    );
  }

  const updated = await findProductById(input.productId, db);
  if (!updated) throw new Error(`Product ${input.productId} verdween tijdens de update.`);
  return updated;
}

/** Alleen `lastSyncedAt` bijwerken: er was niets veranderd bij de bron. */
export async function touchSyncedAt(
  productId: string,
  syncedAt: Date,
  db: Db = defaultPrisma,
): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: { lastSyncedAt: syncedAt },
  });
}

/**
 * Vervangt de volledige ingrediëntenlijst van een product.
 *
 * Een ingrediëntenlijst is een geheel, geen verzameling losse regels: een
 * gedeeltelijke merge zou een etiket opleveren dat nergens op de verpakking
 * staat. De historie gaat niet verloren - elke wijziging levert een
 * `ProductRevision` op met de ruwe tekst en de hash.
 *
 * Matching met de `Ingredient`-tabel gebeurt op genormaliseerde naam én op
 * alias, zodat "lard" en "reuzel" naar hetzelfde ingrediënt wijzen.
 */
export async function replaceProductIngredients(
  productId: string,
  parsed: ParsedIngredient[],
  origin: IngredientOrigin,
  db: Db = defaultPrisma,
): Promise<void> {
  await db.productIngredient.deleteMany({ where: { productId } });
  if (parsed.length === 0) return;

  const names = parsed.map((item) => item.normalizedName);

  const [byName, byAlias] = await Promise.all([
    db.ingredient.findMany({
      where: { normalizedName: { in: names } },
      select: { id: true, normalizedName: true },
    }),
    db.ingredientAlias.findMany({
      where: { alias: { in: names } },
      select: { ingredientId: true, alias: true },
    }),
  ]);

  const lookup = new Map<string, string>();
  for (const alias of byAlias) lookup.set(alias.alias, alias.ingredientId);
  // Directe naam-match wint van een alias-match.
  for (const ingredient of byName) lookup.set(ingredient.normalizedName, ingredient.id);

  await db.productIngredient.createMany({
    data: parsed.map((item) => ({
      productId,
      ingredientId: lookup.get(item.normalizedName) ?? null,
      rawName: item.rawName,
      normalizedName: item.normalizedName,
      position: item.position,
      quantityText: item.quantityText,
      origin,
    })),
  });
}

export async function listProductRevisions(
  productId: string,
  db: Db = defaultPrisma,
): Promise<Array<{ revision: number; changedFields: string[]; createdAt: Date }>> {
  return db.productRevision.findMany({
    where: { productId },
    orderBy: { revision: "desc" },
    select: { revision: true, changedFields: true, createdAt: true },
  });
}

export async function recordScanEvent(
  input: { barcode: string; productId: string | null; found: boolean; userId: string | null },
  db: Db = defaultPrisma,
): Promise<void> {
  await db.scanEvent.create({
    data: {
      barcode: input.barcode,
      productId: input.productId,
      found: input.found,
      userId: input.userId,
    },
  });
}
