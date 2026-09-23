import { inArray, sql } from 'drizzle-orm';
import { productEquivalences, type Database } from '@superrette/database';
import { ProductEquivalenceEngine, type NormalizedProduct } from '@superrette/product-matching';

type VariantRow = {
  id: string;
  productId: string;
  normalized: NormalizedProduct;
  [key: string]: unknown;
};

/**
 * EquivalenceIndexer precomputes SUGGESTED equivalences between canonical
 * variants (e.g. Boni Halfvolle Melk ≈ AH Halfvolle Melk). Human decisions
 * (CONFIRMED/REJECTED) are never overwritten.
 */
export class EquivalenceIndexer {
  constructor(
    private readonly db: Database,
    private readonly engine = new ProductEquivalenceEngine(),
  ) {}

  async refresh(variantIds?: readonly string[]): Promise<{ evaluated: number; suggested: number }> {
    const all = await this.db.execute<VariantRow>(sql`
      SELECT id, product_id AS "productId", normalized FROM catalog.product_variants
      WHERE normalized->>'productType' IS NOT NULL OR normalized->>'categorySlug' IS NOT NULL
    `);
    const groups = new Map<string, VariantRow[]>();
    for (const row of all.rows) {
      const key = row.normalized.productType ?? `category:${row.normalized.categorySlug}`;
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }
    const sources = variantIds ? new Set(variantIds) : null;
    let evaluated = 0;
    const suggestions: { sourceVariantId: string; targetVariantId: string; confidence: number; reasons: string[] }[] =
      [];
    for (const members of groups.values()) {
      for (const source of members) {
        if (sources && !sources.has(source.id)) continue;
        const candidates = members.filter((m) => m.id !== source.id && m.productId !== source.productId);
        evaluated += candidates.length;
        for (const r of this.engine.findEquivalents(
          { productId: source.id, normalized: source.normalized },
          candidates.map((c) => ({ productId: c.id, normalized: c.normalized })),
        )) {
          if (r.matchType !== 'EQUIVALENT') continue;
          suggestions.push({
            sourceVariantId: r.sourceProduct,
            targetVariantId: r.targetProduct,
            confidence: r.confidence,
            reasons: r.reasons,
          });
        }
      }
    }
    if (variantIds && variantIds.length > 0) {
      // Drop stale suggestions for refreshed sources; keep human decisions.
      await this.db.execute(sql`
        DELETE FROM catalog.product_equivalences
        WHERE status = 'SUGGESTED' AND source_variant_id IN (${sql.join(
          variantIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
      `);
    }
    for (let i = 0; i < suggestions.length; i += 500) {
      await this.db
        .insert(productEquivalences)
        .values(suggestions.slice(i, i + 500).map((s) => ({ ...s, status: 'SUGGESTED' as const })))
        .onConflictDoUpdate({
          target: [productEquivalences.sourceVariantId, productEquivalences.targetVariantId],
          set: {
            confidence: sql`CASE WHEN ${productEquivalences.status} = 'SUGGESTED' THEN excluded.confidence ELSE ${productEquivalences.confidence} END`,
            reasons: sql`excluded.reasons`,
            updatedAt: new Date(),
          },
        });
    }
    return { evaluated, suggested: suggestions.length };
  }

  /** Equivalents for one variant, excluding rejected pairs, best first. */
  async forVariant(variantId: string): Promise<{ targetVariantId: string; confidence: number; status: string }[]> {
    const rows = await this.db
      .select({
        targetVariantId: productEquivalences.targetVariantId,
        confidence: productEquivalences.confidence,
        status: productEquivalences.status,
      })
      .from(productEquivalences)
      .where(inArray(productEquivalences.sourceVariantId, [variantId]));
    return rows.filter((r) => r.status !== 'REJECTED').sort((a, b) => b.confidence - a.confidence);
  }
}
