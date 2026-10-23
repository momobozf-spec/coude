import { assertCents, type Cents } from './money.js';

/**
 * Tarief zoals het taxibedrijf het instelt per voertuigcategorie.
 * Ritna bepaalt de prijs NIET: de vervoerder doet dat binnen de regels die op
 * hem van toepassing zijn. Het platform rekent enkel.
 */
export interface Tariff {
  baseFare: Cents; // instaptarief
  perKm: Cents;
  perMinute: Cents;
  minimumFare: Cents;
  /** Toeslagen in centen, bv. nacht of grote bagage. */
  nightSurcharge: Cents;
  luggageSurchargePerItem: Cents;
  /** Gratis bagagestukken voor de toeslag geldt. */
  freeLuggageItems: number;
}

export interface TripEstimate {
  distanceMeters: number;
  durationSeconds: number;
}

export interface QuoteInput {
  tariff: Tariff;
  trip: TripEstimate;
  pickupAt: Date;
  luggageItems: number;
  /** Nachturen [startUur, eindUur) lokale tijd Europe/Brussels. */
  nightHours?: { start: number; end: number };
  timeZone?: string;
}

export interface QuoteLine {
  code: 'base' | 'distance' | 'time' | 'minimum_topup' | 'night' | 'luggage';
  amount: Cents;
}

export interface Quote {
  total: Cents;
  lines: QuoteLine[];
  /** Vaste prijs bij vooraf boeken: dit bedrag wordt aangerekend, niet de meter. */
  priceType: 'fixed';
}

function localHour(date: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date);
  return Number(h);
}

export function isNightTime(date: Date, night: { start: number; end: number }, timeZone: string): boolean {
  const h = localHour(date, timeZone);
  return night.start > night.end ? h >= night.start || h < night.end : h >= night.start && h < night.end;
}

export function quote(input: QuoteInput): Quote {
  const { tariff, trip } = input;
  for (const [k, v] of Object.entries(tariff)) {
    if (k !== 'freeLuggageItems') assertCents(v as number, k);
  }
  if (trip.distanceMeters < 0 || trip.durationSeconds < 0) throw new Error('negatieve rit-schatting');

  const lines: QuoteLine[] = [];
  lines.push({ code: 'base', amount: tariff.baseFare });
  lines.push({ code: 'distance', amount: Math.round((trip.distanceMeters / 1000) * tariff.perKm) });
  lines.push({ code: 'time', amount: Math.round((trip.durationSeconds / 60) * tariff.perMinute) });

  let subtotal = lines.reduce((s, l) => s + l.amount, 0);
  if (subtotal < tariff.minimumFare) {
    lines.push({ code: 'minimum_topup', amount: tariff.minimumFare - subtotal });
    subtotal = tariff.minimumFare;
  }

  const night = input.nightHours ?? { start: 22, end: 6 };
  if (tariff.nightSurcharge > 0 && isNightTime(input.pickupAt, night, input.timeZone ?? 'Europe/Brussels')) {
    lines.push({ code: 'night', amount: tariff.nightSurcharge });
  }

  const extraLuggage = Math.max(0, input.luggageItems - tariff.freeLuggageItems);
  if (extraLuggage > 0 && tariff.luggageSurchargePerItem > 0) {
    lines.push({ code: 'luggage', amount: extraLuggage * tariff.luggageSurchargePerItem });
  }

  return { total: lines.reduce((s, l) => s + l.amount, 0), lines, priceType: 'fixed' };
}
