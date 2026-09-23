import { describe, expect, it } from 'vitest';
import { ProductMatchingEngine, type MatchCandidate } from './matching-engine.js';
import { ProductNormalizer } from './normalizer.js';

const n = new ProductNormalizer();
const engine = new ProductMatchingEngine();

const candidates: MatchCandidate[] = [
  { productId: 'cola-zero-15', normalized: n.normalize({ title: 'Coca-Cola Zero Sugar 1,5L', gtins: ['5449000131805'] }) },
  { productId: 'cola-regular-15', normalized: n.normalize({ title: 'Coca-Cola Original 1,5L' }) },
  { productId: 'cola-zero-33', normalized: n.normalize({ title: 'Coca-Cola Zero Sugar blik 33cl' }) },
  { productId: 'ah-milk-1l', normalized: n.normalize({ title: 'AH Halfvolle melk 1L' }) },
  { productId: 'campina-milk-1l', normalized: n.normalize({ title: 'Campina Halfvolle melk 1L' }) },
];

describe('ProductMatchingEngine', () => {
  it('matches on GTIN first (EXACT, auto-accepted)', () => {
    const r = engine.match(n.normalize({ title: 'Cola Zero PET', gtins: ['5449000131805'] }), candidates);
    expect(r).toMatchObject({ productId: 'cola-zero-15', confidence: 'EXACT', method: 'GTIN', status: 'AUTO_ACCEPTED' });
  });

  it('confirmed human mappings win over everything and persist', () => {
    const r = engine.match(n.normalize({ title: 'Something else' }), candidates, { confirmedProductId: 'ah-milk-1l' });
    expect(r).toMatchObject({ productId: 'ah-milk-1l', confidence: 'EXACT', method: 'CONFIRMED_MAPPING', status: 'CONFIRMED' });
  });

  it('matches same brand + name + size with HIGH confidence', () => {
    const r = engine.match(n.normalize({ title: 'Coca Cola Zero Sugar 1500ml' }), candidates);
    expect(r.productId).toBe('cola-zero-15');
    expect(r.confidence).toBe('HIGH');
    expect(r.status).toBe('AUTO_ACCEPTED');
  });

  it('never merges a different size or variant', () => {
    const can = engine.match(n.normalize({ title: 'Coca-Cola Zero 33 cl' }), candidates);
    expect(can.productId).toBe('cola-zero-33');
    const regular = engine.match(n.normalize({ title: 'Coca-Cola 1,5 liter' }), [candidates[0]!]);
    expect(['LOW', 'UNMATCHED']).toContain(regular.confidence);
    expect(regular.status).not.toBe('AUTO_ACCEPTED');
  });

  it('never matches different brands as the same product', () => {
    const r = engine.match(n.normalize({ title: 'Jumbo Halfvolle melk 1L' }), candidates);
    expect(['LOW', 'UNMATCHED']).toContain(r.confidence);
    expect(r.status).not.toBe('AUTO_ACCEPTED');
  });

  it('sends medium confidence to review when the brand is unknown', () => {
    const r = engine.match(n.normalize({ title: 'Halfvolle melk 1 liter' }), [candidates[3]!]);
    expect(['MEDIUM', 'LOW']).toContain(r.confidence);
    expect(r.status).toBe('PENDING_REVIEW');
  });

  it('respects rejected mappings', () => {
    const r = engine.match(n.normalize({ title: 'AH Halfvolle melk 1 L' }), candidates, { rejectedProductIds: ['ah-milk-1l'] });
    expect(r.productId).not.toBe('ah-milk-1l');
  });

  it('asks to create a canonical product when nothing matches', () => {
    const r = engine.match(n.normalize({ title: 'Lotus Speculoos 250g' }), candidates);
    expect(r.confidence).toBe('UNMATCHED');
    expect(r.status).toBe('CREATE_CANONICAL');
    expect(r.productId).toBeNull();
  });

  it('flags GTIN conflicts for review', () => {
    const dup: MatchCandidate = { productId: 'dup', normalized: n.normalize({ title: 'Coke Zero', gtins: ['5449000131805'] }) };
    const r = engine.match(n.normalize({ title: 'Coca-Cola Zero', gtins: ['5449000131805'] }), [...candidates, dup]);
    expect(r.confidence).toBe('EXACT');
    expect(r.status).toBe('PENDING_REVIEW');
    expect(r.reasons).toContain('gtin:ambiguous');
  });
});
