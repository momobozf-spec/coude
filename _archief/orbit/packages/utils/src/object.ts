/** Structurele vergelijking. Genoeg voor JSON-achtige data (geen Map/Set/Date-cycli). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // NaN === NaN is false, maar voor onze doeleinden zijn ze gelijk.
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * De velden die daadwerkelijk veranderd zijn. Dit is wat er in de outbox gaat:
 * een patch met alleen de wijzigingen, zodat de server per veld kan mergen.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (!deepEqual(before[key], after[key])) {
      patch[key] = after[key];
    }
  }
  return patch;
}

export function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omit<T, K> {
  const result = { ...source };
  for (const key of keys) delete result[key];
  return result;
}

/** Verwijdert `undefined`-velden; `null` blijft staan (dat betekent "wis dit veld"). */
export function compact<T extends Record<string, unknown>>(source: T): T {
  const result = {} as T;
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export function groupBy<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyOf(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}

export function indexBy<T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Record<K, T> {
  const index = {} as Record<K, T>;
  for (const item of items) index[keyOf(item)] = item;
  return index;
}

export function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** Stabiele sortering met meerdere criteria; `compare` mag 0 teruggeven. */
export function sortBy<T>(items: readonly T[], ...comparators: ((a: T, b: T) => number)[]): T[] {
  return [...items].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}
