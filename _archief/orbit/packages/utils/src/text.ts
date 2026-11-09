export const PREVIEW_LENGTH = 200;

/**
 * Korte samenvatting voor lijstweergaven. Knipt op een woordgrens zodat er nooit
 * midden in een woord wordt afgebroken.
 */
export function toPreview(text: string, maxLength: number = PREVIEW_LENGTH): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Combining diacritical marks (U+0300 t/m U+036F). */
const DIACRITICS = /[̀-ͯ]/g;

/** URL- en zoekvriendelijke sleutel. Tags worden hierop uniek gemaakt. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Diakrieten en hoofdletters weg; de basis voor lokaal zoeken. */
export function normalizeForSearch(input: string): string {
  return input.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

export function tokenize(input: string): string[] {
  return normalizeForSearch(input)
    .split(/[^a-z0-9']+/)
    .filter((token) => token.length > 0);
}

export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

/** Titel voor een item zonder titel; gebruikt de eerste regel van de content. */
export function deriveTitle(content: string, fallback: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0);
  return firstLine ? truncate(firstLine.trim(), 120) : fallback;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= 254;
}

/** Deterministische kleur uit een naam; gebruikt voor tag- en projectchips. */
export function colorFromString(input: string, palette: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index] as string;
}

/** Initialen voor avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string)[0] ?? ''}${(parts[parts.length - 1] as string)[0] ?? ''}`.toUpperCase();
}
