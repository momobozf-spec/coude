export const LOCALES = ['nl', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Frans is de standaardtaal: in Brussel is dat de grootste huurdersgroep.
 * De taalkeuze van de gebruiker wordt op het profiel bewaard en gaat voor.
 */
export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'nl' || value === 'fr';
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Leidt een voorkeurstaal af uit een Accept-Language-header. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const entries = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      return {
        tag: tag.trim().toLowerCase(),
        q: q ? Number.parseFloat(q.slice(2)) : 1,
      };
    })
    .filter((e) => Number.isFinite(e.q))
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    const base = entry.tag.split('-')[0];
    if (base === 'nl') return 'nl';
    if (base === 'fr') return 'fr';
  }

  return DEFAULT_LOCALE;
}
