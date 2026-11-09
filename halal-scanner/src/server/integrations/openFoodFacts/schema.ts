import { z } from "zod";

/**
 * Lezing van de Open Food Facts v2-respons.
 *
 * Open Food Facts is community-data: vrijwel elk veld kan ontbreken, leeg zijn,
 * of een ander type hebben dan de documentatie suggereert (getallen als string,
 * lijsten als string, lege strings in plaats van null). Dit schema is daarom
 * bewust extreem tolerant - het doel is niet valideren maar veilig uitpakken.
 *
 * Regel: geen enkel veld is verplicht behalve wat we zelf al weten (de barcode).
 * Alles wat niet past valt terug op `undefined` in plaats van de hele respons
 * ongeldig te verklaren.
 */

/** Accepteert zowel een lijst als een enkele string; alles anders wordt undefined. */
const looseStringArray = z
  .union([z.array(z.unknown()), z.string()])
  .transform((value): string[] => {
    const items = typeof value === "string" ? value.split(",") : value;
    return items
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  })
  .catch([]);

/** Lege strings gelden als afwezig; OFF gebruikt "" waar null bedoeld is. */
const looseString = z
  .unknown()
  .transform((value): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  .catch(undefined);

/** Unix-seconden of een numerieke string. */
const looseUnixSeconds = z
  .unknown()
  .transform((value): number | undefined => {
    const num = typeof value === "string" ? Number(value) : value;
    if (typeof num !== "number" || !Number.isFinite(num) || num <= 0) return undefined;
    return num;
  })
  .catch(undefined);

const offIngredient = z
  .object({
    id: looseString,
    text: looseString,
    ingredients: z.array(z.unknown()).optional().catch(undefined),
  })
  .partial()
  .passthrough();

export const openFoodFactsProductSchema = z
  .object({
    code: looseString,
    _id: looseString,

    product_name: looseString,
    product_name_nl: looseString,
    product_name_en: looseString,
    generic_name: looseString,

    brands: looseString,

    image_front_url: looseString,
    image_url: looseString,
    image_front_small_url: looseString,

    ingredients_text: looseString,
    ingredients_text_nl: looseString,
    ingredients_text_en: looseString,
    ingredients_text_fr: looseString,
    ingredients_text_de: looseString,

    ingredients: z.array(offIngredient).optional().catch(undefined),

    categories_tags: looseStringArray.optional(),
    labels_tags: looseStringArray.optional(),
    countries_tags: looseStringArray.optional(),
    allergens_tags: looseStringArray.optional(),

    lang: looseString,

    last_modified_t: looseUnixSeconds,
  })
  .partial()
  .passthrough();

export const openFoodFactsResponseSchema = z
  .object({
    /** 1 = gevonden, 0 = niet gevonden. Soms als string. */
    status: z
      .unknown()
      .transform((value): number => {
        const num = typeof value === "string" ? Number(value) : value;
        return typeof num === "number" && Number.isFinite(num) ? num : 0;
      })
      .catch(0),
    status_verbose: looseString,
    code: looseString,
    product: openFoodFactsProductSchema.optional().catch(undefined),
  })
  .passthrough();

export type OpenFoodFactsProduct = z.infer<typeof openFoodFactsProductSchema>;
export type OpenFoodFactsResponse = z.infer<typeof openFoodFactsResponseSchema>;
