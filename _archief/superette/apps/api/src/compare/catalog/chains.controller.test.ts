import { describe, expect, it } from 'vitest';
import { sourceStatusOf } from './chains.controller';

const now = new Date('2026-10-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const entry = (overrides: Partial<Parameters<typeof sourceStatusOf>[0]>) => ({
  slug: 'lidl',
  name: 'Lidl',
  hasData: true,
  lastObservedAt: hoursAgo(1),
  sourceKind: 'IMPORT_FILE' as const,
  termsReviewed: true,
  ...overrides,
});

describe('sourceStatusOf — wanneer is een keten live?', () => {
  it('is LIVE alleen met data, een echte bron, nagekeken voorwaarden en recente import', () => {
    expect(sourceStatusOf(entry({}), 48, now)).toBe('LIVE');
  });

  it('is nooit LIVE op demogegevens', () => {
    expect(sourceStatusOf(entry({ sourceKind: 'DEMO' }), 48, now)).toBe('DEMO');
  });

  it('is UNVERIFIED zonder nagekeken voorwaarden, ook met verse echte data', () => {
    expect(sourceStatusOf(entry({ termsReviewed: false }), 48, now)).toBe('UNVERIFIED');
  });

  it('is STALE na de versheidsgrens', () => {
    expect(sourceStatusOf(entry({ lastObservedAt: hoursAgo(72) }), 48, now)).toBe('STALE');
  });

  it('is UNAVAILABLE zonder geslaagde import', () => {
    expect(sourceStatusOf(entry({ hasData: false, lastObservedAt: null }), 48, now)).toBe('UNAVAILABLE');
  });
});
