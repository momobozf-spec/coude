import { createHash } from "node:crypto";
import type { ConfidenceLevel, IngredientOrigin } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  createProductWithRevision,
  findProductByBarcode,
  touchSyncedAt,
  updateProductWithRevision,
  type Db,
  type ExternalFieldValues,
  type ProductWithRelations,
} from "@/server/repositories/productRepository";
import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";
import {
  EXTERNALLY_MANAGED_FIELDS,
  type ExternalProductData,
  type ExternallyManagedField,
  type ParsedIngredient,
} from "@/types/product";

/**
 * Synchronisatie van externe productdata naar onze database.
 *
 * De regels die hier gelden, zijn de kern van "externe data is niet
 * automatisch de waarheid":
 *
 *  1. Een sync raakt alléén de velden aan waarvan de externe bron eigenaar is
 *     (EXTERNALLY_MANAGED_FIELDS). Certificaten, reviews, favorieten,
 *     halal-status en analyses blijven onaangeroerd.
 *  2. Een door een mens of via OCR vastgestelde ingrediëntenlijst wordt nooit
 *     door een externe sync overschreven.
 *  3. Elke inhoudelijke wijziging levert een `ProductRevision` op. Een update
 *     bij Open Food Facts vernietigt dus geen historie: achteraf blijft
 *     reconstrueerbaar welke ingrediëntenlijst tot welke status leidde.
 *  4. Een provider die `null` teruggeeft betekent "niet gevonden" - dat is géén
 *     reden om een bestaand lokaal product te wissen of leeg te maken. Een
 *     storing gooit een fout en bereikt deze module niet eens.
 */

/** Herkomsten die een externe sync niet mag overschrijven. */
const HUMAN_OWNED_ORIGINS: ReadonlySet<IngredientOrigin> = new Set<IngredientOrigin>([
  "USER",
  "ADMIN",
  "OCR",
]);

export type SyncOutcome = "CREATED" | "UPDATED" | "UNCHANGED" | "SKIPPED_PROTECTED";

export interface SyncResult {
  product: ProductWithRelations;
  outcome: SyncOutcome;
  changedFields: string[];
  /** True als de ingrediëntenlijst inhoudelijk wijzigde. */
  ingredientsChanged: boolean;
}

