import "server-only";

/**
 * Juridische gegevens van de verkoper. Belgisch recht (Wetboek van
 * economisch recht, boek VI en XII) verplicht een webshop om naam,
 * ondernemingsnummer, geografisch adres en contactgegevens te tonen.
 *
 * Uitbater: Marhaba Data & AI Agent BV (BE 1003.552.102), Zaventem.
 * De standaardwaarden hieronder zijn de echte gegevens van de BV; elke
 * waarde kan via de omgeving overschreven worden.
 *
 * TODO(Mohamed): straat + huisnummer + postcode van de maatschappelijke zetel
 * invullen in LEGAL_ENTITY_ADDRESS (bv. "Straat 1, 1930 Zaventem"). Dat adres
 * staat bewust niet in de code: het is niet gekend en wordt niet verzonnen.
 */
export const LEGAL_DEFAULTS = {
  name: "Marhaba Data & AI Agent BV",
  vat: "BE 1003.552.102",
  city: "Zaventem",
  country: "België",
  email: "momobozf@gmail.com",
} as const;

export interface LegalEntity {
  name: string;
  vat: string;
  /** Volledig adres uit LEGAL_ENTITY_ADDRESS, of null als dat nog niet ingevuld is. */
  address: string | null;
  /** Wat op de site getoond wordt: het volledige adres, of minstens de gemeente. */
  displayAddress: string;
  email: string;
  /** true zodra ook het volledige adres ingevuld is. */
  complete: boolean;
}

function env(name: string, source: NodeJS.ProcessEnv): string | null {
  const v = source[name];
  return v && v.trim() ? v.trim() : null;
}

export function legalEntity(source: NodeJS.ProcessEnv = process.env): LegalEntity {
  const name = env("LEGAL_ENTITY_NAME", source) ?? LEGAL_DEFAULTS.name;
  const vat = env("LEGAL_ENTITY_VAT", source) ?? LEGAL_DEFAULTS.vat;
  const address = env("LEGAL_ENTITY_ADDRESS", source);
  const email = env("LEGAL_CONTACT_EMAIL", source) ?? env("SUPPORT_EMAIL", source) ?? LEGAL_DEFAULTS.email;
  return {
    name,
    vat,
    address,
    displayAddress: address ?? `${LEGAL_DEFAULTS.city}, ${LEGAL_DEFAULTS.country}`,
    email,
    complete: Boolean(address),
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
