/**
 * De applicatieservice rond de halal-analyse.
 *
 * Alles wat er tussen "een product-id" en "een opgeslagen analyse" gebeurt,
 * gebeurt hier — en nergens anders. Route-handlers roepen deze functie aan en
 * doen zelf niets: geen hashen, geen cachecontrole, geen persistence. Zonder die
 * regel zou dezelfde logica in drie routes eindigen en zouden ze onvermijdelijk
 * uit elkaar lopen.
 *
 * De volgorde is bewust:
 *
 *   product laden → input bepalen → hash → cache raadplegen → (pas dan) rekenen
 *
 * De cachecontrole staat vóór het laden van de referentiedata. Bij een tweede
 * scan van hetzelfde product raken we zo alleen de productquery en de
 * analysequery, en niet de hele referentietabel.
 */
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { parseIngredientsText } from "@/server/halal/normalizers/ingredients";
import { analyzeIngredients, computeInputHash, ENGINE_VERSION } from "@/server/halal/engine";
import type { EvidenceInput, HalalReference } from "@/server/halal/engine";
import type { ReferenceLoader } from "@/server/halal/engine/evidence";
import {
  loadCertificateEvidence,
  referenceLoader as defaultReferenceLoader,
} from "@/server/repositories/referenceRepository";
import {
  findLatestAnalysis,
  findReusableAnalysis,
  listAnalyses,
  saveAnalysis,
  type StoredAnalysis,
} from "@/server/repositories/analysisRepository";
import {
  findProductById,
  type ProductWithRelations,
} from "@/server/repositories/productRepository";
import type { CertificateEvidence } from "@/types/halal";
import type { ParsedIngredient } from "@/types/product";
import type { ProductAnalyzerPort } from "./ports";

export interface AnalyzeOptions {
  now?: Date;
  triggeredByUserId?: string | null;
  /** Negeert de cache en dwingt een nieuwe berekening af. */
  force?: boolean;
  referenceLoader?: ReferenceLoader;
  db?: typeof prisma;
}

export interface AnalyzeProductResult {
  analysis: StoredAnalysis;
  /** True wanneer een bestaande analyse hergebruikt is. */
  reused: boolean;
  product: ProductWithRelations;
}

/**
 * De ingrediënteninput voor de engine.
 *
 * De ruwe etikettekst is leidend wanneer die er is: die is de bron waaruit de
 * `ProductIngredient`-rijen ooit ontstonden, en opnieuw parsen levert
 * deterministisch hetzelfde resultaat plus de herkende E-nummercodes — die niet
 * als kolom bewaard worden.
 *
 * Zonder ruwe tekst (bijvoorbeeld een lijst die via OCR is bevestigd) vallen we
 * terug op de opgeslagen rijen. Dan is de opgeslagen lijst de waarheid, en die
 * mag niet stilzwijgend verdwijnen omdat er geen tekst meer bij zit.
 */
export function resolveAnalysisInput(product: ProductWithRelations): {
  parsedIngredients: ParsedIngredient[];
  hasIngredientsText: boolean;
} {
  if (product.ingredientsRaw && product.ingredientsRaw.trim() !== "") {
    return {
      parsedIngredients: parseIngredientsText(product.ingredientsRaw),
      hasIngredientsText: true,
    };
  }

  if (product.ingredients.length > 0) {
    const parsedIngredients = [...product.ingredients]
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        rawName: row.rawName,
        normalizedName: row.normalizedName,
        position: row.position,
        quantityText: row.quantityText,
        // Zonder ruwe tekst is de code niet opnieuw af te leiden zonder te
        // gokken; liever leeg dan verkeerd.
        eNumberCode: null,
      })) satisfies ParsedIngredient[];

    return { parsedIngredients, hasIngredientsText: true };
  }

  return { parsedIngredients: [], hasIngredientsText: false };
}

/** De laatst opgeslagen analyse; de bron van waarheid voor de UI. */
export async function getLatestAnalysis(
  productId: string,
  db: typeof prisma = prisma,
): Promise<StoredAnalysis | null> {
  return findLatestAnalysis(productId, db);
}

export async function getAnalysisHistory(
  productId: string,
  limit = 20,
  db: typeof prisma = prisma,
): Promise<StoredAnalysis[]> {
  return listAnalyses(productId, limit, db);
}

