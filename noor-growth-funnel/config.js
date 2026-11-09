// Noor funnel — centrale configuratie (publiek zichtbaar, GEEN geheimen hier).
window.NOOR_CONFIG = Object.freeze({
  // Endpoint dat de aanmelding als JSON (POST) ontvangt, bv. een Formspree-formulier
  // (https://formspree.io/f/xxxx), een Make/Zapier-webhook of een eigen API.
  // Leeg = formulier toont "nog niet actief" en verstuurt/bewaart NIETS.
  // Vul je dit in: voeg de origin ook toe aan connect-src in `_headers` en vermeld de dienst
  // als verwerker in privacy.html (sectie "Ontvangers").
  LEAD_ENDPOINT: '',

  contactEmail: 'momobozf@gmail.com',
  legal: {
    entityName: 'Marhaba Data & AI Agent BV',
    enterpriseNumber: 'BE 1003.552.102',
    city: 'Zaventem',
    // TODO(Mohamed): straat + huisnummer + postcode van de zetel. Leeg = alleen "Zaventem".
    address: ''
  }
});
