// Operator details used in the footer and legal pages.
//
// TODO(Mohamed): street + house number of the registered office is still unknown.
// Set NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS (e.g. "Straat 1, 1930 Zaventem") before going live.
// Do NOT invent an address.
export const LEGAL = {
  name: "Marhaba Data & AI Agent BV",
  companyNumber: "BE 1003.552.102",
  vatNumber: "BE 1003.552.102",
  city: "Zaventem",
  country: "België / Belgium",
  address: process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "momobozf@gmail.com",
  lastUpdated: "2026-10-24",
} as const;

export function legalAddress(): string {
  return LEGAL.address ? LEGAL.address : `${LEGAL.city} (adres maatschappelijke zetel: TODO)`;
}
