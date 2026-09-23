import { tokenJaccard, trigramSimilarity } from '@superrette/shared';
import type { NormalizedProduct } from './normalizer.js';

/**
 * Pluggable semantic similarity. The default is lexical (canonical tokens +
 * trigrams, with NL/FR/EN synonyms already resolved by the normaliser).
 * An embedding-based scorer can be supplied later without touching engines.
 */
export interface SimilarityScorer {
  similarity(a: NormalizedProduct, b: NormalizedProduct): number;
}

export const lexicalSimilarity: SimilarityScorer = {
  similarity(a, b) {
    const tokens = tokenJaccard(a.tokens, b.tokens);
    const tri = trigramSimilarity(a.name, b.name);
    return Math.max(tokens, 0.8 * tri);
  },
};
