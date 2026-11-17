import { describe, expect, it } from 'vitest';
import { coordinatesForPostalCode, distanceToNearestKm, haversineKm, roundKm } from './geo';

describe('haversineKm — hemelsbrede afstand', () => {
  it('is 0 tussen een punt en zichzelf', () => {
    expect(haversineKm({ latitude: 51.2211, longitude: 4.3997 }, { latitude: 51.2211, longitude: 4.3997 })).toBe(0);
  });

  it('Antwerpen – Gent is ongeveer 51 km', () => {
    const km = haversineKm({ latitude: 51.2211, longitude: 4.3997 }, { latitude: 51.0397, longitude: 3.7142 });
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(53);
  });

  it('is symmetrisch', () => {
    const a = { latitude: 50.8465, longitude: 4.3517 };
    const b = { latitude: 50.751, longitude: 5.3018 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe('coordinatesForPostalCode — postcode → midden van de postcode', () => {
  it('kent Heers (3870)', () => {
    const point = coordinatesForPostalCode('3870');
    expect(point).not.toBeNull();
    expect(point!.latitude).toBeGreaterThan(50.7);
    expect(point!.latitude).toBeLessThan(50.8);
    expect(point!.longitude).toBeGreaterThan(5.2);
    expect(point!.longitude).toBeLessThan(5.4);
  });

  it('kent de grote steden', () => {
    for (const code of ['1000', '2000', '3000', '4000', '5000', '6000', '8000', '9000']) {
      expect(coordinatesForPostalCode(code), code).not.toBeNull();
    }
  });

  it('geeft null voor een onbestaande of ongeldige postcode', () => {
    expect(coordinatesForPostalCode('0000')).toBeNull();
    expect(coordinatesForPostalCode('9999')).toBeNull();
    expect(coordinatesForPostalCode('abcd')).toBeNull();
    expect(coordinatesForPostalCode('')).toBeNull();
    expect(coordinatesForPostalCode(null)).toBeNull();
  });
});

describe('distanceToNearestKm — dichtstbijzijnde filiaal', () => {
  const origin = { latitude: 51.2211, longitude: 4.3997 }; // Antwerpen 2000

  it('kiest het dichtstbijzijnde van meerdere filialen', () => {
    const nearest = distanceToNearestKm(origin, [
      { id: 'gent', latitude: 51.0397, longitude: 3.7142 },
      { id: 'berchem', latitude: 51.1902, longitude: 4.4296 },
      { id: 'brugge', latitude: 51.2231, longitude: 3.2219 },
    ]);
    expect(nearest?.id).toBe('berchem');
    expect(nearest?.distanceKm).toBeLessThan(5);
  });

  it('slaat filialen zonder coördinaten over', () => {
    const nearest = distanceToNearestKm(origin, [
      { id: 'onbekend', latitude: null, longitude: null },
      { id: 'gent', latitude: 51.0397, longitude: 3.7142 },
    ]);
    expect(nearest?.id).toBe('gent');
  });

  it('geeft null zonder bruikbare filialen', () => {
    expect(distanceToNearestKm(origin, [])).toBeNull();
    expect(distanceToNearestKm(origin, [{ id: 'x', latitude: null, longitude: 4 }])).toBeNull();
  });
});

describe('roundKm — afronden op 0,1 km', () => {
  it('rondt op één decimaal', () => {
    expect(roundKm(3.26)).toBe(3.3);
    expect(roundKm(0.04)).toBe(0);
    expect(roundKm(12)).toBe(12);
  });
});
