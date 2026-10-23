// Vult uitbatergegevens in vanuit config.js (één bron).
(function () {
  var L = window.QAMAR_CONFIG.legal;
  document.querySelectorAll('.legal-line').forEach(function (n) { n.textContent = [L.entityName, L.enterpriseNumber, L.address || L.city].join(' · '); });
  document.querySelectorAll('.legal-address').forEach(function (n) { if (L.address) n.textContent = L.address; });
  document.querySelectorAll('.legal-email').forEach(function (n) { n.textContent = L.email; n.href = 'mailto:' + L.email; });
})();
