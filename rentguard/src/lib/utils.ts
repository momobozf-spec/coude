import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Bedrag in euro, Belgische notatie. */
export function formatEuro(amount: number, locale: 'nl' | 'fr'): string {
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/** Bedrag in eurocent, Belgische notatie. */
export function formatEuroCents(cents: number, locale: 'nl' | 'fr'): string {
  return formatEuro(cents / 100, locale);
}

/** Datum als dd/mm/jjjj — de notatie die Belgische brieven gebruiken. */
export function formatDate(
  date: Date | string | null | undefined,
  locale: 'nl' | 'fr',
): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';

  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

/** Datum en tijd, voor tijdstempels op bewijsmateriaal. */
export function formatDateTime(
  date: Date | string | null | undefined,
  locale: 'nl' | 'fr',
): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';

  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(value);
}
