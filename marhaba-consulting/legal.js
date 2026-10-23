// Vult de uitbatergegevens op de juridische pagina's in vanuit config.js (één bron).
(function () {
  var config = window.MARHABA_CONFIG;
  var contact = window.MarhabaContact;
  if (!config || !contact) return;
  var legal = config.legal;
  document.querySelectorAll('[data-legal-line]').forEach(function (node) { node.textContent = contact.legalLine(legal); });
  document.querySelectorAll('[data-legal-address]').forEach(function (node) {
    node.textContent = legal.address ? legal.address : legal.city + ' (volledig adres volgt)';
  });
  document.querySelectorAll('[data-contact-email]').forEach(function (node) {
    node.textContent = config.contactEmail;
    if (node.tagName === 'A') node.href = 'mailto:' + config.contactEmail;
  });
  var year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
