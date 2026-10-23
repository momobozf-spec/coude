import "server-only";

/**
 * Juridische gegevens van de verkoper. Belgisch recht (Wetboek van
 * economisch recht, boek VI en XII) verplicht een webshop om naam,
 * ondernemingsnummer, adres en contactgegevens te tonen. Ze komen uit de
 * omgeving, zodat er nooit verzonnen gegevens in de code staan.
 */
export interface LegalEntity {
  name: string | null;
  vat: string | null;
  address: string | null;
  email: string | null;
  complete: boolean;
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export function legalEntity(): LegalEntity {
  const name = env("LEGAL_ENTITY_NAME");
  const vat = env("LEGAL_ENTITY_VAT");
  const address = env("LEGAL_ENTITY_ADDRESS");
  const email = env("LEGAL_CONTACT_EMAIL") ?? env("SUPPORT_EMAIL");
  return { name, vat, address, email, complete: Boolean(name && vat && address && email) };
}
