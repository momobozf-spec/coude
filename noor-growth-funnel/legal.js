// Vult uitbatergegevens op de privacypagina in vanuit config.js (één bron).
(function () {
  var config = window.NOOR_CONFIG;
  var funnel = window.NoorFunnel;
  funnel.purgeLegacyStorage(window.localStorage);
  document.querySelectorAll('[data-legal-line]').forEach(function (n) { n.textContent = funnel.legalLine(config.legal); });
  document.querySelectorAll('[data-legal-address]').forEach(function (n) { n.textContent = config.legal.address || config.legal.city + ' (volledig adres volgt)'; });
  document.querySelectorAll('[data-contact-email]').forEach(function (n) {
    n.textContent = config.contactEmail;
    if (n.tagName === 'A') n.href = 'mailto:' + config.contactEmail;
  });
})();
