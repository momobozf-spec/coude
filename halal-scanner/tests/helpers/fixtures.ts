import type { ProductWithRelations } from "@/server/repositories/productRepository";
import type { ExternalProductData } from "@/types/product";
import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";

/** Minimale, volledig getypeerde fixtures voor servicetests zonder database. */

export function makeProduct(
  overrides: Partial<ProductWithRelations> = {},
): ProductWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "prod_1",
    barcode: "4006381333931",
    name: "Testkoek",
    brandName: "Testmerk",
    brandId: null,
    imageUrl: null,
    ingredientsRaw: "Suiker, water",
    ingredientsLang: "nl",
    categories: [],
    labels: [],
    countries: [],
    allergens: [],
    externalSource: "OPEN_FOOD_FACTS",
    externalId: "4006381333931",
    externalUpdatedAt: now,
    lastSyncedAt: now,
    sourceConfidence: "MEDIUM",
    ingredientsOrigin: "OPEN_FOOD_FACTS",
    revision: 1,
    halalStatus: "UNKNOWN",
    confidenceLevel: "LOW",
    analysisVersion: null,
    lastAnalyzedAt: null,
    needsHumanReview: false,
    createdAt: now,
    updatedAt: now,
    ingredients: [],
    analyses: [],
    ...overrides,
  };
}

export function makeExternal(
  overrides: Partial<ExternalProductData> = {},
): ExternalProductData {
  const ingredientsText = overrides.ingredientsText ?? "Suiker, water";
  return {
    barcode: "4006381333931",
    name: "Testkoek",
    brand: "Testmerk",
    ingredientsText,
    ingredientsLang: "nl",
    ingredients: parseIngredientsText(ingredientsText),
    externalSource: "OPEN_FOOD_FACTS",
    externalId: "4006381333931",
    externalUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
