import { AppError, ProviderError, describeError } from "@/lib/errors";
import { logger, type Logger } from "@/lib/logger";
import { BARCODE_REJECTION_MESSAGE, validateBarcode } from "@/lib/barcode";
import { serverEnv } from "@/config/env";
import {
  findProductByBarcode,
  findProductById,
  recordScanEvent,
  type ProductWithRelations,
} from "@/server/repositories/productRepository";
import { getProductDataProviders } from "@/server/integrations/productData/registry";
import type { ProductDataProvider } from "@/server/integrations/productData/types";
import type { ExternalProductData } from "@/types/product";
import { syncProductFromExternal } from "./productSyncService";
import type { ProductAnalyzerPort } from "./ports";

/**
 * De centrale lookup-flow.
 *
 *   barcode -> valideren -> lokaal zoeken -> vers genoeg? -> ja: teruggeven
 *                                                         -> nee: provider
 *                                                                 -> normaliseren
 *                                                                 -> upserten
 *                                                                 -> analyseren
 *
 * Het belangrijkste gedrag zit in de foutpaden. Een storing bij de externe bron
 * mag een bestaand lokaal product nooit onbruikbaar maken: we vallen dan terug
 * op de gecachte versie en melden dat via `meta.stale`.
 */

export type LookupSource = "CACHE" | "PROVIDER" | "CACHE_STALE_FALLBACK";

export interface ProductLookupResult {
  product: ProductWithRelations;
  source: LookupSource;
  /** Naam van de provider die de data leverde, indien van toepassing. */
  providerName: string | null;
  cached: boolean;
  /** True wanneer verse data niet opgehaald kon worden en we cache tonen. */
  stale: boolean;
}

export interface LookupOptions {
  /** Negeert de TTL en dwingt een providercall af. */
  force?: boolean;
  userId?: string | null;
  now?: Date;
  log?: Logger;
  /** Injecteerbaar voor tests; standaard het register uit de config. */
  providers?: ProductDataProvider[];
  /** De halal-engine. Ontbreekt hij, dan wordt er niet geanalyseerd. */
  analyzer?: ProductAnalyzerPort;
  ttlHours?: number;
}

/** Valideert en canonicaliseert; gooit een nette 400 bij onzin-invoer. */
export function requireValidBarcode(raw: string): string {
  const result = validateBarcode(raw);
  if (!result.ok) {
    logger.info("BARCODE_INVALID", { reason: result.reason });
    throw new AppError("INVALID_BARCODE", BARCODE_REJECTION_MESSAGE[result.reason], {
      details: { reason: result.reason },
    });
  }
  return result.barcode;
}

function isFresh(product: ProductWithRelations, now: Date, ttlHours: number): boolean {
  if (!product.lastSyncedAt) return false;
  const ageMs = now.getTime() - product.lastSyncedAt.getTime();
  return ageMs < ttlHours * 60 * 60 * 1000;
}

/**
 * Zoekt een product op barcode, synchroniseert waar nodig, en analyseert.
 *
 * @throws {AppError} INVALID_BARCODE bij onbruikbare invoer,
 *                    PRODUCT_NOT_FOUND als geen enkele bron het product kent.
 */
