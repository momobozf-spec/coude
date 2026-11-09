import { tokenize } from '../util/text';

/**
 * Fuzzy matching of a spoken target ("my call with Youssef") against item titles.
 * Token overlap with a substring bonus; good enough for personal lists, and it
 * reports ambiguity so the router can ask instead of guessing.
 */

export interface MatchCandidate<T> {
  item: T;
  score: number;
}

export interface MatchResult<T> {
  best: T | null;
  score: number;
  ambiguous: boolean;
  candidates: MatchCandidate<T>[];
}

const STOP = new Set(['the', 'my', 'a', 'an', 'to', 'de', 'het', 'een', 'mijn', 'le', 'la', 'les', 'mon', 'ma', 'mes', 'with', 'met', 'avec', 'and', 'en', 'et', 'of', 'van', 'du']);

export function similarity(query: string, title: string): number {
  const q = tokenize(query).filter((t) => !STOP.has(t));
  const t = tokenize(title).filter((x) => !STOP.has(x));
  if (q.length === 0 || t.length === 0) return 0;
  const tset = new Set(t);
  let overlap = 0;
  for (const token of q) {
    if (tset.has(token)) overlap += 1;
    else if ([...tset].some((x) => x.startsWith(token) || token.startsWith(x))) overlap += 0.7;
  }
  const precision = overlap / q.length;
  const recall = overlap / t.length;
  let score = precision === 0 && recall === 0 ? 0 : (2 * precision * recall) / (precision + recall || 1);
  const qs = q.join(' ');
  const ts = t.join(' ');
  if (ts.includes(qs) || qs.includes(ts)) score = Math.max(score, 0.85);
  if (ts === qs) score = 1;
  return Math.min(1, score);
}

export function findBestMatch<T>(query: string, items: T[], getTitle: (item: T) => string, threshold = 0.45): MatchResult<T> {
  const candidates = items
    .map((item) => ({ item, score: similarity(query, getTitle(item)) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const ambiguous = Boolean(best && second && second.score >= best.score - 0.1 && best.score < 1);
  return { best: best?.item ?? null, score: best?.score ?? 0, ambiguous, candidates };
}
