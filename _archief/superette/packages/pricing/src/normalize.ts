/**
 * Van verpakking naar vergelijkbare eenheidsprijs.
 *
 * Twee stappen, elk met een eerlijk "weet ik niet":
 *
 *  1. `normalizePackage` — "6 × 33 cl" wordt 1980 ml in de familie `L`.
 *  2. `unitPrice`        — 1980 ml voor 549 cent wordt 277 cent per liter.
 *
 * Ontbreekt de inhoud, dan komt er géén eenheidsprijs. Een vergelijker die
 * dan stilletjes "per stuk" rekent, zet een fles van 2 liter naast een blikje
 * en noemt het blikje goedkoper.
 */
import { divRoundHalfUp, assertCents } from './money';
import {
  BASE_PER_NORMALIZED,
  isPackageUnit,
  toBaseQuantity,
  type BaseQuantity,
  type NormalizedUnit,
  type PackageUnit,
} from './units';

export interface PackageSpec {
  /** Hoeveelheid per enkele verpakking, in `unit`. Bv. 1.5 bij "1,5 L". */
  readonly quantity: number;
  readonly unit: PackageUnit;
  /** Aantal verpakkingen in een multipack. Standaard 1. */
  readonly packCount?: number;
}

export type NormalizationFailure =
  | 'MISSING_QUANTITY'
  | 'INVALID_QUANTITY'
  | 'UNKNOWN_UNIT'
  | 'INVALID_PACK_COUNT';

export type NormalizationResult =
  | {
      readonly ok: true;
      /** Inhoud van één verpakking in de basiseenheid. */
      readonly perPackage: BaseQuantity;
      readonly packCount: number;
      /** Totale inhoud van de hele (multi)verpakking. Hierop rekenen we de eenheidsprijs. */
      readonly total: BaseQuantity;
    }
  | {
      readonly ok: false;
      readonly reason: NormalizationFailure;
      /** Nederlandstalige uitleg die rechtstreeks in de interface kan. */
      readonly message: string;
    };

/**
 * Normaliseert een verpakkingsspecificatie naar de basiseenheid.
 *
 * Accepteert bewust `Partial` en `null`: de invoer komt uit feeds en imports
 * waar velden ontbreken. Dat is geen programmeerfout maar een datafeit, en het
 * antwoord is dan een nette `ok: false`.
 */
export function normalizePackage(spec: Partial<PackageSpec> | null | undefined): NormalizationResult {
  if (!spec || spec.quantity === undefined || spec.quantity === null) {
    return { ok: false, reason: 'MISSING_QUANTITY', message: 'Inhoud van de verpakking is onbekend' };
  }

  if (!isPackageUnit(spec.unit)) {
    return { ok: false, reason: 'UNKNOWN_UNIT', message: 'Eenheid van de verpakking is onbekend' };
  }

  const packCount = spec.packCount ?? 1;
  if (!Number.isInteger(packCount) || packCount <= 0) {
    return { ok: false, reason: 'INVALID_PACK_COUNT', message: 'Aantal verpakkingen in de multipack is ongeldig' };
  }

  const perPackage = toBaseQuantity(spec.quantity, spec.unit);
  if (!perPackage) {
    return { ok: false, reason: 'INVALID_QUANTITY', message: 'Inhoud van de verpakking is ongeldig' };
  }

  return {
    ok: true,
    perPackage,
    packCount,
    total: { amount: perPackage.amount * packCount, unit: perPackage.unit },
  };
}

export type UnitPriceResult =
  | {
      readonly ok: true;
      /** Centen per kg, per liter of per stuk. */
      readonly unitPriceCents: number;
      readonly unit: NormalizedUnit;
    }
  | {
      readonly ok: false;
      readonly reason: NormalizationFailure;
      readonly message: string;
    };

/**
 * De prijs per genormaliseerde eenheid.
 *
 *   549 cent voor 1980 ml → 549 × 1000 / 1980 = 277,27… → 277 cent per liter
 *   795 cent voor 250 g   → 795 × 1000 / 250  = 3180 cent per kg
 *   299 cent voor 6 stuks → 299 / 6            = 49,83… → 50 cent per stuk
 */
export function unitPrice(priceCents: number, total: BaseQuantity): UnitPriceResult {
  assertCents(priceCents, 'priceCents');

  if (!Number.isInteger(total.amount) || total.amount <= 0) {
    return { ok: false, reason: 'INVALID_QUANTITY', message: 'Inhoud van de verpakking is ongeldig' };
  }

  return {
    ok: true,
    unitPriceCents: divRoundHalfUp(priceCents * BASE_PER_NORMALIZED[total.unit], total.amount),
    unit: total.unit,
  };
}

/** `normalizePackage` + `unitPrice` in één stap. */
export function computeUnitPrice(priceCents: number, spec: Partial<PackageSpec> | null | undefined): UnitPriceResult {
  const normalized = normalizePackage(spec);
  if (!normalized.ok) return normalized;

  return unitPrice(priceCents, normalized.total);
}

/**
 * Zijn twee verpakkingen rechtstreeks vergelijkbaar op eenheidsprijs?
 * Alleen binnen dezelfde familie: kilogram tegenover kilogram, nooit liter
 * tegenover stuk.
 */
export function sameUnitFamily(a: BaseQuantity, b: BaseQuantity): boolean {
  return a.unit === b.unit;
}
