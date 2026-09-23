import type { DietaryAttribute } from '@superrette/domain';
import type { NormalizedProduct } from './normalizer.js';
import { lexicalSimilarity, type SimilarityScorer } from './similarity.js';

export interface EquivalenceSubject {
  productId: string;
  normalized: NormalizedProduct;
}

export interface EquivalencePreferences {
  /** "same" keeps the brand if possible, "private_label" favours house brands. */
  brandPreference?: 'any' | 'same' | 'private_label';
  /** Accept target sizes within ±tolerance of the source (0.25 = 750 ml..1.25 l for 1 l). */
  sizeTolerance?: number;
  minConfidence?: number;
}

export interface EquivalenceResult {
  sourceProduct: string;
  targetProduct: string;
  matchType: 'EXACT' | 'EQUIVALENT';
  confidence: number;
  reasons: string[];
}

/** Dietary attributes a shopper relies on: an equivalent must keep them. */
const STRICT_DIETARY: readonly DietaryAttribute[] = [
  'lactose_free',
  'gluten_free',
  'vegan',
  'vegetarian',
  'halal',
  'sugar_free',
];

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * ProductEquivalenceEngine answers "what is the closest comparable product
 * at another supermarket?" — e.g. Boni Halfvolle Melk 1L ≈ AH Halfvolle
 * Melk 1L — even across brands and GTINs.
 */
export class ProductEquivalenceEngine {
  constructor(private readonly scorer: SimilarityScorer = lexicalSimilarity) {}

  evaluate(
    source: EquivalenceSubject,
    target: EquivalenceSubject,
    prefs: EquivalencePreferences = {},
  ): EquivalenceResult | null {
    const s = source.normalized;
    const t = target.normalized;
    const reasons: string[] = [];

    if (source.productId === target.productId || s.gtins.some((g) => t.gtins.includes(g))) {
      return {
        sourceProduct: source.productId,
        targetProduct: target.productId,
        matchType: 'EXACT',
        confidence: 1,
        reasons: ['identity'],
      };
    }

    // Product type: must agree when both known.
    let typeScore: number;
    if (s.productType && t.productType) {
      if (s.productType !== t.productType) return null;
      typeScore = 1;
      reasons.push(`type:${s.productType}`);
    } else if (s.categorySlug && s.categorySlug === t.categorySlug) {
      typeScore = 0.4;
      reasons.push('type:unknown,category:equal');
    } else {
      return null;
    }

    // Variants/flavours must agree: cola zero is not equivalent to regular cola.
    const variantMismatch =
      s.variants.some((v) => !t.variants.includes(v)) || t.variants.some((v) => !s.variants.includes(v));
    const flavourMismatch =
      s.flavours.some((f) => !t.flavours.includes(f)) || t.flavours.some((f) => !s.flavours.includes(f));
    if (variantMismatch || flavourMismatch) return null;

    // Dietary guarantees must be preserved.
    for (const attr of STRICT_DIETARY) {
      if (s.dietary.includes(attr) && !t.dietary.includes(attr)) return null;
    }
    let dietaryScore = 1;
    if (s.dietary.includes('organic') && !t.dietary.includes('organic')) {
      dietaryScore = 0.3;
      reasons.push('dietary:loses-organic');
    }

    // Quantity: same dimension, within tolerance.
    const tolerance = prefs.sizeTolerance ?? 0.25;
    let sizeScore = 0.5;
    if (s.netContent && t.netContent) {
      if (s.netContent.unit !== t.netContent.unit) return null;
      const ratio = t.netContent.amount / s.netContent.amount;
      const deviation = Math.abs(Math.log(ratio));
      const maxDeviation = Math.log(1 + tolerance);
      if (deviation > Math.log(2)) return null;
      sizeScore = deviation <= 1e-9 ? 1 : deviation <= maxDeviation ? 1 - 0.5 * (deviation / maxDeviation) : 0.2;
      reasons.push(`size:ratio=${round2(ratio)}`);
    } else {
      reasons.push('size:unknown');
    }

    // Brand preference.
    const sameBrand = s.brand?.slug != null && s.brand.slug === t.brand?.slug;
    const bothPrivate = Boolean(s.brand?.privateLabelOf && t.brand?.privateLabelOf);
    let brandScore = sameBrand ? 1 : bothPrivate ? 0.8 : 0.5;
    if (prefs.brandPreference === 'same' && !sameBrand) brandScore = 0.2;
    if (prefs.brandPreference === 'private_label') brandScore = t.brand?.privateLabelOf ? 1 : 0.4;
    if (sameBrand) reasons.push('brand:equal');
    else if (bothPrivate) reasons.push('brand:both-private-label');

    const semantic = this.scorer.similarity(s, t);
    reasons.push(`semantic:${round2(semantic)}`);

    const confidence = round2(
      0.35 * typeScore +
        0.2 * sizeScore +
        0.2 * semantic +
        0.1 * brandScore +
        0.1 * dietaryScore +
        0.05 * (s.categorySlug === t.categorySlug ? 1 : 0),
    );
    if (confidence < (prefs.minConfidence ?? 0.6)) return null;
    return {
      sourceProduct: source.productId,
      targetProduct: target.productId,
      matchType: 'EQUIVALENT',
      confidence,
      reasons,
    };
  }

  findEquivalents(
    source: EquivalenceSubject,
    candidates: readonly EquivalenceSubject[],
    prefs: EquivalencePreferences = {},
  ): EquivalenceResult[] {
    return candidates
      .map((c) => this.evaluate(source, c, prefs))
      .filter((r): r is EquivalenceResult => r !== null)
      .sort((a, b) => b.confidence - a.confidence || a.targetProduct.localeCompare(b.targetProduct));
  }
}
