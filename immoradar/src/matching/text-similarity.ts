import { foldText } from "@/normalization/normalizers";

const STOPWORDS = new Set([
  "de", "het", "een", "en", "van", "met", "in", "op", "te", "is", "the", "a", "and", "of", "to", "la", "le", "les", "et", "des", "du", "un", "une", "au", "aux",
]);

export function tokenize(text: string | null | undefined): Set<string> {
  const folded = foldText(text);
  if (!folded) return new Set();
  return new Set(folded.split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

/** Jaccard similarity of token sets, 0..1. */
export function jaccard(a: string | null | undefined, b: string | null | undefined): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Normalized Levenshtein similarity, 0..1. */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  const dist = prev[b.length] ?? 0;
  return 1 - dist / Math.max(a.length, b.length);
}
