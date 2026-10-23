import { legalEntity } from "@/lib/legal";

/**
 * Identificatie van de verkoper, verplicht op een Belgische webshop. Zolang
 * de gegevens niet ingevuld zijn in de omgeving, staat er een duidelijke
 * melding in plaats van verzonnen gegevens.
 */
export default function LegalEntityBlock() {
  const e = legalEntity();
  if (!e.complete) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-red-50 p-3 text-destructive">
        De gegevens van de verkoper zijn nog niet ingevuld (LEGAL_ENTITY_NAME, LEGAL_ENTITY_VAT, LEGAL_ENTITY_ADDRESS,
        LEGAL_CONTACT_EMAIL).
      </p>
    );
  }
  return (
    <p>
      {e.name}
      <br />
      {e.address}
      <br />
      Ondernemingsnummer/btw: {e.vat}
      <br />
      E-mail: <a href={`mailto:${e.email}`} className="text-emerald underline">{e.email}</a>
    </p>
  );
}

export function legalEmail(): string {
  return legalEntity().email ?? "—";
}
