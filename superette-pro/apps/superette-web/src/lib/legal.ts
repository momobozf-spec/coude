/**
 * Uitbater van Superette, op één plek (WER boek XII art. XII.6, AVG art. 13).
 *
 * Het adres van de zetel komt uit het KBO-register (publieke gegevens). De
 * server-side variabele `LEGAL_ENTITY_ADDRESS` (gelezen per request door de
 * juridische pagina's) kan het overschrijven; de API valideert die waarde in
 * productie (`apps/api/src/config/env.ts`).
 */
export const LEGAL_ENTITY = {
  name: 'Marhaba Cooperation BV',
  enterpriseNumber: 'BE 1037.222.285',
  city: 'Heers',
  address: 'Sweetstraat 13, 3870 Heers',
  email: 'momobozf@gmail.com',
} as const;

/** Server-side: het adres van de uitbater (`LEGAL_ENTITY_ADDRESS`, anders de zetel uit het KBO-register). */
export function legalAddress(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const value = env['LEGAL_ENTITY_ADDRESS']?.trim();
  return value && value.length > 0 ? value : LEGAL_ENTITY.address;
}