/**
 * Analyseert een product en slaat de uitkomst op.
 *
 * @throws {AppError} met code `PRODUCT_NOT_FOUND` wanneer het product niet bestaat.
 */
export async function analyzeProduct(
  productId: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeProductResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? prisma;
  const log = logger.child({ productId });

  const product = await findProductById(productId, db);
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Dit product bestaat niet.", {
      details: { productId },
    });
  }

  log.info("PRODUCT_ANALYSIS_STARTED", {
    engineVersion: ENGINE_VERSION,
    force: options.force ?? false,
    // Bewust alleen het aantal, niet de lijst: een ingrediëntenlijst hoort niet
    // in de logs als een telling de vraag ook beantwoordt.
    ingredientCount: product.ingredients.length,
  });

  const { parsedIngredients, hasIngredientsText } = resolveAnalysisInput(product);
  const certificates: CertificateEvidence[] = await loadCertificateEvidence(productId, now, db);

  const evidenceInput: EvidenceInput = {
    parsedIngredients,
    hasIngredientsText,
    certificates,
    productRevisionId: null,
  };

  const inputHash = computeInputHash(evidenceInput);

  if (!options.force) {
    const existing = await findReusableAnalysis(productId, inputHash, ENGINE_VERSION, db);
    if (existing) {
      log.info("PRODUCT_ANALYSIS_CACHE_HIT", {
        analysisId: existing.id,
        engineVersion: ENGINE_VERSION,
      });
      return { analysis: existing, reused: true, product };
    }
  }

  const loader = options.referenceLoader ?? defaultReferenceLoader;
  const reference: HalalReference = await loader.load();

  log.debug("PRODUCT_ANALYSIS_REFERENCE_LOADED", {
    ingredientCount: reference.ingredients.length,
    eNumberCount: reference.eNumbers.length,
  });

  // De revisie waarop deze analyse rust. Achteraf is daarmee hard te zien welke
  // ingrediëntenlijst tot deze status leidde, ook nadat het product opnieuw
  // gesynchroniseerd is.
  const latestRevision = await db.productRevision.findFirst({
    where: { productId },
    orderBy: { revision: "desc" },
    select: { id: true },
  });

  const result = analyzeIngredients(
    { ...evidenceInput, productRevisionId: latestRevision?.id ?? null },
    reference,
    { now },
  );

  // Bevindingen die naar een certificaat verwijzen krijgen de koppeling terug;
  // de engine kent geen database-ids van certificaten.
  const activeCertificate = certificates.find((certificate) => certificate.isActive);
  const certificateIdByPosition: Record<number, string> = {};
  if (activeCertificate) {
    result.findings.forEach((finding, position) => {
      if (finding.findingType === "CERTIFICATE" || finding.findingType === "CONFLICT") {
        certificateIdByPosition[position] = activeCertificate.certificateId;
      }
    });
  }

  const saved = await saveAnalysis(
    {
      productId,
      analysis: result,
      certificateIdByPosition,
      triggeredByUserId: options.triggeredByUserId ?? null,
    },
    db,
  );

  if (result.hasConflict) {
    log.warn("PRODUCT_ANALYSIS_CONFLICT", {
      analysisId: saved.analysis.id,
      status: result.status,
      needsHumanReview: result.needsHumanReview,
    });
  }

  log.info("PRODUCT_ANALYSIS_COMPLETED", {
    analysisId: saved.analysis.id,
    status: result.status,
    confidence: result.confidence,
    findingCount: result.findings.length,
    reused: saved.reused,
    engineVersion: ENGINE_VERSION,
  });

  // Het product opnieuw laden: de transactie heeft de statuscache bijgewerkt en
  // de aanroeper verwacht het bijgewerkte record, niet het record van hiervoor.
  const refreshed = (await findProductById(productId, db)) ?? product;

  return { analysis: saved.analysis, reused: saved.reused, product: refreshed };
}

/**
 * Implementatie van de poort waarlangs de lookup-service analyseert. Bewust een
 * dun laagje: de lookup hoeft niets van analyses te weten behalve dat er een
 * bijgewerkt product uitkomt.
 */
export const productAnalyzer: ProductAnalyzerPort = {
  async analyzeAndPersist(productId, options) {
    const result = await analyzeProduct(productId, {
      now: options?.now,
      triggeredByUserId: options?.triggeredByUserId ?? null,
    });
    return result.product;
  },
};
