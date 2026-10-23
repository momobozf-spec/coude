// Marhaba — centrale configuratie van de statische site.
// Dit is de ENIGE plek waar contact- en uitbatergegevens worden aangepast.
// Geen geheimen in dit bestand: alles hier is publiek zichtbaar in de browser.
window.MARHABA_CONFIG = Object.freeze({
  // Standaard contactkanaal: het formulier opent het e-mailprogramma van de bezoeker
  // met een voorgevuld bericht naar dit adres (mailto:).
  contactEmail: 'momobozf@gmail.com',

  // Optioneel formulier-endpoint (bv. Formspree, Web3Forms, Basin, eigen API).
  // Leeg = mailto gebruiken. Ingevuld = het formulier POST de gegevens als JSON naar
  // deze URL; mislukt dat, dan valt het formulier terug op mailto.
  // LET OP: voeg de origin van deze URL ook toe aan `connect-src` en `form-action`
  // in `_headers` (Content-Security-Policy), anders blokkeert de browser de aanvraag.
  formEndpoint: '',

  // Wettelijke vermeldingen (WER boek III art. III.74 / boek XII).
  legal: {
    entityName: 'Marhaba Data & AI Agent BV',
    legalForm: 'besloten vennootschap (BV)',
    enterpriseNumber: 'BE 1003.552.102',
    city: 'Zaventem',
    // TODO(Mohamed): straat + huisnummer + postcode van de maatschappelijke zetel invullen,
    // bv. 'Voorbeeldstraat 1, 1930 Zaventem'. Zolang dit leeg is, toont de site alleen 'Zaventem'.
    address: '',
    email: 'momobozf@gmail.com'
  }
});
