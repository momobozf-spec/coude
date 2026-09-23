import { tokenJaccard, trigramSimilarity } from '@superrette/shared';
import type { MatchConfidence, MatchMethod, MatchStatus } from '@superrette/domain';
import type { NormalizedProduct } from './normalizer.js';

/** A canonical product considered as a match target. */
export interface MatchCandidate {
  productId: string;
  normalized: NormalizedProduct;
}

export interface MappingMemory {
  /** Canonical product a human confirmed for this retailer product, if any. */
  confirmedProductId?: string | null;
  /** Canonical products a human rejected for this retailer product. */
  rejectedProductIds?: readonly string[];
}

export interface MatchResult {
  productId: string | null;
  confidence: MatchConfidence;
  method: MatchMethod | null;
  score: number;
  reasons: string[];
  /** Next best candidates, for the admin review screen. */
  alternatives: { productId: string; score: number; confidence: MatchConfidence }[];
  /** What the pipeline should do with this result under the policy. */
  status: MatchStatus | 'CREATE_CANONICAL';
}

export interface MatchingPolicy {
  /** Confidences that may be linked without human review. */
  autoAccept: readonly MatchConfidence[];
  thresholds: { high: number; medium: number; low: number };
}

export const DEFAULT_MATCHING_POLICY: MatchingPolicy = {
  autoAccept: ['EXACT', 'HIGH'],
  thresholds: { high: 0.9, medium: 0.75, low: 0.5 },
};

interface Scored {
  productId: string;
  score: number;
  reasons: string[];
  strongIdentity: boolean;
}

const sizesEqual = (a: NormalizedProduct, b: NormalizedProduct): boolean | null => {
  if (!a.netContent || !b.netContent) return null;
  if (a.netContent.unit !== b.netContent.unit) return false;
  const max = Math.max(a.netContent.amount, b.netContent.amount);
  return Math.abs(a.netContent.amount - b.netContent.amount) <= max * 0.01;
};

const symmetricDifference = (a: readonly string[], b: readonly string[]): string[] => [
  ...a.filter((x) => !b.includes(x)),
  ...b.filter((x) => !a.includes(x)),
];

/**
 * ProductMatchingEngine links a retailer product to a canonical product
 * ("is this the SAME product?"). Priority:
 *   1. GTIN/EAN   2. confirmed human mapping   3. brand   4. name
 *   5. size/unit  6. category   7. fuzzy similarity
 * Low-confidence results are never auto-merged.
 */
export class ProductMatchingEngine {
  constructor(private readonly policy: MatchingPolicy = DEFAULT_MATCHING_POLICY) {}

  scoreCandidate(source: NormalizedProduct, target: NormalizedProduct): Omit<Scored, 'productId'> {
    const reasons: string[] = [];
    let score = 0;
    let cap = 1;

    // Brand (weight 0.25). Different known brands are never the same product.
    if (source.brand && target.brand) {
      if (source.brand.slug === target.brand.slug) {
        score += 0.25;
        reasons.push('brand:equal');
      } else {
        cap = Math.min(cap, 0.3);
        reasons.push('brand:different');
      }
    } else reasons.push('brand:unknown');

    // Name similarity (weight 0.35): best of canonical-token overlap and trigram similarity.
    const nameSim = Math.max(tokenJaccard(source.tokens, target.tokens), trigramSimilarity(source.name, target.name));
    score += 0.35 * nameSim;
    reasons.push(`name:${nameSim.toFixed(2)}`);

    // Size (weight 0.25). A different size is a different product.
    const sameSize = sizesEqual(source, target);
    if (sameSize === true) {
      score += 0.25;
      reasons.push('size:equal');
    } else if (sameSize === false) {
      cap = Math.min(cap, 0.4);
      reasons.push('size:different');
    } else reasons.push('size:unknown');

    // Product type (weight 0.1).
    if (source.productType && target.productType) {
      if (source.productType === target.productType) {
        score += 0.1;
        reasons.push('type:equal');
      } else {
        cap = Math.min(cap, 0.3);
        reasons.push('type:different');
      }
    }

    // Variants and flavours must agree ("Zero" is not "Regular").
    const variantConflict = symmetricDifference(source.variants, target.variants);
    const flavourConflict = symmetricDifference(source.flavours, target.flavours);
    if (variantConflict.length > 0 || flavourConflict.length > 0) {
      cap = Math.min(cap, 0.45);
      reasons.push(`variant:conflict(${[...variantConflict, ...flavourConflict].join(',')})`);
    }

    // Category (weight 0.05).
    if (source.categorySlug && source.categorySlug === target.categorySlug) {
      score += 0.05;
      reasons.push('category:equal');
    }

    const strongIdentity =
      sameSize === true &&
      source.brand?.slug != null &&
      source.brand.slug === target.brand?.slug &&
      variantConflict.length === 0 &&
      flavourConflict.length === 0;

    return { score: Math.round(Math.min(score, cap) * 1000) / 1000, reasons, strongIdentity };
  }

