/** Text helpers shared by the date resolver and the intent parsers. */

/** Latin letters incl. accents; used instead of `\w` so that "à" and "é" count as letters. */
export const LETTER = 'a-zA-ZÀ-ÖØ-öø-ÿ';
export const NOT_LETTER_OR_DIGIT_BEFORE = `(?<![${LETTER}0-9])`;
export const NOT_LETTER_OR_DIGIT_AFTER = `(?![${LETTER}0-9])`;

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a non-capturing alternation of literal phrases, longest first. */
export function alternation(phrases: readonly string[]): string {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  return `(?:${sorted.map(escapeRegex).join('|')})`;
}

/** Wraps a pattern with word boundaries that understand accented letters. */
export function bounded(pattern: string): string {
  return `${NOT_LETTER_OR_DIGIT_BEFORE}(?:${pattern})${NOT_LETTER_OR_DIGIT_AFTER}`;
}

/**
 * Normalises user text for matching: lower-case, NFC, straight apostrophes,
 * collapsed whitespace. It deliberately keeps accents so French/Dutch words match.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Removes leading/trailing punctuation and dangling connector words. */
export function trimPunctuation(input: string): string {
  return input
    .replace(/^[\s,.;:!?\-–—'"«»()]+/, '')
    .replace(/[\s,.;:!?\-–—'"«»()]+$/, '')
    .trim();
}

export function capitalizeFirst(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function sentenceCase(input: string): string {
  return capitalizeFirst(collapseWhitespace(input));
}

/** Removes the given character spans from a string and tidies whitespace. */
export function removeSpans(text: string, spans: readonly { start: number; end: number }[]): string {
  if (spans.length === 0) return text;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue; // overlapping span already removed
    out += text.slice(cursor, span.start) + ' ';
    cursor = span.end;
  }
  out += text.slice(cursor);
  return collapseWhitespace(out);
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Simple word tokeniser that keeps apostrophes inside words (l'accountant). */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9']+/)
    .filter((t) => t.length > 0);
}