/** Stabiele hash over de genormaliseerde ingrediënten. */
export function hashIngredients(parsed: ParsedIngredient[]): string | null {
  if (parsed.length === 0) return null;
  const canonical = parsed.map((item) => item.normalizedName).join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function toExternalFields(external: ExternalProductData): ExternalFieldValues {
  return {
    name: external.name ?? null,
    brandName: external.brand ?? null,
    imageUrl: external.imageUrl ?? null,
    ingredientsRaw: external.ingredientsText ?? null,
    ingredientsLang: external.ingredientsLang ?? null,
    categories: external.categories ?? [],
    labels: external.labels ?? [],
    countries: external.countries ?? [],
    allergens: external.allergens ?? [],
    externalId: external.externalId ?? null,
    externalUpdatedAt: external.externalUpdatedAt ?? null,
  };
}

function sameArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

/**
 * Bepaalt welke door de bron beheerde velden inhoudelijk verschillen.
 *
 * Een externe bron die een veld níet aanlevert (bv. geen afbeelding) mag een
 * bestaande waarde niet wissen: dat zou een tijdelijk incomplete respons
 * permanent maken. Daarom telt alleen "bron heeft een waarde én die wijkt af".
 */
function diffExternalFields(
  current: ProductWithRelations,
  next: ExternalFieldValues,
): { changed: ExternallyManagedField[]; values: Partial<ExternalFieldValues> } {
  const changed: ExternallyManagedField[] = [];
  const values: Partial<ExternalFieldValues> = {};

  for (const field of EXTERNALLY_MANAGED_FIELDS) {
    const nextValue = next[field];
    const currentValue = current[field];

    const nextIsEmpty =
      nextValue === null ||
      (Array.isArray(nextValue) && nextValue.length === 0) ||
      (typeof nextValue === "string" && nextValue.length === 0);
    if (nextIsEmpty) continue;

    const isSame = Array.isArray(nextValue)
      ? sameArray(nextValue, (currentValue as string[] | null) ?? [])
      : nextValue instanceof Date
        ? sameDate(nextValue, currentValue as Date | null)
        : nextValue === currentValue;

    if (!isSame) {
      changed.push(field);
      // Object.assign in plaats van values[field] = nextValue: TypeScript kan
      // niet uitdrukken dat sleutel en waarde uit hetzelfde object komen, en
      // dit vermijdt een cast naar any.
      Object.assign(values, { [field]: nextValue });
    }
  }

  return { changed, values };
}

export interface SyncOptions {
  /** Vertrouwensniveau van de bron; belandt in `Product.sourceConfidence`. */
  sourceConfidence: ConfidenceLevel;
  /** Herkomst van de ingrediëntenlijst uit deze bron. */
  ingredientsOrigin: IngredientOrigin;
  now?: Date;
  db?: Db;
}

export async function syncProductFromExternal(
  external: ExternalProductData,
  options: SyncOptions,
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const db = options.db;
  const fields = toExternalFields(external);
  const parsed = external.ingredients ?? parseIngredientsText(external.ingredientsText);
  const ingredientsHash = hashIngredients(parsed);

  const existing = await findProductByBarcode(external.barcode, db);

  if (!existing) {
    const product = await createProductWithRevision(
      {
        ...fields,
        barcode: external.barcode,
        externalSource: external.externalSource,
        sourceConfidence: options.sourceConfidence,
        ingredientsOrigin: parsed.length > 0 ? options.ingredientsOrigin : null,
        ingredientsHash,
        parsedIngredients: parsed,
        syncedAt: now,
      },
      db,
    );

    logger.info("PRODUCT_IMPORTED", {
      barcode: external.barcode,
      source: external.externalSource,
      ingredientCount: parsed.length,
    });

    return { product, outcome: "CREATED", changedFields: ["created"], ingredientsChanged: true };
  }

  const { changed, values } = diffExternalFields(existing, fields);

  // Regel 2: een door een mens of via OCR bepaalde lijst blijft van hen.
  const ingredientsProtected =
    existing.ingredientsOrigin !== null &&
    HUMAN_OWNED_ORIGINS.has(existing.ingredientsOrigin);

  const rawIngredientsChanged = changed.includes("ingredientsRaw");
  const ingredientsChanged = rawIngredientsChanged && !ingredientsProtected;

  if (ingredientsProtected && rawIngredientsChanged) {
    // De ruwe tekst en de lijst horen bij elkaar; laat allebei met rust.
    delete values.ingredientsRaw;
    delete values.ingredientsLang;
    const index = changed.indexOf("ingredientsRaw");
    if (index >= 0) changed.splice(index, 1);
    const langIndex = changed.indexOf("ingredientsLang");
    if (langIndex >= 0) changed.splice(langIndex, 1);

    logger.info("PRODUCT_UPDATED", {
      barcode: external.barcode,
      skippedIngredients: true,
      reason: "ingredientenlijst is door een mens of via OCR vastgesteld",
      currentOrigin: existing.ingredientsOrigin,
    });
  }

  if (changed.length === 0) {
    await touchSyncedAt(existing.id, now, db);
    logger.debug("PRODUCT_UNCHANGED", { barcode: external.barcode });
    return {
      product: existing,
      outcome: ingredientsProtected && rawIngredientsChanged ? "SKIPPED_PROTECTED" : "UNCHANGED",
      changedFields: [],
      ingredientsChanged: false,
    };
  }

  const product = await updateProductWithRevision(
    {
      productId: existing.id,
      nextRevision: existing.revision + 1,
      changedFields: changed,
      fields: values,
      ingredientsHash: ingredientsChanged ? ingredientsHash : null,
      ingredientsOrigin: ingredientsChanged ? options.ingredientsOrigin : null,
      parsedIngredients: ingredientsChanged ? parsed : null,
      externalSource: external.externalSource,
      sourceConfidence: options.sourceConfidence,
      syncedAt: now,
    },
    db,
  );

  logger.info("PRODUCT_UPDATED", {
    barcode: external.barcode,
    changedFields: changed,
    ingredientsChanged,
    revision: existing.revision + 1,
  });

  return { product, outcome: "UPDATED", changedFields: changed, ingredientsChanged };
}
