/**
 * Uitbater van Superette, op één plek (WER boek XII art. XII.6, AVG art. 13).
 *
 * Straat, huisnummer en postcode staan NIET in de code: ze komen uit de
 * server-side variabele `LEGAL_ENTITY_ADDRESS` (gelezen per request door de
 * juridische pagina's). Ontbreekt die, dan tonen de pagina's een zichtbare
 * plaatshouder — nooit een verzonnen adres. De API weigert in productie te
 * starten zonder dit adres (`apps/api/src/config/env.ts`).
 */
export const LEGAL_ENTITY = {
  name: 'Marhaba Data & AI Agent BV',
  enterpriseNumber: 'BE 1003.552.102',
  city: 'Zaventem',
  email: 'momobozf@gmail.com',
} as const;

/** Server-side: het adres van de uitbater, of `null` als het (nog) niet is ingesteld. */
export function legalAddress(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const value = env['LEGAL_ENTITY_ADDRESS']?.trim();
  return value && value.length > 0 ? value : null;
}
