// Operator details shown in the privacy policy, terms and footer.
// Set at BUILD time via Vite env vars (see .env.example).
//
// TODO(Mohamed): street + house number of the registered office is still unknown.
// Set VITE_LEGAL_ENTITY_ADDRESS (e.g. "Voorbeeldstraat 1, 1930 Zaventem, Belgium")
// before going live. Do NOT invent an address.

const env = import.meta.env || {}

export const LEGAL = {
  name: 'Marhaba Data & AI Agent BV',
  companyNumber: 'BE 1003.552.102',
  city: 'Zaventem, Belgium',
  address: env.VITE_LEGAL_ENTITY_ADDRESS || '',
  email: env.VITE_LEGAL_CONTACT_EMAIL || 'momobozf@gmail.com',
  lastUpdated: '24 October 2026',
}

export function legalAddressLine() {
  return LEGAL.address
    ? LEGAL.address
    : `${LEGAL.city} (full registered address: to be completed)`
}
