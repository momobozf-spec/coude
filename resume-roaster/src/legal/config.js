// Operator details shown in the privacy policy, terms and footer.
// Set at BUILD time via Vite env vars (see .env.example).
//
// The registered-office address comes from the KBO/BCE register (public data):
// Sweetstraat 13, 3870 Heers, Belgium. VITE_LEGAL_ENTITY_ADDRESS can override it.

const env = import.meta.env || {}

const REGISTERED_OFFICE = 'Sweetstraat 13, 3870 Heers, Belgium'

export const LEGAL = {
  name: 'Marhaba Cooperation BV',
  companyNumber: 'BE 1037.222.285',
  city: 'Heers, Belgium',
  address: (env.VITE_LEGAL_ENTITY_ADDRESS || '').trim() || REGISTERED_OFFICE,
  email: env.VITE_LEGAL_CONTACT_EMAIL || 'momobozf@gmail.com',
  lastUpdated: '24 October 2026',
}

export function legalAddressLine() {
  return LEGAL.address || REGISTERED_OFFICE
}
