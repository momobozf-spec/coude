/* KetelCheck – vult uitbater- en contactgegevens in vanuit /assets/config.js (één bron). */
(function () {
  "use strict";
  var c = window.KETELCHECK_CONFIG;
  if (!c) return;
  var L = c.legal || {};
  var fr = (document.documentElement.lang || "nl").slice(0, 2) === "fr";
  var privacy = c.privacyEmail && c.privacyEmail.indexOf("JOUWDOMEIN") === -1 ? c.privacyEmail : c.contactEmail;
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function mail(n, addr) { n.textContent = addr; n.setAttribute("href", "mailto:" + addr); }
  each("[data-legal-line]", function (n) {
    n.textContent = L.entityName + " · " + (fr ? "n° d'entreprise " : "ondernemingsnummer ") + L.enterpriseNumber + " · " + (L.address || L.city);
  });
  each("[data-legal-address]", function (n) { if (L.address) n.textContent = L.address; });
  each("[data-privacy-email]", function (n) { mail(n, privacy); });
  each("[data-contact-email]", function (n) { mail(n, c.contactEmail); });
})();
