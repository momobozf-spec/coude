/**
 * Uitbatergegevens (WER boek III art. III.74 / boek XII, AVG). Eén bron voor footer, voorwaarden en privacy.
 * Het adres van de zetel komt uit het KBO-register (publieke gegevens); LEGAL_ENTITY_ADDRESS kan het overschrijven.
 */
export const LEGAL = {
  entityName: "Marhaba Cooperation BV",
  legalForm: "besloten vennootschap (BV)",
  enterpriseNumber: "BE 1037.222.285",
  city: "Heers",
  /** Maatschappelijke zetel volgens het KBO-register. */
  address: "Sweetstraat 13, 3870 Heers",
  email: "momobozf@gmail.com",
  product: "TenderKompas IT",
} as const;

/** Volledig adres van de zetel uit LEGAL_ENTITY_ADDRESS; zonder waarde de zetel uit het KBO-register. */
export function legalAddress(env: Record<string, string | undefined> = process.env): string {
  const a = env.LEGAL_ENTITY_ADDRESS?.trim();
  return a ? a : LEGAL.address;
}

export function legalLine(env: Record<string, string | undefined> = process.env): string {
  return `${LEGAL.product} is een dienst van ${LEGAL.entityName} · ondernemingsnummer ${LEGAL.enterpriseNumber} · ${legalAddress(env)} · ${LEGAL.email}`;
}