export async function lookupProductByBarcode(
  rawBarcode: string,
  options: LookupOptions = {},
): Promise<ProductLookupResult> {
  const barcode = requireValidBarcode(rawBarcode);
  const now = options.now ?? new Date();
  const log = options.log ?? logger;
  const ttlHours = options.ttlHours ?? serverEnv().PRODUCT_SYNC_TTL_HOURS;
  const providers = options.providers ?? getProductDataProviders();

  log.info("PRODUCT_LOOKUP_STARTED", { barcode, force: options.force ?? false });

  const existing = await findProductByBarcode(barcode);

  if (existing && !options.force && isFresh(existing, now, ttlHours)) {
    log.info("PRODUCT_CACHE_HIT", { barcode, productId: existing.id });
    await recordScan(barcode, existing.id, true, options.userId ?? null);
    return {
      product: existing,
      source: "CACHE",
      providerName: null,
      cached: true,
      stale: false,
    };
  }

  log.info("PRODUCT_CACHE_MISS", {
    barcode,
    reason: !existing ? "onbekend product" : options.force ? "force refresh" : "ttl verlopen",
  });

  const fetched = await fetchFromProviders(barcode, providers, log);

  if (fetched.kind === "failed") {
    // Regel: een storing mag bestaande data niet ongeldig maken.
    if (existing) {
      log.warn("PRODUCT_PROVIDER_FAILED", {
        barcode,
        fallback: "gecachte versie",
        code: fetched.error.code,
      });
      await recordScan(barcode, existing.id, true, options.userId ?? null);
      return {
        product: existing,
        source: "CACHE_STALE_FALLBACK",
        providerName: null,
        cached: true,
        stale: true,
      };
    }
    throw fetched.error;
  }

  if (fetched.kind === "not_found") {
    if (existing) {
      // De bron kent het niet (meer), maar wij hebben het wel. Niets weggooien:
      // het product kan handmatig of via OCR zijn aangemaakt.
      log.info("PRODUCT_NOT_FOUND", { barcode, fallback: "bestaand lokaal product" });
      await recordScan(barcode, existing.id, true, options.userId ?? null);
      return {
        product: existing,
        source: "CACHE_STALE_FALLBACK",
        providerName: null,
        cached: true,
        stale: true,
      };
    }

    log.info("BARCODE_NOT_FOUND", { barcode });
    await recordScan(barcode, null, false, options.userId ?? null);
    throw new AppError(
      "PRODUCT_NOT_FOUND",
      "Geen product gevonden voor deze barcode.",
      { details: { barcode } },
    );
  }

  const sync = await syncProductFromExternal(fetched.data, {
    sourceConfidence: fetched.provider.confidence,
    ingredientsOrigin: "OPEN_FOOD_FACTS",
    now,
  });

  let product = sync.product;

  // Integratiepunt met de halal-engine (fase 3). Analyseren gebeurt alleen als
  // er iets veranderd is; anders blijft de bestaande analyse geldig.
  if (options.analyzer) {
    const needsAnalysis =
      sync.outcome === "CREATED" || sync.ingredientsChanged || product.lastAnalyzedAt === null;
    if (needsAnalysis) {
      product = await options.analyzer.analyzeAndPersist(product.id, { now });
    }
  }

  await recordScan(barcode, product.id, true, options.userId ?? null);

  return {
    product,
    source: "PROVIDER",
    providerName: fetched.provider.name,
    cached: false,
    stale: false,
  };
}

type FetchOutcome =
  | { kind: "found"; data: ExternalProductData; provider: ProductDataProvider }
  | { kind: "not_found" }
  | { kind: "failed"; error: AppError };

/**
 * Loopt de providers op volgorde af.
 *
 * Een provider die faalt blokkeert de volgende niet; pas als álle providers
 * falen én geen enkele "niet gevonden" zei, geldt het als storing.
 */
async function fetchFromProviders(
  barcode: string,
  providers: ProductDataProvider[],
  log: Logger,
): Promise<FetchOutcome> {
  let lastError: AppError | undefined;

  for (const provider of providers) {
    try {
      const data = await provider.getByBarcode(barcode);
      if (data) return { kind: "found", data, provider };
    } catch (error: unknown) {
      if (error instanceof ProviderError) {
        lastError = error;
        log.warn("PRODUCT_PROVIDER_FAILED", {
          provider: provider.name,
          barcode,
          code: error.code,
        });
        continue;
      }
      log.error("PRODUCT_PROVIDER_FAILED", {
        provider: provider.name,
        barcode,
        ...describeError(error),
      });
      lastError = new AppError(
        "PROVIDER_UNAVAILABLE",
        "De externe productdatabase is niet bereikbaar.",
        { cause: error },
      );
    }
  }

  if (lastError) return { kind: "failed", error: lastError };
  return { kind: "not_found" };
}

async function recordScan(
  barcode: string,
  productId: string | null,
  found: boolean,
  userId: string | null,
): Promise<void> {
  try {
    await recordScanEvent({ barcode, productId, found, userId });
  } catch (error: unknown) {
    // Scanstatistiek is bijzaak; hij mag een geslaagde lookup niet laten falen.
    logger.warn("REQUEST_FAILED", { step: "recordScanEvent", ...describeError(error) });
  }
}

/** Forceert een hersynchronisatie van een bestaand product. */
export async function refreshProductById(
  productId: string,
  options: LookupOptions = {},
): Promise<ProductLookupResult> {
  const product = await findProductById(productId);
  if (!product) {
    throw new AppError("RESOURCE_NOT_FOUND", "Dit product bestaat niet.");
  }
  return lookupProductByBarcode(product.barcode, { ...options, force: true });
}
