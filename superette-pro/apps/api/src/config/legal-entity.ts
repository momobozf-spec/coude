/**
 * Uitbater van Superette (WER boek XII art. XII.6). Het adres van de zetel komt
 * uit het KBO-register (publieke gegevens); `LEGAL_ENTITY_ADDRESS` kan het
 * overschrijven en wordt in productie gevalideerd (`env.ts`).
 */
export const LEGAL_ENTITY = {
  name: 'Marhaba Cooperation BV',
  enterpriseNumber: 'BE 1037.222.285',
  city: 'Heers',
  address: 'Sweetstraat 13, 3870 Heers',
  email: 'momobozf@gmail.com',
} as const;

/** Eén regel voor de voet van e-mails: wie stuurt dit, met ondernemingsnummer en adres. */
export function legalFooterLine(address: string | null | undefined): string {
  return `Superette · ${LEGAL_ENTITY.name} · ${LEGAL_ENTITY.enterpriseNumber} · ${address?.trim() || LEGAL_ENTITY.address} · ${LEGAL_ENTITY.email}`;
}
