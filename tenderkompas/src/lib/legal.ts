/**
 * Uitbatergegevens (WER boek III art. III.74 / boek XII, AVG). Eén bron voor footer, voorwaarden en privacy.
 * Het straatadres is (nog) onbekend: configureerbaar via LEGAL_ENTITY_ADDRESS — nooit een adres verzinnen.
 */
export const LEGAL = {
  entityName: "Marhaba Data & AI Agent BV",
  legalForm: "besloten vennootschap (BV)",
  enterpriseNumber: "BE 1003.552.102",
  city: "Zaventem",
  email: "momobozf@gmail.com",
  product: "TenderKompas IT",
} as const;

/** Volledig adres van de zetel uit LEGAL_ENTITY_ADDRESS; zonder waarde enkel de gemeente. */
export function legalAddress(env: Record<string, string | undefined> = process.env): string {
  const a = env.LEGAL_ENTITY_ADDRESS?.trim();
  return a ? a : LEGAL.city;
}

export function legalLine(env: Record<string, string | undefined> = process.env): string {
  return `${LEGAL.product} is een dienst van ${LEGAL.entityName} · ondernemingsnummer ${LEGAL.enterpriseNumber} · ${legalAddress(env)} · ${LEGAL.email}`;
}
