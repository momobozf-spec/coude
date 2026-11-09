/**
 * Fractional indexing voor drag & drop.
 *
 * Een item verplaatsen mag maar één rij aanraken; anders moet je bij elke sleep
 * de hele lijst herschrijven, wat offline gegarandeerd conflicten oplevert.
 * De sleutels zijn base62-breuken in (0,1); tussen elke twee sleutels past er
 * altijd nog een.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

function digitValue(char: string): number {
  const index = DIGITS.indexOf(char);
  if (index < 0) throw new TypeError(`Ongeldig teken in sorteersleutel: ${char}`);
  return index;
}

/**
 * Bepaalt een string die strikt tussen `a` en `b` ligt.
 * `a === null` betekent "begin van de lijst", `b === null` "einde van de lijst".
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new RangeError(`Sorteersleutels staan in de verkeerde volgorde: ${a} >= ${b}`);
  }
  if (a.endsWith('0') || (b !== null && b.endsWith('0'))) {
    throw new RangeError('Sorteersleutel mag niet op een nul eindigen');
  }

  if (b !== null) {
    // Gemeenschappelijk voorvoegsel overslaan en de rest verdelen.
    let common = 0;
    while ((a[common] ?? '0') === b[common]) common++;
    if (common > 0) {
      return b.slice(0, common) + midpoint(a.slice(common), b.slice(common));
    }
  }

  const low = a.length > 0 ? digitValue(a[0] as string) : 0;
  const high = b !== null && b.length > 0 ? digitValue(b[0] as string) : BASE;

  if (high - low > 1) {
    return DIGITS[Math.round((low + high) / 2)] as string;
  }
  if (b !== null && b.length > 1) {
    return b.slice(0, 1);
  }
  // De cijfers grenzen aan elkaar: een niveau dieper.
  return (DIGITS[low] as string) + midpoint(a.slice(1), null);
}

/**
 * Sorteersleutel voor een item dat tussen `before` en `after` komt.
 * Beide null = eerste item in een lege lijst.
 */
export function generateSortKey(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    throw new RangeError(`Sorteersleutels staan in de verkeerde volgorde: ${before} >= ${after}`);
  }
  return midpoint(before ?? '', after);
}

/** Genereert `count` oplopende sleutels tussen twee grenzen, in één keer. */
export function generateSortKeys(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  if (count <= 0) return [];
  const keys: string[] = [];
  let lower = before;
  for (let i = 0; i < count; i++) {
    const key = generateSortKey(lower, after);
    keys.push(key);
    lower = key;
  }
  return keys;
}

/** Sorteersleutel voor achteraan een bestaande lijst. */
export function appendSortKey(lastKey: string | null): string {
  return generateSortKey(lastKey, null);
}

/** Sorteersleutel voor vooraan een bestaande lijst. */
export function prependSortKey(firstKey: string | null): string {
  return generateSortKey(null, firstKey);
}

export function compareSortKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
