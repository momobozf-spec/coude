import { type BaseQuantity, type Quantity, type Unit, stripDiacritics, toBase } from '@superrette/shared';

export interface ParsedQuantity {
  /** Content of a single item, e.g. 330 ml for a 6 x 33 cl pack. */
  perItem: Quantity;
  packCount: number;
  /** Total net content in base units. */
  netContent: BaseQuantity;
  /** Product is priced per weight (loose fruit, "per kilo"). */
  soldByWeight: boolean;
  /** Approximate weight ("ca. 1 kg", "± 500 g"). */
  approximate: boolean;
  /** The matched text, for auditing. */
  source: string;
}

const UNIT_ALIASES: Record<string, { unit: Unit; factor: number }> = {
  mg: { unit: 'g', factor: 0.001 },
  g: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  gramme: { unit: 'g', factor: 1 },
  grammes: { unit: 'g', factor: 1 },
  kg: { unit: 'kg', factor: 1 },
  kilo: { unit: 'kg', factor: 1 },
  kilos: { unit: 'kg', factor: 1 },
  kilogram: { unit: 'kg', factor: 1 },
  ml: { unit: 'ml', factor: 1 },
  cl: { unit: 'ml', factor: 10 },
  dl: { unit: 'ml', factor: 100 },
  l: { unit: 'l', factor: 1 },
  lt: { unit: 'l', factor: 1 },
  ltr: { unit: 'l', factor: 1 },
  liter: { unit: 'l', factor: 1 },
  liters: { unit: 'l', factor: 1 },
  litre: { unit: 'l', factor: 1 },
  litres: { unit: 'l', factor: 1 },
};

const COUNT_WORDS = [
  'stuks', 'stuk', 'st', 'pieces', 'piece', 'pcs', 'pc', 'stk', 'x',
  'luiers', 'couches', 'tabletten', 'tablettes', 'capsules', 'caps', 'rollen', 'rouleaux', 'zakjes', 'sachets',
  'eieren', 'oeufs', 'eggs', 'pads',
];

const MEASURE_UNITS = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const MULTIPACK_RE = new RegExp(String.raw`(\d+)\s*[x×*]\s*${NUMBER}\s*(${MEASURE_UNITS})\b`, 'i');
const MULTIPACK_REVERSED_RE = new RegExp(String.raw`${NUMBER}\s*(${MEASURE_UNITS})\s*[x×*]\s*(\d+)\b`, 'i');
const MEASURE_RE = new RegExp(String.raw`(ca\.?\s*|±\s*|\+/-\s*|circa\s*|env\.?\s*)?${NUMBER}\s*(${MEASURE_UNITS})\b`, 'gi');
const COUNT_RE = new RegExp(String.raw`(\d+)\s*(${COUNT_WORDS.join('|')})\b`, 'i');
const PER_WEIGHT_RE = /\b(per|par|le|au)\s*(kilo|kg|kilogram)\b|\bper\s*500\s*g\b/i;
const PER_PIECE_RE = /\b(per stuk|par piece|la piece|per piece|each)\b/i;

const toNumber = (text: string): number => Number(text.replace(',', '.'));

function build(perItem: Quantity, packCount: number, source: string, extra?: Partial<ParsedQuantity>): ParsedQuantity {
  const base = toBase(perItem);
  return {
    perItem,
    packCount,
    netContent: { amount: Math.round(base.amount * packCount * 1000) / 1000, unit: base.unit },
    soldByWeight: false,
    approximate: false,
    source,
    ...extra,
  };
}

function measure(amountText: string, unitText: string): Quantity | null {
  const alias = UNIT_ALIASES[unitText.toLowerCase()];
  const amount = toNumber(amountText);
  if (!alias || !(amount > 0)) return null;
  const value = Math.round(amount * alias.factor * 1000) / 1000;
  return { amount: value, unit: alias.unit };
}

/**
 * Parse quantity expressions found on BE/NL product labels:
 *   "1,5 liter", "1.5L", "1500ml", "33cl", "6 x 33 cl", "4x125g",
 *   "0,5 kg", "12 stuks", "44 luiers", "per kilo", "per stuk", "ca. 1 kg".
 */
export function parseQuantity(input: string | null | undefined): ParsedQuantity | null {
  if (!input) return null;
  const text = stripDiacritics(input).toLowerCase();

  const multi = MULTIPACK_RE.exec(text);
  if (multi) {
    const q = measure(multi[2]!, multi[3]!);
    const count = Number(multi[1]);
    if (q && count > 0) return build(q, count, multi[0]);
  }
  const multiReversed = MULTIPACK_REVERSED_RE.exec(text);
  if (multiReversed) {
    const q = measure(multiReversed[1]!, multiReversed[2]!);
    const count = Number(multiReversed[3]);
    if (q && count > 0) return build(q, count, multiReversed[0]);
  }

  const measures = [...text.matchAll(MEASURE_RE)];
  if (measures.length > 0) {
    // Prefer the last explicit measure: titles often read "Brand Product 1,5L".
    const m = measures[measures.length - 1]!;
    const q = measure(m[2]!, m[3]!);
    if (q) {
      return build(q, 1, m[0], { approximate: Boolean(m[1]), soldByWeight: PER_WEIGHT_RE.test(text) });
    }
  }

  if (PER_WEIGHT_RE.test(text)) {
    return build({ amount: 1, unit: 'kg' }, 1, 'per kg', { soldByWeight: true });
  }

  const count = COUNT_RE.exec(text);
  if (count) {
    const n = Number(count[1]);
    if (n > 0) return build({ amount: 1, unit: 'piece' }, n, count[0]);
  }

  if (PER_PIECE_RE.test(text)) return build({ amount: 1, unit: 'piece' }, 1, 'per stuk');
  return null;
}
