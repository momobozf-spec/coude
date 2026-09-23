/**
 * Quantities are normalised to one of three canonical base units so that
 * products can be compared regardless of how a retailer labels them.
 *
 *   mass   -> grams (g)       displayed per kilogram
 *   volume -> millilitres (ml) displayed per litre
 *   count  -> piece            displayed per piece
 */
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'piece';
export type BaseUnit = 'g' | 'ml' | 'piece';
export type Dimension = 'mass' | 'volume' | 'count';
/** Unit used when showing a unit price: €/kg, €/l or €/piece. */
export type ComparisonUnit = 'kg' | 'l' | 'piece';

export interface Quantity {
  readonly amount: number;
  readonly unit: Unit;
}

export interface BaseQuantity {
  readonly amount: number;
  readonly unit: BaseUnit;
}

const TO_BASE: Record<Unit, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  piece: { base: 'piece', factor: 1 },
};

export const UNITS: readonly Unit[] = ['g', 'kg', 'ml', 'l', 'piece'];

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function toBase(q: Quantity): BaseQuantity {
  const { base, factor } = TO_BASE[q.unit];
  // Avoid 1.5 * 1000 = 1499.9999 style artefacts.
  return { amount: Math.round(q.amount * factor * 1000) / 1000, unit: base };
}

export function dimensionOf(unit: Unit): Dimension {
  const base = TO_BASE[unit].base;
  return base === 'g' ? 'mass' : base === 'ml' ? 'volume' : 'count';
}

export function comparisonUnitFor(unit: Unit): ComparisonUnit {
  const base = TO_BASE[unit].base;
  return base === 'g' ? 'kg' : base === 'ml' ? 'l' : 'piece';
}

/** Size of one comparison unit expressed in base units (1 kg = 1000 g). */
export function comparisonUnitSize(unit: ComparisonUnit): number {
  return unit === 'piece' ? 1 : 1000;
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b);
}

/** Human friendly representation, promoting 1500 ml to 1.5 l and 1000 g to 1 kg. */
export function humanize(q: BaseQuantity): Quantity {
  if (q.unit === 'g' && q.amount >= 1000) return { amount: q.amount / 1000, unit: 'kg' };
  if (q.unit === 'ml' && q.amount >= 1000) return { amount: q.amount / 1000, unit: 'l' };
  return q;
}

/** Ratio of two quantities in the same dimension, or null if incomparable. */
export function quantityRatio(a: Quantity, b: Quantity): number | null {
  if (!sameDimension(a.unit, b.unit)) return null;
  const ba = toBase(a).amount;
  const bb = toBase(b).amount;
  if (bb === 0) return null;
  return ba / bb;
}
