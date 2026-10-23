/**
 * Site- en uitbatergegevens (WER boek XII / AVG). Waarden komen uit NEXT_PUBLIC_* (bij de build vastgelegd).
 * Straat + huisnummer van de zetel is nog onbekend: zet NEXT_PUBLIC_COMPANY_ADDRESS (TODO) — nooit een adres verzinnen.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "SaaS Overdracht Markt",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Marhaba Data & AI Agent BV",
  legalForm: "besloten vennootschap (BV)",
  vat: process.env.NEXT_PUBLIC_COMPANY_VAT || "BE 1003.552.102",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Zaventem",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "momobozf@gmail.com",
};