  confidenceFor(score: number, strongIdentity: boolean): MatchConfidence {
    const t = this.policy.thresholds;
    if (score >= t.high && strongIdentity) return 'HIGH';
    if (score >= t.medium) return 'MEDIUM';
    if (score >= t.low) return 'LOW';
    return 'UNMATCHED';
  }

  private statusFor(confidence: MatchConfidence, method: MatchMethod | null): MatchResult['status'] {
    if (method === 'CONFIRMED_MAPPING' || method === 'MANUAL') return 'CONFIRMED';
    if (confidence === 'UNMATCHED') return 'CREATE_CANONICAL';
    return this.policy.autoAccept.includes(confidence) ? 'AUTO_ACCEPTED' : 'PENDING_REVIEW';
  }

  match(source: NormalizedProduct, candidates: readonly MatchCandidate[], memory: MappingMemory = {}): MatchResult {
    const rejected = new Set(memory.rejectedProductIds ?? []);
    const pool = candidates.filter((c) => !rejected.has(c.productId));

    // 1. Human-confirmed mapping always wins and persists across imports.
    if (memory.confirmedProductId) {
      return {
        productId: memory.confirmedProductId,
        confidence: 'EXACT',
        method: 'CONFIRMED_MAPPING',
        score: 1,
        reasons: ['mapping:confirmed'],
        alternatives: [],
        status: 'CONFIRMED',
      };
    }

    // 2. GTIN identity.
    if (source.gtins.length > 0) {
      const byGtin = pool.filter((c) => c.normalized.gtins.some((g) => source.gtins.includes(g)));
      if (byGtin.length > 0) {
        const ranked = byGtin
          .map((c) => ({ c, s: this.scoreCandidate(source, c.normalized) }))
          .sort((a, b) => b.s.score - a.s.score);
        const best = ranked[0]!;
        const reasons = ['gtin:equal', ...best.s.reasons];
        if (byGtin.length > 1) reasons.push('gtin:ambiguous');
        return {
          productId: best.c.productId,
          confidence: 'EXACT',
          method: 'GTIN',
          score: 1,
          reasons,
          alternatives: ranked
            .slice(1)
            .map((r) => ({ productId: r.c.productId, score: r.s.score, confidence: 'EXACT' })),
          // Two canonical products sharing a GTIN is a data problem a human must resolve.
          status: byGtin.length > 1 ? 'PENDING_REVIEW' : this.statusFor('EXACT', 'GTIN'),
        };
      }
    }

    // 3-7. Attribute + fuzzy scoring.
    const scored: Scored[] = pool
      .map((c) => ({ productId: c.productId, ...this.scoreCandidate(source, c.normalized) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) {
      return {
        productId: null,
        confidence: 'UNMATCHED',
        method: null,
        score: 0,
        reasons: ['no-candidates'],
        alternatives: [],
        status: 'CREATE_CANONICAL',
      };
    }
    let confidence = this.confidenceFor(best.score, best.strongIdentity);
    const second = scored[1];
    const reasons = [...best.reasons];
    // Two near-identical candidates: do not auto-link, let a human decide.
    if (confidence === 'HIGH' && second && best.score - second.score < 0.03) {
      confidence = 'MEDIUM';
      reasons.push('ambiguous:close-second');
    }
    const method: MatchMethod = best.strongIdentity ? 'ATTRIBUTES' : 'FUZZY';
    return {
      productId: confidence === 'UNMATCHED' ? null : best.productId,
      confidence,
      method: confidence === 'UNMATCHED' ? null : method,
      score: best.score,
      reasons,
      alternatives: scored.slice(1, 6).map((s) => ({
        productId: s.productId,
        score: s.score,
        confidence: this.confidenceFor(s.score, s.strongIdentity),
      })),
      status: this.statusFor(confidence, method),
    };
  }
}
