import { describe, expect, it } from 'vitest';
import { ProductEquivalenceEngine, type EquivalenceSubject } from './equivalence-engine.js';
import { ProductNormalizer } from './normalizer.js';

const n = new ProductNormalizer();
const engine = new ProductEquivalenceEngine();
const subject = (productId: string, title: string, gtins: string[] = []): EquivalenceSubject => ({
  productId,
  normalized: n.normalize({ title, gtins }),
});

const boni = subject('boni-milk', 'Boni Halfvolle Melk 1L');
const pool = [
  subject('ah-milk', 'AH Halfvolle melk 1L'),
  subject('campina-milk', 'Campina Halfvolle Melk 1L'),
  subject('ah-milk-2l', 'AH Halfvolle melk 2L'),
  subject('ah-whole', 'AH Volle melk 1L'),
  subject('ah-lactosefree', 'AH Halfvolle melk lactosevrij 1L'),
  subject('cola', 'Coca-Cola Zero 1,5L'),
];

describe('ProductEquivalenceEngine', () => {
  it('finds Boni Halfvolle Melk ≈ AH Halfvolle Melk with high confidence', () => {
    const results = engine.findEquivalents(boni, pool);
    expect(results[0]).toMatchObject({ sourceProduct: 'boni-milk', targetProduct: 'ah-milk', matchType: 'EQUIVALENT' });
    expect(results[0]!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('ranks house brand ↔ house brand above A-brands by default', () => {
    const results = engine.findEquivalents(boni, pool);
    const ah = results.find((r) => r.targetProduct === 'ah-milk')!;
    const campina = results.find((r) => r.targetProduct === 'campina-milk')!;
    expect(ah.confidence).toBeGreaterThan(campina.confidence);
  });

  it('excludes other product types and variants (whole milk, cola)', () => {
    const ids = engine.findEquivalents(boni, pool).map((r) => r.targetProduct);
    expect(ids).not.toContain('ah-whole');
    expect(ids).not.toContain('cola');
  });

  it('penalises a different pack size', () => {
    const results = engine.findEquivalents(boni, pool, { minConfidence: 0 });
    const oneLitre = results.find((r) => r.targetProduct === 'ah-milk')!;
    const twoLitre = results.find((r) => r.targetProduct === 'ah-milk-2l')!;
    expect(twoLitre.confidence).toBeLessThan(oneLitre.confidence);
  });

  it('preserves strict dietary needs', () => {
    const lactoseFree = subject('lf', 'Campina Halfvolle Melk Lactosevrij 1L');
    const ids = engine.findEquivalents(lactoseFree, pool).map((r) => r.targetProduct);
    expect(ids).toEqual(['ah-lactosefree']);
  });

  it('treats a shared GTIN as EXACT', () => {
    const a = subject('a', 'Coca-Cola Zero 1.5L', ['5449000131805']);
    const b = subject('b', 'Coke zero PET', ['5449000131805']);
    expect(engine.evaluate(a, b)).toMatchObject({ matchType: 'EXACT', confidence: 1 });
  });

  it('honours a same-brand preference', () => {
    const results = engine.findEquivalents(subject('campina-src', 'Campina Halfvolle Melk 1L'), pool, { brandPreference: 'same' });
    expect(results[0]!.targetProduct).toBe('campina-milk');
  });
});
