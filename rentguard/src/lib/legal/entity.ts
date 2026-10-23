/**
 * Uitbater van RentGuard — één bron voor de wettelijke vermeldingen
 * (WER boek XII, art. XII.6) en de privacyverklaring (AVG art. 13).
 *
 * Straat en huisnummer van de maatschappelijke zetel zijn nog niet gekend.
 * TODO(Mohamed): zet `LEGAL_ENTITY_ADDRESS` (bv. "Straat 1, 1930 Zaventem")
 * vóór de lancering. Zonder die waarde weigert de app te starten in productie
 * (zie `src/lib/production-guard.ts`); in ontwikkeling tonen we enkel de
 * gemeente. Er wordt hier bewust geen adres verzonnen.
 */
export interface LegalEntity {
  name: string;
  enterpriseNumber: string;
  vatNumber: string;
  municipality: string;
  address: string | null;
  email: string;
}

export const LEGAL_ENTITY_DEFAULTS = {
  name: 'Marhaba Data & AI Agent BV',
  enterpriseNumber: '1003.552.102',
  vatNumber: 'BE 1003.552.102',
  municipality: 'Zaventem',
  email: 'momobozf@gmail.com',
} as const;

export function getLegalEntity(
  env: Record<string, string | undefined> = process.env,
): LegalEntity {
  const address = env.LEGAL_ENTITY_ADDRESS?.trim();
  const email = env.LEGAL_CONTACT_EMAIL?.trim();
  return {
    ...LEGAL_ENTITY_DEFAULTS,
    address: address ? address : null,
    email: email ? email : LEGAL_ENTITY_DEFAULTS.email,
  };
}

/** Adresregel voor weergave: volledig adres, of enkel de gemeente. */
export function formatEntityAddress(entity: LegalEntity): string {
  return entity.address ?? entity.municipality;
}
