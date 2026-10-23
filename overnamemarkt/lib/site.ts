export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "SaaS Overdracht Markt",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Marhaba Data & AI Agent BV",
  vat: process.env.NEXT_PUBLIC_COMPANY_VAT || "BE1003552102",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Zaventem",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@example.com",
};
