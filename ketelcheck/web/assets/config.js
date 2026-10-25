/* KetelCheck — ENIGE configuratieplek voor de website (publiek, geen geheimen).
   Controle vóór livegang: `node tools/check-deploy.cjs` (faalt zolang er placeholders staan). */
window.KETELCHECK_CONFIG = {
  // URL van de Apps Script web-app (Deploy → Web-app → eindigt op /exec).
  // Lokaal (localhost) gebruikt het formulier automatisch lokaal/server.cjs.
  endpoint: "https://script.google.com/macros/s/VUL_HIER_JE_DEPLOYMENT_ID_IN/exec",

  // Privacycontact. Blijft een placeholder tot het domein er is; zolang het "JOUWDOMEIN"
  // bevat, tonen de pagina's het algemene contactadres hieronder.
  privacyEmail: "privacy@JOUWDOMEIN.be",
  contactEmail: "momobozf@gmail.com",

  // Uitbater (WER boek XII / AVG)
  legal: {
    entityName: "Marhaba Cooperation BV",
    enterpriseNumber: "BE 1037.222.285",
    city: "Heers",
    // Maatschappelijke zetel volgens het KBO-register (publieke gegevens).
    address: "Sweetstraat 13, 3870 Heers"
  }
};
