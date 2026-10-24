/**
 * Uitbater van Superette (WER boek XII art. XII.6). Straat en nummer komen uit
 * `LEGAL_ENTITY_ADDRESS` — verplicht in productie (`env.ts`), nooit verzonnen.
 */
export const LEGAL_ENTITY = {
  name: 'Marhaba Data & AI Agent BV',
  enterpriseNumber: 'BE 1003.552.102',
  city: 'Zaventem',
  email: 'momobozf@gmail.com',
} as const;

/** Eén regel voor de voet van e-mails: wie stuurt dit, met ondernemingsnummer en adres. */
export function legalFooterLine(address: string | null | undefined): string {
  return `Superette · ${LEGAL_ENTITY.name} · ${LEGAL_ENTITY.enterpriseNumber} · ${address?.trim() || LEGAL_ENTITY.city} · ${LEGAL_ENTITY.email}`;
}
