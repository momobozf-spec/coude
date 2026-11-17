import { describe, expect, it } from 'vitest';
import { CHAINS, offer } from '../test-fixtures';
import { distanceFilter, pickBestOffer } from './search.service';

describe('pickBestOffer — sorteren op afstand', () => {
  it('kiest het dichtstbijzijnde aanbod, niet het goedkoopste', () => {
    const far = offer({ storeChain: CHAINS.delhaize!, priceCents: 100, distanceKm: 18 });
    const near = offer({ storeChain: CHAINS.lidl!, priceCents: 150, distanceKm: 2.5 });
    expect(pickBestOffer([far, near], 'DISTANCE')?.id).toBe(near.id);
  });

  it('zet onbekende afstand achteraan', () => {
    const unknown = offer({ storeChain: CHAINS.colruyt!, priceCents: 90, distanceKm: null });
    const near = offer({ storeChain: CHAINS.lidl!, priceCents: 150, distanceKm: 2.5 });
    expect(pickBestOffer([unknown, near], 'DISTANCE')?.id).toBe(near.id);
  });

  it('valt bij gelijke afstand terug op de eenheidsprijs', () => {
    const dear = offer({ storeChain: CHAINS.delhaize!, priceCents: 200, distanceKm: 3 });
    const cheap = offer({ storeChain: CHAINS.lidl!, priceCents: 120, distanceKm: 3 });
    expect(pickBestOffer([dear, cheap], 'DISTANCE')?.id).toBe(cheap.id);
  });

  it('gedraagt zich zonder postcode als eenheidsprijs (alle afstanden onbekend)', () => {
    const dear = offer({ storeChain: CHAINS.delhaize!, priceCents: 200 });
    const cheap = offer({ storeChain: CHAINS.lidl!, priceCents: 120 });
    expect(pickBestOffer([dear, cheap], 'DISTANCE')?.id).toBe(cheap.id);
  });
});

describe('distanceFilter — van query naar vertrekpunt', () => {
  it('geeft niets zonder postcode', () => {
    expect(distanceFilter({})).toEqual({});
  });

  it('negeert een maximale afstand zonder postcode', () => {
    expect(distanceFilter({ maxDistanceKm: 10 })).toEqual({});
  });

  it('zet het midden van de postcode en de grens', () => {
    const filter = distanceFilter({ postalCode: '2000', maxDistanceKm: 10 });
    expect(filter.origin?.latitude).toBeCloseTo(51.22, 1);
    expect(filter.maxDistanceKm).toBe(10);
  });

  it('geeft niets voor een onbekende postcode', () => {
    expect(distanceFilter({ postalCode: '9999' })).toEqual({});
  });
});
