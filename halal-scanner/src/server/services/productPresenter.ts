import type { ProductWithRelations, ProductSearchHit } from "@/server/repositories/productRepository";
import type { ConfidenceLevel, HalalStatus } from "@prisma/client";
import { STATUS_PRESENTATION } from "@/types/halal";

/**
 * Vertaalt databasemodellen naar de vorm die de API teruggeeft.
 *
 * Doel: geen Prisma-typen in de client, geen interne velden lekken, en één plek
 * waar de datumnotatie (ISO 8601) wordt bepaald.
 */

export interface ProductIngredientDto {
  rawName: string;
  normalizedName: string;
  position: number;
  quantityText: string | null;
  origin: string;
  /** Gevuld zodra het ingrediënt herkend is in onze database. */
  matchedIngredient: { id: string; name: string; defaultStatus: HalalStatus } | null;
}

export interface ProductSummaryDto {
  id: string;
  barcode: string;
  name: string | null;
  brandName: string | null;
  imageUrl: string | null;
  halalStatus: HalalStatus;
  halalStatusLabel: string;
  confidenceLevel: ConfidenceLevel;
  lastAnalyzedAt: string | null;
}

export interface ProductDetailDto extends ProductSummaryDto {
  ingredientsRaw: string | null;
  ingredientsLang: string | null;
  ingredientsOrigin: string | null;
  ingredients: ProductIngredientDto[];
  categories: string[];
  labels: string[];
  countries: string[];
  allergens: string[];
  needsHumanReview: boolean;
  analysisVersion: string | null;
  revision: number;
  /** Herkomst van de data, expliciet zichtbaar voor de gebruiker. */
  provenance: {
    externalSource: string | null;
    externalId: string | null;
    externalUpdatedAt: string | null;
    lastSyncedAt: string | null;
    sourceConfidence: ConfidenceLevel;
  };
}

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

export function toProductSummary(
  product: ProductWithRelations | ProductSearchHit,
): ProductSummaryDto {
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brandName: product.brandName,
    imageUrl: product.imageUrl,
    halalStatus: product.halalStatus,
    halalStatusLabel: STATUS_PRESENTATION[product.halalStatus].label,
    confidenceLevel: product.confidenceLevel,
    lastAnalyzedAt: iso(product.lastAnalyzedAt),
  };
}

export function toProductDetail(product: ProductWithRelations): ProductDetailDto {
  return {
    ...toProductSummary(product),
    ingredientsRaw: product.ingredientsRaw,
    ingredientsLang: product.ingredientsLang,
    ingredientsOrigin: product.ingredientsOrigin,
    ingredients: product.ingredients.map((item) => ({
      rawName: item.rawName,
      normalizedName: item.normalizedName,
      position: item.position,
      quantityText: item.quantityText,
      origin: item.origin,
      matchedIngredient: item.ingredient
        ? {
            id: item.ingredient.id,
            name: item.ingredient.name,
            defaultStatus: item.ingredient.defaultStatus,
          }
        : null,
    })),
    categories: product.categories,
    labels: product.labels,
    countries: product.countries,
    allergens: product.allergens,
    needsHumanReview: product.needsHumanReview,
    analysisVersion: product.analysisVersion,
    revision: product.revision,
    provenance: {
      externalSource: product.externalSource,
      externalId: product.externalId,
      externalUpdatedAt: iso(product.externalUpdatedAt),
      lastSyncedAt: iso(product.lastSyncedAt),
      sourceConfidence: product.sourceConfidence,
    },
  };
}
