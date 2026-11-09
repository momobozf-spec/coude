import type { Locale } from '@/i18n/config';

/**
 * Bestemmingen waarnaar de auth-callback mag doorsturen.
 *
 * Een `next`-parameter uit een e-maillink is gebruikersinvoer: zonder allowlist
 * wordt de callback een open redirect (phishing via een echte RentGuard-link).
 */
const ALLOWED = ['dashboard', 'reset-password'] as const;

export function safeNextPath(next: string | null | undefined, locale: Locale): string {
  const fallback = `/${locale}/dashboard`;
  if (!next) return fallback;

  for (const target of ALLOWED) {
    if (next === `/${locale}/${target}`) return next;
  }
  return fallback;
}
