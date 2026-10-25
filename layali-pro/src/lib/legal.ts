import "server-only";

/**
 * Juridische gegevens van de verkoper. Belgisch recht (Wetboek van
 * economisch recht, boek VI en XII) verplicht een webshop om naam,
 * ondernemingsnummer, geografisch adres en contactgegevens te tonen.
 *
 * Uitbater: Marhaba Cooperation BV (BE 1037.222.285), Sweetstraat 13,
 * 3870 Heers. De standaardwaarden hieronder zijn de echte gegevens van de BV;
 * het adres van de maatschappelijke zetel komt uit het KBO-register (publieke
 * gegevens). Elke waarde kan via de omgeving overschreven worden.
 */
export const LEGAL_DEFAULTS = {
  name: "Marhaba Cooperation BV",
  vat: "BE 1037.222.285",
  address: "Sweetstraat 13, 3870 Heers",
  city: "Heers",
  country: "België",
  email: "momobozf@gmail.com",
} as const;

export interface LegalEntity {
  name: string;
  vat: string;
  /** Volledig adres uit LEGAL_ENTITY_ADDRESS, anders de zetel uit het KBO-register. */
  address: string;
  /** Wat op de site getoond wordt: het volledige adres van de zetel. */
  displayAddress: string;
  email: string;
  /** true als het adres een volledig adres is (met postcode), niet enkel een gemeente. */
  complete: boolean;
}

function env(name: string, source: NodeJS.ProcessEnv): string | null {
  const v = source[name];
  return v && v.trim() ? v.trim() : null;
}

export function legalEntity(source: NodeJS.ProcessEnv = process.env): LegalEntity {
  const name = env("LEGAL_ENTITY_NAME", source) ?? LEGAL_DEFAULTS.name;
  const vat = env("LEGAL_ENTITY_VAT", source) ?? LEGAL_DEFAULTS.vat;
  const address = env("LEGAL_ENTITY_ADDRESS", source) ?? LEGAL_DEFAULTS.address;
  const email = env("LEGAL_CONTACT_EMAIL", source) ?? env("SUPPORT_EMAIL", source) ?? LEGAL_DEFAULTS.email;
  return {
    name,
    vat,
    address,
    displayAddress: address,
    email,
    complete: /\b\d{4}\b/.test(address),
  };
}

/**
 * Winkelbeleid dat in de voorwaarden, op de retourpagina en bij het afrekenen
 * terugkomt. Eén bron, zodat de pagina's elkaar nooit tegenspreken.
 *
 * RETURN_COSTS_PAID_BY: "customer" (standaard) = de klant draagt de directe
 * kosten van het terugzenden; "seller" = de webshop betaalt die. Volgens de
 * wet draagt de verkoper ze als dat niet vooraf vermeld is; daarom staat de
 * keuze altijd uitdrukkelijk in de voorwaarden.
 */
export interface ShopPolicy {
  withdrawalDays: 14;
  returnCostsPaidBy: "customer" | "seller";
  /** Uiterste levertermijn volgens de wet als niets anders afgesproken is. */
  maxDeliveryDays: 30;
}

export function shopPolicy(source: NodeJS.ProcessEnv = process.env): ShopPolicy {
  const who = env("RETURN_COSTS_PAID_BY", source);
  return {
    withdrawalDays: 14,
    returnCostsPaidBy: who === "seller" ? "seller" : "customer",
    maxDeliveryDays: 30,
  };
}
