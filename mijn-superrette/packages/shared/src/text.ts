/** Text normalisation used by search, the normaliser and matching engines. */

export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Lower-case, remove diacritics, unify punctuation and collapse whitespace.
 * "Coca-Cola ZÉRO  Sugar" -> "coca cola zero sugar"
 */
export function normalizeText(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N},.%+]+/gu, ' ')
    .replace(/(?<!\d)[.,](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized === '' ? [] : normalized.split(' ');
}

/** Character trigrams with word-boundary padding, as used by pg_trgm. */
export function trigrams(input: string): Set<string> {
  const result = new Set<string>();
  for (const word of tokenize(input)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) result.add(padded.slice(i, i + 3));
  }
  return result;
}

/** Trigram similarity in [0,1] (Jaccard over trigram sets). */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return intersection / (ta.size + tb.size - intersection);
}

/** Damerau-Levenshtein (optimal string alignment) distance, for typo tolerance. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** Jaccard similarity of two token collections. */
export function tokenJaccard(a: Iterable<string>, b: Iterable<string>): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  return intersection / (sa.size + sb.size - intersection);
}

export function slugify(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
