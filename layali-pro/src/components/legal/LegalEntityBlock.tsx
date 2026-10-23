import { legalEntity } from "@/lib/legal";

/**
 * Identificatie van de verkoper, verplicht op een Belgische webshop
 * (WER boek XII, art. XII.6). Gegevens komen uit src/lib/legal.ts.
 */
export default function LegalEntityBlock({ locale = "nl" }: { locale?: string }) {
  const e = legalEntity();
  const fr = locale === "fr";
  return (
    <p>
      {e.name}
      <br />
      {fr ? "Siège social" : "Maatschappelijke zetel"}: {e.displayAddress}
      <br />
      {fr ? "Numéro d'entreprise / TVA" : "Ondernemingsnummer/btw"}: {e.vat}
      <br />
      E-mail: <a href={`mailto:${e.email}`} className="text-emerald underline">{e.email}</a>
    </p>
  );
}

export function legalEmail(): string {
  return legalEntity().email;
}

/**
 * Duidelijke markering bovenaan elke juridische tekst zolang die niet
 * nagelezen is. Verdwijnt pas als LEGAL_TEXTS_REVIEWED=1 gezet wordt, na
 * nalezing door een jurist.
 */
export function ConceptNotice({ locale = "nl" }: { locale?: string }) {
  if (process.env.LEGAL_TEXTS_REVIEWED === "1") return null;
  return (
    <p className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-xs font-medium text-amber-900">
      {locale === "fr"
        ? "Concept — à faire relire par un juriste avant utilisation."
        : "Concept — laten nalezen door een jurist."}
    </p>
  );
}
