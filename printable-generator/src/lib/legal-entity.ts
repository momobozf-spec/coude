// Operator details used in the footer and legal pages.
//
// The registered-office address comes from the KBO/BCE register (public data):
// Sweetstraat 13, 3870 Heers. NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS can override it.
const REGISTERED_OFFICE = "Sweetstraat 13, 3870 Heers";

export const LEGAL = {
  name: "Marhaba Cooperation BV",
  companyNumber: "BE 1037.222.285",
  vatNumber: "BE 1037.222.285",
  city: "Heers",
  country: "België / Belgium",
  address: process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS?.trim() || REGISTERED_OFFICE,
  email: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "momobozf@gmail.com",
  lastUpdated: "2026-10-24",
} as const;

export function legalAddress(): string {
  return LEGAL.address || REGISTERED_OFFICE;
}
