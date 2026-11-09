import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";
import type { ExternalProductData } from "@/types/product";
import type { OpenFoodFactsProduct } from "./schema";

/**
 * Vertaalt een Open Food Facts-product naar ons interne model.
 *
 * Defensief van begin tot eind: geen enkel veld wordt als aanwezig aangenomen.
 * Wat ontbreekt blijft `undefined` in plaats van een lege string of een gok.
 */

/** OFF-tags hebben de vorm "en:palm-oil"; het taalprefix is voor ons ruis. */
function stripTagPrefix(tag: string): string {
  const colonIndex = tag.indexOf(":");
  return colonIndex === -1 ? tag : tag.slice(colonIndex + 1);
}

function cleanTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const cleaned = stripTagPrefix(tag).trim();
    if (cleaned.length === 0 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

/**
 * Kiest de ingrediëntentekst in de meest bruikbare taal.
 *
 * Voorkeur: Nederlands, dan de taal die OFF zelf als hoofdtaal opgeeft, dan
 * Engels, dan het generieke veld, dan de overige talen. Reden voor die
 * volgorde: de app is Nederlandstalig en onze ingrediënt-aliassen zijn het
 * dichtst gevuld voor NL en EN.
 */
function pickIngredientsText(
  product: OpenFoodFactsProduct,
): { text: string; lang: string } | undefined {
  const byLang: Array<[string, string | undefined]> = [
    ["nl", product.ingredients_text_nl],
    [product.lang ?? "", product.lang ? readLangField(product, product.lang) : undefined],
    ["en", product.ingredients_text_en],
    [product.lang ?? "und", product.ingredients_text],
    ["fr", product.ingredients_text_fr],
    ["de", product.ingredients_text_de],
  ];

  for (const [lang, text] of byLang) {
    if (text && text.trim().length > 0) {
      return { text: text.trim(), lang: lang || "und" };
    }
  }
  return undefined;
}

function readLangField(
  product: OpenFoodFactsProduct,
  lang: string,
): string | undefined {
  switch (lang) {
    case "nl":
      return product.ingredients_text_nl;
    case "en":
      return product.ingredients_text_en;
    case "fr":
      return product.ingredients_text_fr;
    case "de":
      return product.ingredients_text_de;
    default:
      return undefined;
  }
}

function pickProductName(product: OpenFoodFactsProduct): string | undefined {
  return (
    product.product_name_nl ??
    product.product_name ??
    product.product_name_en ??
    product.generic_name
  );
}

function pickImageUrl(product: OpenFoodFactsProduct): string | undefined {
  const candidate =
    product.image_front_url ?? product.image_url ?? product.image_front_small_url;
  if (!candidate) return undefined;
  // Alleen https accepteren: een http-URL wordt in een https-app geblokkeerd
  // als mixed content, en een javascript:-URL mag nooit in de DOM belanden.
  return candidate.startsWith("https://") ? candidate : undefined;
}

/** OFF geeft merken als "Merk A,Merk B"; wij bewaren de eerste als hoofdmerk. */
function pickBrand(product: OpenFoodFactsProduct): string | undefined {
  const brands = product.brands;
  if (!brands) return undefined;
  const first = brands.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

export function normalizeOpenFoodFactsProduct(
  barcode: string,
  product: OpenFoodFactsProduct,
): ExternalProductData {
  const ingredients = pickIngredientsText(product);

  const result: ExternalProductData = {
    barcode,
    externalSource: "OPEN_FOOD_FACTS",
  };

  const name = pickProductName(product);
  if (name) result.name = name;

  const brand = pickBrand(product);
  if (brand) result.brand = brand;

  const imageUrl = pickImageUrl(product);
  if (imageUrl) result.imageUrl = imageUrl;

  if (ingredients) {
    result.ingredientsText = ingredients.text;
    result.ingredientsLang = ingredients.lang;
    result.ingredients = parseIngredientsText(ingredients.text);
  }

  const categories = cleanTags(product.categories_tags);
  if (categories.length > 0) result.categories = categories;

  const labels = cleanTags(product.labels_tags);
  if (labels.length > 0) result.labels = labels;

  const countries = cleanTags(product.countries_tags);
  if (countries.length > 0) result.countries = countries;

  const allergens = cleanTags(product.allergens_tags);
  if (allergens.length > 0) result.allergens = allergens;

  const externalId = product._id ?? product.code ?? barcode;
  if (externalId) result.externalId = externalId;

  if (product.last_modified_t !== undefined) {
    result.externalUpdatedAt = new Date(product.last_modified_t * 1000);
  }

  return result;
}
