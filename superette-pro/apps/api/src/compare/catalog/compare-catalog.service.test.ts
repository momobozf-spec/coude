import { describe, expect, it } from 'vitest';
import { offerDistanceKm, withinMaxDistance } from './compare-catalog.service';

const antwerpen = { latitude: 51.2211, longitude: 4.3997 };
const nearestOfChain = { id: 'berchem', location: { id: 'berchem', latitude: 51.1902, longitude: 4.4296 }, distanceKm: 4.1 };

describe('offerDistanceKm — afstand van een aanbod', () => {
  it('is onbekend zonder vertrekpunt', () => {
    expect(offerDistanceKm(undefined, { latitude: 51.19, longitude: 4.43 }, nearestOfChain)).toBeNull();
  });

  it('meet naar het eigen filiaal als dat coördinaten heeft', () => {
    const km = offerDistanceKm(antwerpen, { latitude: 51.0397, longitude: 3.7142 }, nearestOfChain);
    expect(km).toBeGreaterThan(50);
  });

  it('valt terug op het dichtstbijzijnde filiaal van de keten', () => {
    expect(offerDistanceKm(antwerpen, null, nearestOfChain)).toBe(4.1);
    expect(offerDistanceKm(antwerpen, { latitude: null, longitude: null }, nearestOfChain)).toBe(4.1);
  });

  it('is onbekend als de keten geen filiaal met coördinaten heeft', () => {
    expect(offerDistanceKm(antwerpen, null, undefined)).toBeNull();
  });
});

describe('withinMaxDistance', () => {
  it('sluit nooit een onbekende afstand uit', () => {
    expect(withinMaxDistance(null, 5)).toBe(true);
  });
  it('laat alles door zonder grens', () => {
    expect(withinMaxDistance(80, undefined)).toBe(true);
    expect(withinMaxDistance(80, null)).toBe(true);
  });
  it('vergelijkt inclusief', () => {
    expect(withinMaxDistance(5, 5)).toBe(true);
    expect(withinMaxDistance(5.1, 5)).toBe(false);
  });
});
