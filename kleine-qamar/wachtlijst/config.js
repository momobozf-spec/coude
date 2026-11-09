// Kleine Qamar wachtlijst — centrale configuratie (publiek, GEEN geheimen).
window.QAMAR_CONFIG = Object.freeze({
  // Brevo-formulier "Kleine Qamar wachtlijst" (double opt-in). Publiek formulier-endpoint, geen geheim.
  // Wijzig je dit, pas dan ook connect-src/form-action in `_headers` aan.
  FORM_ENDPOINT: 'https://3ac4fac5.sibforms.com/serve/MUIFADk57cw_SFl7N2eLFsL3G5xqbV6Jn6ShCuRg3M6F30aG7OOlYefaAaBklrO7_rXw9yeoRRvbSO0OU1aCPtwm28Lk4QbaHByKR2VQ-DlHU8g1LEl73a2Udtopx9yBTkuOHWnPlPBvIic2JXNVn9xSZXFiG8w_wLEwUKK2Mj9Hsb2kWBCUxkT2u0oFwqrPbRi7V-5Ei8Zan3SPDg==',
  legal: {
    entityName: 'Marhaba Data & AI Agent BV',
    enterpriseNumber: 'BE 1003.552.102',
    city: 'Zaventem',
    // TODO(Mohamed): straat + huisnummer + postcode van de zetel. Leeg = alleen "Zaventem".
    address: '',
    email: 'momobozf@gmail.com'
  }
});
