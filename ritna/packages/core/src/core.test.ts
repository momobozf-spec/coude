import { describe, expect, it } from 'vitest';
import {
  applyBps,
  canTransition,
  customerCancellation,
  formatEur,
  haversineMeters,
  isConfirmed,
  isInServiceArea,
  isNightTime,
  noShow,
  noShowAllowed,
  operatorOrPlatformCancellation,
  quote,
  settle,
  vatFromGross,
  type CancellationPolicy,
  type Tariff,
} from './index.js';

const tariff: Tariff = {
  baseFare: 250,
  perKm: 200,
  perMinute: 30,
  minimumFare: 1200,
  nightSurcharge: 300,
  luggageSurchargePerItem: 100,
  freeLuggageItems: 2,
};

const policy: CancellationPolicy = {
  freeUntilMinutesBefore: 120,
  lateCancelBps: 5000,
  noShowBps: 10000,
  noShowWaitMinutes: 10,
};

describe('money', () => {
  it('rekent bps op centen', () => {
    expect(applyBps(4000, 1200)).toBe(480);
    expect(applyBps(333, 1250)).toBe(42); // 41,625 -> 42
  });
  it('haalt btw uit bruto', () => {
    expect(vatFromGross(10600, 600)).toBe(600);
  });
  it('weigert floats', () => {
    expect(() => applyBps(10.5, 100)).toThrow();
  });
  it('formatteert euro', () => {
    expect(formatEur(4005)).toBe('€40,05');
    expect(formatEur(-5)).toBe('-€0,05');
  });
});

describe('ritstatus', () => {
  it('alleen vervoerder aanvaardt', () => {
    expect(canTransition('requested', 'accepted', 'operator')).toBe(true);
    expect(canTransition('requested', 'accepted', 'customer')).toBe(false);
    expect(canTransition('requested', 'accepted', 'driver')).toBe(false);
  });
  it('aanvraag is geen bevestigde boeking', () => {
    expect(isConfirmed('requested')).toBe(false);
    expect(isConfirmed('accepted')).toBe(true);
  });
  it('rit kan niet voltooid zonder start', () => {
    expect(canTransition('driver_arrived', 'completed', 'driver')).toBe(false);
    expect(canTransition('in_progress', 'completed', 'driver')).toBe(true);
  });
  it('klant kan niet annuleren tijdens rit', () => {
    expect(canTransition('in_progress', 'cancelled_by_customer', 'customer')).toBe(false);
  });
  it('platform kan elke open rit annuleren, geen afgeronde', () => {
    expect(canTransition('in_progress', 'cancelled_by_platform', 'platform')).toBe(true);
    expect(canTransition('completed', 'cancelled_by_platform', 'platform')).toBe(false);
  });
});

describe('prijs', () => {
  const trip = { distanceMeters: 15_000, durationSeconds: 1_200 };
  it('berekent vaste prijs overdag', () => {
    const q = quote({ tariff, trip, pickupAt: new Date('2026-10-23T10:00:00Z'), luggageItems: 1 });
    // 250 + 15*200 + 20*30 = 3850
    expect(q.total).toBe(3850);
    expect(q.priceType).toBe('fixed');
  });
  it('voegt nacht- en bagagetoeslag toe', () => {
    const q = quote({ tariff, trip, pickupAt: new Date('2026-10-23T22:30:00Z'), luggageItems: 4 });
    // 00:30 Brussel = nacht; 2 extra stuks
    expect(q.total).toBe(3850 + 300 + 200);
  });
  it('past minimumtarief toe', () => {
    const q = quote({ tariff, trip: { distanceMeters: 1000, durationSeconds: 120 }, pickupAt: new Date('2026-10-23T10:00:00Z'), luggageItems: 0 });
    expect(q.total).toBe(1200);
    expect(q.lines.find((l) => l.code === 'minimum_topup')).toBeDefined();
  });
  it('nachtvenster over middernacht', () => {
    expect(isNightTime(new Date('2026-10-23T03:00:00Z'), { start: 22, end: 6 }, 'Europe/Brussels')).toBe(true);
    expect(isNightTime(new Date('2026-10-23T12:00:00Z'), { start: 22, end: 6 }, 'Europe/Brussels')).toBe(false);
  });
});

describe('commissie', () => {
  const agreement = { platformSourceBps: 1200, operatorChannelBps: 500 };
  it('verdeelt rit van €40 via platform', () => {
    const s = settle(4000, 'platform', agreement, 2100);
    expect(s.platformCommission).toBe(480);
    expect(s.commissionVat).toBe(101);
    expect(s.operatorPayout).toBe(4000 - 480 - 101);
    expect(s.platformCommission + s.commissionVat + s.operatorPayout).toBe(s.customerCharge);
  });
  it('lager tarief voor eigen kanaal', () => {
    expect(settle(4000, 'operator_channel', agreement, 2100).platformCommission).toBe(200);
  });
});

describe('annulering', () => {
  const pickup = new Date('2026-10-24T10:00:00Z');
  it('gratis zolang niet bevestigd', () => {
    expect(customerCancellation(4000, 'requested', pickup, new Date('2026-10-24T09:59:00Z'), policy).fee).toBe(0);
  });
  it('gratis binnen venster', () => {
    expect(customerCancellation(4000, 'accepted', pickup, new Date('2026-10-24T07:00:00Z'), policy).reason).toBe('free_window');
  });
  it('kost bij late annulering', () => {
    const o = customerCancellation(4000, 'accepted', pickup, new Date('2026-10-24T09:30:00Z'), policy);
    expect(o).toEqual({ fee: 2000, refund: 2000, reason: 'late_cancel' });
  });
  it('vervoerder annuleert: alles terug', () => {
    expect(operatorOrPlatformCancellation(4000).refund).toBe(4000);
  });
  it('no-show pas na wachttijd', () => {
    const arrived = new Date('2026-10-24T10:00:00Z');
    expect(noShowAllowed(arrived, new Date('2026-10-24T10:05:00Z'), policy)).toBe(false);
    expect(noShowAllowed(arrived, new Date('2026-10-24T10:10:00Z'), policy)).toBe(true);
    expect(noShow(4000, policy).fee).toBe(4000);
  });
});

describe('geo', () => {
  it('Brussel-Centraal naar Zaventem luchthaven ~11 km hemelsbreed', () => {
    const d = haversineMeters({ lat: 50.8455, lng: 4.3571 }, { lat: 50.9014, lng: 4.4844 });
    expect(d).toBeGreaterThan(10_000);
    expect(d).toBeLessThan(12_000);
  });
  it('dienstgebied', () => {
    const area = { center: { lat: 50.8467, lng: 4.3525 }, radiusMeters: 25_000 };
    expect(isInServiceArea({ lat: 50.9014, lng: 4.4844 }, area)).toBe(true);
    expect(isInServiceArea({ lat: 51.2194, lng: 4.4025 }, area)).toBe(false); // Antwerpen
  });
});
