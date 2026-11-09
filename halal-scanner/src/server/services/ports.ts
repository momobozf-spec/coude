import type { ProductWithRelations } from "@/server/repositories/productRepository";

/**
 * Poorten waarlangs services elkaar aanroepen.
 *
 * De lookup-service moet een analyse kunnen aanstoten zonder de rules engine te
 * importeren: dat houdt de afhankelijkheid één kant op (engine kent geen
 * lookup) en maakt de lookup testbaar zonder een volledige engine.
 */
export interface ProductAnalyzerPort {
  /**
   * Analyseert het product, slaat een nieuwe `ProductAnalysis` op wanneer de
   * uitkomst wijzigt, en geeft het bijgewerkte product terug.
   */
  analyzeAndPersist(
    productId: string,
    options?: { now?: Date; triggeredByUserId?: string | null },
  ): Promise<ProductWithRelations>;
}
