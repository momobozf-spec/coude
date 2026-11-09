/**
 * Persistence van analyses.
 *
 * Drie regels sturen deze module:
 *
 *  1. EEN ANALYSE IS HISTORISCH. Er wordt nooit een bestaande `ProductAnalysis`
 *     ge-update. Een nieuwe beoordeling is een nieuw record. Zo blijft achteraf
 *     reconstrueerbaar welke ingrediëntenlijst onder welke regels tot welke
 *     status leidde — bij een halal-oordeel is dat geen luxe.
 *
 *  2. ANALYSE, FINDINGS EN CACHE GAAN SAMEN OF NIET. Alle drie in één
 *     transactie. Zonder dat kan `Product.halalStatus` groen blijven terwijl de
 *     onderliggende analyse rood is, en dan liegt de app tegen de gebruiker.
 *
 *  3. DE DATABASE BESLIST OVER DUBBELE ANALYSES, NIET DE APPLICATIE. De unique
 *     constraint op (productId, inputHash, engineVersion) is de enige echte
 *     bescherming tegen twee gelijktijdige requests. Een check-then-insert in
 *     applicatiecode heeft altijd een venster tussen check en insert.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalysisResult } from "@/server/halal/engine";
import type { IngredientFinding } from "@/types/halal";

type Db = Prisma.TransactionClient | typeof prisma;

export const UNIQUE_VIOLATION = "P2002";

export interface StoredAnalysis {
  id: string;
  productId: string;
  status: AnalysisResult["status"];
  confidence: AnalysisResult["confidence"];
  summary: string;
  engineVersion: string;
  inputHash: string;
  hasConflict: boolean;
  needsHumanReview: boolean;
  productRevisionId: string | null;
  createdAt: Date;
  findings: StoredFinding[];
}

export interface StoredFinding {
  id: string;
  findingType: IngredientFinding["findingType"];
  status: IngredientFinding["status"];
  confidence: IngredientFinding["confidence"];
  label: string;
  reason: string;
  ingredientId: string | null;
  eNumberId: string | null;
  certificateId: string | null;
  sourceId: string | null;
  position: number;
}

const ANALYSIS_INCLUDE = {
  findings: { orderBy: { position: "asc" } },
} as const;

/**
 * De cachecontrole. Dezelfde input onder dezelfde engineversie betekent per
 * definitie dezelfde uitkomst, dus opnieuw rekenen kan niets opleveren.
 */
export async function findReusableAnalysis(
  productId: string,
  inputHash: string,
  engineVersion: string,
  db: Db = prisma,
): Promise<StoredAnalysis | null> {
  const row = await db.productAnalysis.findUnique({
    where: {
      productId_inputHash_engineVersion: { productId, inputHash, engineVersion },
    },
    include: ANALYSIS_INCLUDE,
  });
  return row as StoredAnalysis | null;
}

export async function findLatestAnalysis(
  productId: string,
  db: Db = prisma,
): Promise<StoredAnalysis | null> {
  const row = await db.productAnalysis.findFirst({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: ANALYSIS_INCLUDE,
  });
  return row as StoredAnalysis | null;
}

export async function listAnalyses(
  productId: string,
  limit: number,
  db: Db = prisma,
): Promise<StoredAnalysis[]> {
  const rows = await db.productAnalysis.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: ANALYSIS_INCLUDE,
  });
  return rows as StoredAnalysis[];
}

export interface SaveAnalysisInput {
  productId: string;
  analysis: AnalysisResult;
  /** Ids van de bevindingen die naar een certificaat verwijzen, op positie. */
  certificateIdByPosition?: Record<number, string>;
  triggeredByUserId?: string | null;
}

/**
 * Schrijft analyse, findings en de statuscache weg in één transactie.
 *
 * Loopt hij op de unique constraint (een gelijktijdige request was net eerder),
 * dan is dat geen fout: de winnaar heeft exact dezelfde uitkomst weggeschreven,
 * want dezelfde hash betekent dezelfde input. We lezen dat record terug en gaan
 * verder. Dat is precies waarom de constraint bestaat.
 */
export async function saveAnalysis(
  input: SaveAnalysisInput,
  db: typeof prisma = prisma,
): Promise<{ analysis: StoredAnalysis; reused: boolean }> {
  const { analysis, productId } = input;

  try {
    const stored = await db.$transaction(async (tx) => {
      const created = await tx.productAnalysis.create({
        data: {
          productId,
          status: analysis.status,
          confidence: analysis.confidence,
          summary: analysis.summary,
          engineVersion: analysis.engineVersion,
          inputHash: analysis.inputHash,
          hasConflict: analysis.hasConflict,
          needsHumanReview: analysis.needsHumanReview,
          productRevisionId: analysis.productRevisionId,
          triggeredByUserId: input.triggeredByUserId ?? null,
          findings: {
            create: analysis.findings.map((finding, position) => ({
              findingType: finding.findingType,
              status: finding.status,
              confidence: finding.confidence,
              label: finding.label,
              reason: finding.reason,
              ingredientId: finding.ingredientId,
              eNumberId: finding.eNumberId,
              certificateId: input.certificateIdByPosition?.[position] ?? null,
              sourceId: finding.source?.id ?? null,
              position,
            })),
          },
        },
        include: ANALYSIS_INCLUDE,
      });

      // De denormalized cache. Bron van waarheid blijft de laatste
      // ProductAnalysis + haar findings; dit is uitsluitend om lijsten en
      // zoekresultaten te kunnen tonen zonder per product een analyse te joinen.
      await tx.product.update({
        where: { id: productId },
        data: {
          halalStatus: analysis.status,
          confidenceLevel: analysis.confidence,
          needsHumanReview: analysis.needsHumanReview,
          analysisVersion: analysis.engineVersion,
          lastAnalyzedAt: new Date(analysis.analyzedAt),
        },
      });

      return created as StoredAnalysis;
    });

    return { analysis: stored, reused: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      const existing = await findReusableAnalysis(
        productId,
        analysis.inputHash,
        analysis.engineVersion,
        db,
      );
      if (existing) return { analysis: existing, reused: true };
    }
    throw error;
  }
}
