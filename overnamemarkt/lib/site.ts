/**
 * Site- en uitbatergegevens (WER boek XII / AVG). Waarden komen uit NEXT_PUBLIC_* (bij de build vastgelegd).
 * Het adres van de zetel komt uit het KBO-register (publieke gegevens); NEXT_PUBLIC_COMPANY_ADDRESS kan het overschrijven.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "SaaS Overdracht Markt",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Marhaba Cooperation BV",
  legalForm: "besloten vennootschap (BV)",
  vat: process.env.NEXT_PUBLIC_COMPANY_VAT || "BE 1037.222.285",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || "Sweetstraat 13, 3870 Heers",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "momobozf@gmail.com",
};
