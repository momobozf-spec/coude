/**
 * KetelCheck backend v2 — Google Apps Script gebonden aan één Google Sheet.
 *
 * Startdienst: VERVANGING VAN EEN GASKETEL (tweede offerte), particulieren,
 * Brussel (1000-1299) + Vlaamse Rand / Halle-Vilvoorde (1500-1999).
 *
 * Tabs: Leads, Partners, Toewijzingen, Factuurvoorstel, Fouten, Config
 * Flow:
 *  formulier -> doPost -> Leads (status "nieuw")
 *  jij controleert -> status "gecontroleerd" -> menu Doorsturen -> partner krijgt samenvatting ZONDER contactgegevens
 *  partner opent link -> bevestigingspagina -> klik op knop (google.script.run) -> pas dan aanvaard/geweigerd
 *    (een link openen of een mailpreview/linkscanner doet NIETS)
 *  geen antwoord binnen ACCEPT_HOURS -> verlopen -> volgende partner (max MAX_PARTNERS, na elkaar, nooit tegelijk)
 *  credit kan binnen CREDIT_HOURS na aanvaarden, jij beslist via menu
 *  Factuurvoorstel = CONCEPTOVERZICHT, GEEN geldige factuur (B2B-facturen in BE: gestructureerd via Peppol sinds 1/1/2026)
 *
 * Beveiliging: Sheet nooit delen; web app "uitvoeren als mij, toegang iedereen".
 * Alle publieke functies zijn ofwel token-beveiligd (doGet/doPost/confirmAction), ofwel
 * eisen ze de Sheet-UI (menu's, setup: werpen een fout buiten de Sheet), ofwel zijn ze idempotent (triggers).
 */

var SHEETS = {
  LEADS: "Leads",
  PARTNERS: "Partners",
  LOG: "Toewijzingen",
  INVOICE: "Factuurvoorstel",
  ERRORS: "Fouten",
  CONFIG: "Config"
};

var LEAD_HEADERS = [
  "id", "ontvangen", "status", "lang", "postcode", "gemeente", "brandstof", "merk", "leeftijd",
  "situatie", "offerte", "offerte_bedrag", "termijn", "eigenaar", "naam", "telefoon",
  "email", "opmerking", "pagina", "utm_source", "utm_medium", "utm_campaign", "utm_term", "gclid",
  "pogingen", "huidige_partner", "geaccepteerd_door", "geaccepteerd_op", "prijs", "credit_reden",
  "factuurmaand", "notities"
];

var PARTNER_HEADERS = [
  "partner_id", "bedrijf", "contactpersoon", "email", "telefoon", "kbo", "btw_nummer",
  "erkenning_bron", "erkenningsnrs", "erkenning_gecontroleerd_op", "postcodes", "diensten",
  "status", "max_per_week", "prijs_per_aanvraag", "pilot_getekend_op", "notities"
];

var LOG_HEADERS = ["token", "lead_id", "partner_id", "verstuurd_op", "vervalt_op", "resultaat", "resultaat_op", "prijs"];

var STATUSES = [
  "nieuw", "gecontroleerd", "doorgestuurd", "geaccepteerd", "afgewezen", "duplicaat",
  "geen_partner", "credit_gevraagd", "gecrediteerd", "gefactureerd", "betaald", "oninbaar", "gewist"
];

var ACCEPTED_STATES = ["geaccepteerd", "credit_gevraagd", "gecrediteerd", "gefactureerd", "betaald", "oninbaar"];

var START_SERVICE = "vervanging_gas";

/** Uitbatergegevens (WER boek XII): onderaan elke mail. Adres: tab Config → ADRES_ZETEL. */
var LEGAL_ENTITY = "Marhaba Data & AI Agent BV";
var LEGAL_ENTERPRISE_NO = "BE 1003.552.102";
var LEGAL_CITY = "Zaventem";

var CONFIG_DEFAULTS = [
  ["BRAND", "KetelCheck", "Merknaam in e-mails"],
  ["ADMIN_EMAIL", "", "Jouw e-mail voor meldingen (bevatten GEEN contactgegevens van aanvragers)"],
  ["REPLY_TO", "", "Reply-to adres in mails naar aanvragers/partners"],
  ["ADRES_ZETEL", "", "TODO: straat + nr + postcode van de zetel (Zaventem) — komt onderaan elke mail"],
  ["WEB_APP_URL", "", "URL van deze web app (eindigt op /exec) — nodig voor de partnerlinks"],
  ["ACCEPT_HOURS", "24", "Uren dat een partnerlink geldig is om te aanvaarden/weigeren"],
  ["CREDIT_HOURS", "72", "Uren na aanvaarden waarin een partner credit kan vragen"],
  ["MAX_PARTNERS", "2", "Maximaal aantal partners per aanvraag (na elkaar, nooit tegelijk)"],
  ["DUP_DAYS", "90", "Dagen waarin dezelfde telefoon/e-mail als duplicaat telt"],
  ["MAX_SUBMISSIONS_PER_HOUR", "30", "Noodrem tegen spam: meer formulieren per uur worden geweigerd"],
  ["MIN_FORM_SECONDS", "4", "Formulier sneller ingevuld dan dit = bot (stil genegeerd)"],
  ["MAIL_RESERVE", "10", "Hou zoveel dagelijkse mails in reserve; daaronder geen doorsturen"],
  ["RETENTION_UNACCEPTED_DAYS", "183", "Na zoveel dagen contactgegevens wissen van niet-aanvaarde aanvragen"],
  ["RETENTION_ACCEPTED_DAYS", "730", "Na zoveel dagen contactgegevens wissen van aanvaarde aanvragen"]
];

var CREDIT_REASONS = {
  onbereikbaar: "Onbereikbaar na 3 pogingen op 2 verschillende werkdagen",
  valse_gegevens: "Valse of foutieve contactgegevens",
  buiten_dienst: "Geen gasketelvervanging of buiten werkgebied",
  bestaande_klant: "Bestaande klant van mij (laatste 24 maanden)"
};

/* ------------------------------------------------------------------ */
/* Setup & menu (enkel vanuit de Sheet bruikbaar)                      */
/* ------------------------------------------------------------------ */

function setup() {
  var ui = requireSheetUi_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.LEADS, LEAD_HEADERS);
  ensureSheet_(ss, SHEETS.PARTNERS, PARTNER_HEADERS);
  ensureSheet_(ss, SHEETS.LOG, LOG_HEADERS);
  ensureSheet_(ss, SHEETS.INVOICE, ["maand", "partner_id", "bedrijf", "btw_nummer", "aantal", "bedrag_excl_btw", "btw_21", "totaal_incl_btw", "lead_ids", "OPMERKING"]);
  ensureSheet_(ss, SHEETS.ERRORS, ["tijdstip", "context", "fout"]);
  var cfg = ensureSheet_(ss, SHEETS.CONFIG, ["sleutel", "waarde", "uitleg"]);
  var existing = cfg.getLastRow() > 1 ? cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  CONFIG_DEFAULTS.forEach(function (row) { if (existing.indexOf(row[0]) === -1) cfg.appendRow(row); });

  var leads = ss.getSheetByName(SHEETS.LEADS);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  leads.getRange(2, LEAD_HEADERS.indexOf("status") + 1, leads.getMaxRows() - 1, 1).setDataValidation(rule);
  var partners = ss.getSheetByName(SHEETS.PARTNERS);
  var pRule = SpreadsheetApp.newDataValidation().requireValueInList(["open", "vol", "pauze"], true).build();
  partners.getRange(2, PARTNER_HEADERS.indexOf("status") + 1, partners.getMaxRows() - 1, 1).setDataValidation(pRule);

  // Waarschuwing bij manueel bewerken van het log en de config (enkel jij hebt toegang; dit voorkomt vergissingen)
  [SHEETS.LOG, SHEETS.CONFIG].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) sh.protect().setWarningOnly(true);
  });

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("expireAssignments").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("applyRetention").timeBased().atHour(3).everyDays(1).create();

  ui.alert("Setup klaar. Vul de tab Config in (ADMIN_EMAIL, REPLY_TO en na deploy WEB_APP_URL) en voeg partners toe met diensten '" + START_SERVICE + "'.");
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("KetelCheck")
    .addItem("Doorsturen: geselecteerde lead(s)", "menuForward")
    .addItem("Volgende partner: geselecteerde lead (enkel status doorgestuurd)", "menuNextPartner")
    .addSeparator()
    .addItem("Credit goedkeuren: geselecteerde lead", "menuApproveCredit")
    .addItem("Credit weigeren: geselecteerde lead", "menuRejectCredit")
    .addItem("Markeer geselecteerde lead als oninbaar", "menuMarkUncollectible")
    .addSeparator()
    .addItem("Factuurvoorstel opbouwen (vorige maand)", "menuBuildInvoicesPrev")
    .addItem("Factuurvoorstel opbouwen (deze maand)", "menuBuildInvoicesCurrent")
    .addItem("Markeer maand als gefactureerd…", "menuMarkInvoiced")
    .addSeparator()
    .addItem("Status mailquota", "menuQuota")
    .addItem("Setup / triggers (eenmalig)", "setup")
    .addToUi();
}

/** Werpt een fout buiten de Sheet-UI (bv. bij aanroep via web app). Altijd als EERSTE regel in menufuncties. */
function requireSheetUi_() { return SpreadsheetApp.getUi(); }

/* ------------------------------------------------------------------ */
/* Intake                                                              */
/* ------------------------------------------------------------------ */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Bots: honeypot of te snel ingevuld -> stil "ok" zonder opslag
    if (data.website || Number(data.elapsed_ms || 0) < Number(cfg_("MIN_FORM_SECONDS") || 4) * 1000) {
      return json_({ ok: true, id: "-" });
    }
    if (!rateOk_()) return json_({ ok: false, error: "Even te veel aanvragen tegelijk. Probeer binnen een uur opnieuw." });

    var err = validateLead_(data);
    if (err) return json_({ ok: false, error: err });

    var phone = normPhone_(data.telefoon);
    var email = String(data.email || "").trim().toLowerCase();
    var duplicate = isDuplicate_(phone, email);
    var utm = data.utm || {};
    var id = "L" + Utilities.formatDate(new Date(), "Europe/Brussels", "yyMMdd") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();

    var rowObj = {
      id: id, ontvangen: new Date(), status: duplicate ? "duplicaat" : "nieuw",
      lang: data.lang === "fr" ? "fr" : "nl",
      postcode: String(data.postcode), gemeente: clip_(data.gemeente, 80),
      brandstof: "gas", merk: clip_(data.merk, 60), leeftijd: clip_(data.leeftijd, 10),
      situatie: clip_(data.situatie, 40), offerte: clip_(data.offerte, 5), offerte_bedrag: clip_(data.offerte_bedrag, 10),
      termijn: clip_(data.termijn, 20), eigenaar: clip_(data.eigenaar, 20),
      naam: clip_(data.naam, 100), telefoon: phone, email: email, opmerking: clip_(data.opmerking, 1000),
      pagina: clip_(data.pagina, 100),
      utm_source: clip_(utm.utm_source, 100), utm_medium: clip_(utm.utm_medium, 100),
      utm_campaign: clip_(utm.utm_campaign, 100), utm_term: clip_(utm.utm_term, 100), gclid: clip_(utm.gclid, 200),
      pogingen: 0
    };
    appendObj_(SHEETS.LEADS, LEAD_HEADERS, rowObj);
    notifyAdmin_("Nieuwe aanvraag " + id + (duplicate ? " (DUPLICAAT)" : "") + " — " + rowObj.postcode,
      "Bekijk en controleer in de tab Leads.\n\n" + leadSummary_(rowObj));
    return json_({ ok: true, id: id, duplicate: duplicate });
  } catch (ex) {
    logError_("doPost", ex);
    return json_({ ok: false, error: "Serverfout. Probeer later opnieuw." });
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* noop */ }
  }
}

function validateLead_(d) {
  var req = ["postcode", "brandstof", "situatie", "offerte", "termijn", "eigenaar", "naam", "telefoon", "email"];
  for (var i = 0; i < req.length; i++) {
    if (!d[req[i]] || !String(d[req[i]]).trim()) return "Ontbrekend veld: " + req[i];
  }
  if (d.toestemming !== "ja") return "Toestemming ontbreekt.";
  if (d.brandstof !== "gas") return "We behandelen voorlopig enkel de vervanging van gasketels.";
  if (["eigenaar", "verhuurder"].indexOf(d.eigenaar) === -1) return "De aanvraag moet van de eigenaar komen.";
  if (["dringend", "<1m", "1-3m", "later"].indexOf(d.termijn) === -1) return "Ongeldige termijn.";
  if (!/^\d{4}$/.test(String(d.postcode))) return "Ongeldige postcode.";
  var pc = parseInt(d.postcode, 10);
  if (!inRegion_(pc)) return "Postcode buiten werkgebied.";
  if (!normPhone_(d.telefoon)) return "Ongeldig telefoonnummer.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email).trim())) return "Ongeldig e-mailadres.";
  return null;
}

function inRegion_(pc) { return (pc >= 1000 && pc <= 1299) || (pc >= 1500 && pc <= 1999); }

function normPhone_(raw) {
  var p = String(raw || "").replace(/[\s.\-\/()]/g, "");
  if (p.indexOf("0032") === 0) p = "+32" + p.slice(4);
  else if (p.indexOf("0") === 0) p = "+32" + p.slice(1);
  return /^\+32[1-9]\d{7,8}$/.test(p) ? p : null;
}

function isDuplicate_(phone, email) {
  var since = new Date(Date.now() - Number(cfg_("DUP_DAYS") || 90) * 86400000);
  return readAll_(SHEETS.LEADS).some(function (r) {
    return r.ontvangen instanceof Date && r.ontvangen >= since && r.status !== "gewist" &&
      (String(r.telefoon) === phone || String(r.email).toLowerCase() === email);
  });
}

/** Globale noodrem: max N formulieren per uur (CacheService, geen persoonsgegevens). */
function rateOk_() {
  var cache = CacheService.getScriptCache();
  var key = "subm_" + Utilities.formatDate(new Date(), "Europe/Brussels", "yyyyMMddHH");
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 3700);
  return n <= Number(cfg_("MAX_SUBMISSIONS_PER_HOUR") || 30);
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function menuForward() {
  var ui = requireSheetUi_();
  var ids = selectedLeadIds_();
  if (!ids.length) { ui.alert("Selecteer eerst één of meer rijen in de tab Leads."); return; }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var report = ids.map(function (id) {
      var lead = findLead_(id);
      if (!lead) return id + ": niet gevonden";
      if (lead.obj.status !== "gecontroleerd") return id + ": status is '" + lead.obj.status + "', moet 'gecontroleerd' zijn";
      return id + ": " + routeToNextPartner_(lead);
    });
    ui.alert(report.join("\n"));
  } finally { lock.releaseLock(); }
}

function menuNextPartner() {
  var ui = requireSheetUi_();
  var ids = selectedLeadIds_();
  if (ids.length !== 1) { ui.alert("Selecteer precies één lead."); return; }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var lead = findLead_(ids[0]);
    if (!lead || lead.obj.status !== "doorgestuurd") { ui.alert("Enkel mogelijk bij status 'doorgestuurd' (nog niet aanvaard)."); return; }
    closeOpenAssignment_(lead.obj.id, "handmatig_overgeslagen");
    ui.alert(ids[0] + ": " + routeToNextPartner_(findLead_(ids[0])));
  } finally { lock.releaseLock(); }
}

/** Kiest volgende partner, logt toewijzing, mailt samenvatting. Enkel voor leads die nog niet aanvaard zijn. */
function routeToNextPartner_(lead) {
  if (["gecontroleerd", "doorgestuurd"].indexOf(lead.obj.status) === -1) return "niet doorgestuurd: status " + lead.obj.status;
  if (openAssignment_(lead.obj.id)) return "niet doorgestuurd: er loopt nog een open toewijzing";
  if (MailApp.getRemainingDailyQuota() <= Number(cfg_("MAIL_RESERVE") || 10)) {
    logError_("routing " + lead.obj.id, "Mailquota bijna op");
    return "NIET doorgestuurd: dagelijkse mailquota bijna op (zie menu Status mailquota)";
  }
  var max = Number(cfg_("MAX_PARTNERS") || 2);
  var tried = readAll_(SHEETS.LOG).filter(function (l) { return l.lead_id === lead.obj.id; }).map(function (l) { return l.partner_id; });
  var partner = tried.length >= max ? null : pickPartner_(lead.obj, tried);
  if (!partner) {
    updateLead_(lead.row, { status: "geen_partner", huidige_partner: "" });
    notifyAdmin_("Geen partner voor " + lead.obj.id, tried.length >= max ? "Maximum (" + max + ") bereikt." : "Geen open partner met capaciteit voor deze postcode.");
    informApplicantNoPartner_(lead.obj);
    return tried.length >= max ? "geen partner meer (max " + max + ")" : "geen beschikbare partner";
  }

  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
  var now = new Date();
  var expires = new Date(now.getTime() + Number(cfg_("ACCEPT_HOURS") || 24) * 3600000);
  var link = cfg_("WEB_APP_URL") + "?t=" + token;
  var body =
    "Dag " + (partner.contactpersoon || partner.bedrijf) + ",\n\n" +
    "Nieuwe aanvraag voor een tweede offerte: vervanging van een gasketel. Exclusief voor jou tot " + fmt_(expires) + ".\n\n" +
    leadSummary_(lead.obj) + "\n" +
    "Vergoeding bij aanvaarden: EUR " + partner.prijs_per_aanvraag + " excl. btw.\n\n" +
    "Bekijk en beslis (aanvaarden of weigeren) via deze persoonlijke link:\n" + link + "\n\n" +
    "Pas na aanvaarden ontvang je naam, telefoon en e-mail. Weigeren is gratis. " +
    "Een aanvraag is geen gegarandeerde klant. Credit kan binnen " + cfg_("CREDIT_HOURS") +
    " uur na aanvaarden volgens de pilotvoorwaarden.\n\nDeel deze link niet.\n\n" + cfg_("BRAND");
  var sent = safeSend_({ to: partner.email, subject: "[" + cfg_("BRAND") + "] Nieuwe aanvraag " + lead.obj.postcode + " — " + lead.obj.id, body: body }, "partnermail " + lead.obj.id);
  if (!sent) {
    updateLead_(lead.row, { status: "gecontroleerd", notities: addNote_(lead.obj, "mail naar " + partner.partner_id + " mislukt") });
    return "NIET doorgestuurd: mail naar " + partner.bedrijf + " mislukt (zie tab Fouten)";
  }
  appendObj_(SHEETS.LOG, LOG_HEADERS, {
    token: token, lead_id: lead.obj.id, partner_id: partner.partner_id,
    verstuurd_op: now, vervalt_op: expires, resultaat: "open", resultaat_op: "", prijs: partner.prijs_per_aanvraag
  });
  updateLead_(lead.row, { status: "doorgestuurd", huidige_partner: partner.partner_id, pogingen: tried.length + 1 });
  return "doorgestuurd naar " + partner.bedrijf;
}

function pickPartner_(lead, excludeIds) {
  var pc = parseInt(lead.postcode, 10);
  var weekAgo = new Date(Date.now() - 7 * 86400000);
  var log = readAll_(SHEETS.LOG);
  var candidates = readAll_(SHEETS.PARTNERS).filter(function (p) {
    if (!p.partner_id || !p.email || !p.pilot_getekend_op) return false;
    if (String(p.status).toLowerCase() !== "open") return false;
    if (excludeIds.indexOf(p.partner_id) !== -1) return false;
    if (!postcodeMatches_(pc, p.postcodes)) return false;
    var offered = String(p.diensten || "").toLowerCase().split(/[;,]/).map(function (s) { return s.trim(); });
    if (offered.indexOf(START_SERVICE) === -1) return false;
    if (!(Number(p.prijs_per_aanvraag) > 0)) return false;
    p._week = log.filter(function (l) { return l.partner_id === p.partner_id && l.verstuurd_op instanceof Date && l.verstuurd_op >= weekAgo; }).length;
    return Number(p.max_per_week || 0) > p._week;
  });
  if (!candidates.length) return null;
  candidates.sort(function (a, b) { return a._week - b._week || lastAssigned_(log, a.partner_id) - lastAssigned_(log, b.partner_id); });
  return candidates[0];
}

function lastAssigned_(log, partnerId) {
  var t = 0;
  log.forEach(function (l) { if (l.partner_id === partnerId && l.verstuurd_op instanceof Date) t = Math.max(t, l.verstuurd_op.getTime()); });
  return t;
}

/** postcodes-veld bv: "1000-1299;1930;1800-1830" */
function postcodeMatches_(pc, spec) {
  return String(spec || "").split(/[;,]/).some(function (part) {
    part = part.trim();
    var m = part.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (m) return pc >= Number(m[1]) && pc <= Number(m[2]);
    return /^\d{4}$/.test(part) && Number(part) === pc;
  });
}

/* ------------------------------------------------------------------ */
/* Partnerlinks: GET toont enkel, actie pas na klik (google.script.run) */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var t = String((e && e.parameter && e.parameter.t) || "");
  if (!/^[0-9a-f-]{60,80}$/i.test(t)) return page_("KetelCheck", "<p>Deze link is onvolledig of ongeldig.</p>");
  var asg = findAssignment_(t);
  if (!asg) return page_("Link ongeldig", "<p>Deze link is niet (meer) geldig.</p>");
  var lead = findLead_(asg.obj.lead_id);
  if (!lead) return page_("Niet gevonden", "<p>Aanvraag niet gevonden.</p>");
  var o = asg.obj;
  var summary = "<pre style='white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:8px'>" + esc_(leadSummary_(lead.obj)) + "</pre>";
  var tok = JSON.stringify(t);

  if (o.resultaat === "open" && !isExpired_(o)) {
    return page_("Aanvraag " + esc_(lead.obj.id),
      summary +
      "<p>Vergoeding bij aanvaarden: <b>EUR " + esc_(o.prijs) + " excl. btw</b>. Geldig tot " + esc_(fmt_(o.vervalt_op)) + ".</p>" +
      "<p><button id='a' style='padding:12px 18px;background:#0f5c4a;color:#fff;border:0;border-radius:8px;font-size:16px'>Aanvaarden</button> " +
      "<button id='r' style='padding:12px 18px;border:1px solid #999;border-radius:8px;font-size:16px;background:#fff'>Weigeren</button></p>" +
      "<p id='m'></p>" +
      script_("function go(act){document.getElementById('a').disabled=true;document.getElementById('r').disabled=true;" +
        "document.getElementById('m').textContent='Bezig…';" +
        "google.script.run.withSuccessHandler(function(h){document.body.innerHTML=h;})" +
        ".withFailureHandler(function(){document.getElementById('m').textContent='Er ging iets mis. Probeer opnieuw.';document.getElementById('a').disabled=false;document.getElementById('r').disabled=false;})" +
        ".confirmAction(" + tok + ",act,'');}" +
        "document.getElementById('a').onclick=function(){go('accept')};document.getElementById('r').onclick=function(){go('reject')};"));
  }
  if (o.resultaat === "aanvaard" && creditWindowOpen_(o) && lead.obj.status === "geaccepteerd") {
    var opts = Object.keys(CREDIT_REASONS).map(function (k) { return "<option value='" + k + "'>" + esc_(CREDIT_REASONS[k]) + "</option>"; }).join("");
    return page_("Aanvraag " + esc_(lead.obj.id) + " — aanvaard",
      "<p>Je hebt deze aanvraag aanvaard. De contactgegevens staan in je mailbox.</p>" +
      "<p>Credit vragen kan tot " + esc_(fmt_(new Date(o.resultaat_op.getTime() + Number(cfg_("CREDIT_HOURS") || 72) * 3600000))) + ".</p>" +
      "<p><select id='s'>" + opts + "</select> <button id='c'>Credit vragen</button></p><p id='m'></p>" +
      script_("document.getElementById('c').onclick=function(){this.disabled=true;" +
        "google.script.run.withSuccessHandler(function(h){document.body.innerHTML=h;})" +
        ".withFailureHandler(function(){document.getElementById('m').textContent='Er ging iets mis.';})" +
        ".confirmAction(" + tok + ",'credit',document.getElementById('s').value);};"));
  }
  return page_("Aanvraag " + esc_(lead.obj.id), "<p>" + esc_(statusText_(o, lead.obj)) + "</p>");
}

/** Enige publieke actiefunctie voor partners. Token-beveiligd, serieel via lock, idempotent. Geeft HTML terug. */
function confirmAction(token, action, reason) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var asg = findAssignment_(String(token || ""));
    if (!asg) return msgHtml_("Deze link is niet (meer) geldig.");
    var lead = findLead_(asg.obj.lead_id);
    var partner = findPartner_(asg.obj.partner_id);
    if (!lead || !partner) return msgHtml_("Aanvraag of partner niet gevonden.");
    if (action === "accept") return accept_(asg, lead, partner);
    if (action === "reject") return reject_(asg, lead);
    if (action === "credit") return credit_(asg, lead, String(reason || ""));
    return msgHtml_("Onbekende actie.");
  } catch (ex) {
    logError_("confirmAction", ex);
    return msgHtml_("Er ging iets mis. We bekijken het.");
  } finally {
    lock.releaseLock();
  }
}

function accept_(asg, lead, partner) {
  var o = asg.obj;
  if (o.resultaat === "aanvaard") return msgHtml_("Je had deze aanvraag al aanvaard. De gegevens staan in je mailbox.");
  if (o.resultaat !== "open") return msgHtml_("Deze aanvraag is niet meer beschikbaar.");
  if (isExpired_(o)) {
    updateRow_(SHEETS.LOG, LOG_HEADERS, asg.row, { resultaat: "verlopen", resultaat_op: new Date() });
    routeToNextPartner_(findLead_(lead.obj.id));
    return msgHtml_("Deze link is verlopen. De aanvraag is naar een andere installateur gegaan. Je betaalt niets.");
  }
  if (lead.obj.status !== "doorgestuurd" || lead.obj.huidige_partner !== partner.partner_id) return msgHtml_("Deze aanvraag is niet meer beschikbaar.");

  var l = lead.obj;
  var creditUntil = new Date(Date.now() + Number(cfg_("CREDIT_HOURS") || 72) * 3600000);
  var sent = safeSend_({
    to: partner.email,
    subject: "[" + cfg_("BRAND") + "] Contactgegevens " + l.id,
    body: "Aanvraag " + l.id + " is aanvaard.\n\nNaam: " + l.naam + "\nTelefoon: " + l.telefoon + "\nE-mail: " + l.email +
      "\nPostcode: " + l.postcode + " " + (l.gemeente || "") + "\nTaal: " + (l.lang === "fr" ? "Frans" : "Nederlands") + "\n\n" +
      leadSummary_(l) + "\nCredit vragen kan tot " + fmt_(creditUntil) + " via je link:\n" + cfg_("WEB_APP_URL") + "?t=" + o.token +
      "\n\nGebruik deze gegevens enkel voor deze offerteaanvraag.\n\n" + cfg_("BRAND")
  }, "contactmail " + l.id);
  if (!sent) return msgHtml_("Het versturen van de gegevens mislukte. Er is NIETS aangerekend. Probeer binnen enkele minuten opnieuw.");

  var now = new Date();
  updateRow_(SHEETS.LOG, LOG_HEADERS, asg.row, { resultaat: "aanvaard", resultaat_op: now });
  updateLead_(lead.row, { status: "geaccepteerd", geaccepteerd_door: partner.partner_id, geaccepteerd_op: now, prijs: o.prijs });
  informApplicantAccepted_(l, partner);
  notifyAdmin_("Aanvaard: " + l.id + " door " + partner.bedrijf, "Prijs: EUR " + o.prijs + " excl. btw");
  return msgHtml_("Aanvaard. De contactgegevens zijn naar " + esc_(partner.email) + " gestuurd. Neem snel contact op.");
}

function reject_(asg, lead) {
  if (asg.obj.resultaat !== "open") return msgHtml_("Deze aanvraag is al verwerkt.");
  updateRow_(SHEETS.LOG, LOG_HEADERS, asg.row, { resultaat: "geweigerd", resultaat_op: new Date() });
  var res = routeToNextPartner_(findLead_(lead.obj.id));
  notifyAdmin_("Geweigerd: " + lead.obj.id, "Gevolg: " + res);
  return msgHtml_("Genoteerd. Je betaalt niets voor deze aanvraag.");
}

function credit_(asg, lead, reason) {
  if (asg.obj.resultaat !== "aanvaard") return msgHtml_("Credit kan enkel voor aanvaarde aanvragen.");
  if (!creditWindowOpen_(asg.obj)) return msgHtml_("De termijn om credit te vragen is verstreken.");
  if (lead.obj.status !== "geaccepteerd") return msgHtml_("Voor deze aanvraag is al credit gevraagd of ze is al verwerkt.");
  if (!CREDIT_REASONS[reason]) return msgHtml_("Kies een geldige reden.");
  updateLead_(lead.row, { status: "credit_gevraagd", credit_reden: CREDIT_REASONS[reason] });
  notifyAdmin_("Credit gevraagd: " + lead.obj.id, "Reden: " + CREDIT_REASONS[reason] + "\nPartner: " + asg.obj.partner_id + "\nVraag bewijs (bv. screenshot belhistoriek) en beslis via het menu.");
  return msgHtml_("Credit aangevraagd. We vragen je eventueel om bewijs en laten je iets weten.");
}

function isExpired_(o) {
  var exp = o.vervalt_op instanceof Date ? o.vervalt_op : new Date(0);
  return Date.now() > exp.getTime();
}

function creditWindowOpen_(o) {
  return o.resultaat_op instanceof Date && Date.now() <= o.resultaat_op.getTime() + Number(cfg_("CREDIT_HOURS") || 72) * 3600000;
}

function statusText_(o, lead) {
  if (o.resultaat === "aanvaard") return "Je hebt deze aanvraag aanvaard. Status: " + lead.status + ".";
  if (o.resultaat === "open") return "Deze link is verlopen.";
  return "Deze aanvraag is afgesloten voor jou (" + o.resultaat + ").";
}

/* ------------------------------------------------------------------ */
/* Credits, oninbaar                                                   */
/* ------------------------------------------------------------------ */

function menuApproveCredit() { creditDecision_(true); }
function menuRejectCredit() { creditDecision_(false); }

function creditDecision_(approve) {
  var ui = requireSheetUi_();
  var ids = selectedLeadIds_();
  if (ids.length !== 1) { ui.alert("Selecteer precies één lead."); return; }
  var lead = findLead_(ids[0]);
  if (!lead || lead.obj.status !== "credit_gevraagd") { ui.alert("Deze lead heeft geen openstaande creditaanvraag."); return; }
  updateLead_(lead.row, { status: approve ? "gecrediteerd" : "geaccepteerd", notities: addNote_(lead.obj, "credit " + (approve ? "goedgekeurd" : "geweigerd")) });
  var partner = findPartner_(lead.obj.geaccepteerd_door);
  if (partner) {
    safeSend_({
      to: partner.email,
      subject: "[" + cfg_("BRAND") + "] Credit " + (approve ? "goedgekeurd" : "niet toegekend") + " — " + lead.obj.id,
      body: approve ? "Je creditaanvraag voor " + lead.obj.id + " is goedgekeurd. Deze aanvraag wordt niet aangerekend."
        : "Je creditaanvraag voor " + lead.obj.id + " voldoet niet aan de pilotvoorwaarden en wordt aangerekend. Antwoord op deze mail om dit te bespreken."
    }, "creditbeslissing " + lead.obj.id);
  }
  ui.alert("Credit " + (approve ? "goedgekeurd" : "geweigerd") + " voor " + lead.obj.id);
}

function menuMarkUncollectible() {
  var ui = requireSheetUi_();
  var ids = selectedLeadIds_();
  if (ids.length !== 1) { ui.alert("Selecteer precies één lead."); return; }
  var lead = findLead_(ids[0]);
  if (!lead || lead.obj.status !== "gefactureerd") { ui.alert("Enkel voor status 'gefactureerd'."); return; }
  updateLead_(lead.row, { status: "oninbaar", notities: addNote_(lead.obj, "oninbaar") });
  ui.alert(ids[0] + " gemarkeerd als oninbaar.");
}

function menuQuota() {
  var ui = requireSheetUi_();
  ui.alert("Resterende mails vandaag: " + MailApp.getRemainingDailyQuota() + "\nReserve ingesteld: " + cfg_("MAIL_RESERVE"));
}

/* ------------------------------------------------------------------ */
/* Tijdgestuurd (idempotent)                                           */
/* ------------------------------------------------------------------ */

function expireAssignments() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    readAllWithRows_(SHEETS.LOG).forEach(function (l) {
      if (l.obj.resultaat === "open" && isExpired_(l.obj)) {
        updateRow_(SHEETS.LOG, LOG_HEADERS, l.row, { resultaat: "verlopen", resultaat_op: new Date() });
        var lead = findLead_(l.obj.lead_id);
        if (lead && lead.obj.status === "doorgestuurd") routeToNextPartner_(lead);
      }
    });
  } catch (ex) {
    logError_("expireAssignments", ex);
  } finally {
    lock.releaseLock();
  }
}

/** Contactgegevens wissen volgens bewaartermijnen. Statistiek blijft (anoniem). */
function applyRetention() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var unacc = Number(cfg_("RETENTION_UNACCEPTED_DAYS") || 183);
    var acc = Number(cfg_("RETENTION_ACCEPTED_DAYS") || 730);
    readAllWithRows_(SHEETS.LEADS).forEach(function (l) {
      var o = l.obj;
      if (!(o.ontvangen instanceof Date) || (!o.naam && !o.telefoon && !o.email)) return;
      var wasAccepted = ACCEPTED_STATES.indexOf(o.status) !== -1;
      var ageDays = (Date.now() - o.ontvangen.getTime()) / 86400000;
      if (ageDays > (wasAccepted ? acc : unacc)) {
        updateLead_(l.row, {
          naam: "", telefoon: "", email: "", opmerking: "", gclid: "",
          notities: addNote_(o, "contactgegevens gewist (status was " + o.status + ")"),
          status: wasAccepted ? o.status : "gewist"
        });
      }
    });
  } catch (ex) {
    logError_("applyRetention", ex);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Factuurvoorstel (concept — geen geldige factuur)                    */
/* ------------------------------------------------------------------ */

function menuBuildInvoicesPrev() { requireSheetUi_(); var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); buildInvoices_(monthKey_(d)); }
function menuBuildInvoicesCurrent() { requireSheetUi_(); buildInvoices_(monthKey_(new Date())); }

function buildInvoices_(month) {
  var ui = requireSheetUi_();
  var openCredit = 0, totals = {};
  readAll_(SHEETS.LEADS).forEach(function (o) {
    if (!(o.geaccepteerd_op instanceof Date) || monthKey_(o.geaccepteerd_op) !== month) return;
    if (o.status === "credit_gevraagd") { openCredit++; return; }
    if (o.status !== "geaccepteerd") return; // gefactureerd/betaald al verwerkt; gecrediteerd telt niet
    var k = o.geaccepteerd_door;
    if (!totals[k]) totals[k] = { n: 0, sum: 0, ids: [] };
    totals[k].n++; totals[k].sum += Number(o.prijs || 0); totals[k].ids.push(o.id);
  });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.INVOICE);
  var vals = sh.getDataRange().getValues();
  for (var i = vals.length - 1; i >= 1; i--) { if (String(vals[i][0]) === month) sh.deleteRow(i + 1); }
  Object.keys(totals).forEach(function (pid) {
    var p = findPartner_(pid) || { bedrijf: "?", btw_nummer: "" };
    var ex = round2_(totals[pid].sum), vat = round2_(ex * 0.21);
    sh.appendRow([month, pid, p.bedrijf, p.btw_nummer, totals[pid].n, ex, vat, round2_(ex + vat), totals[pid].ids.join(" "),
      "CONCEPT — maak de echte factuur in je Peppol-facturatiesoftware"]);
  });
  ui.alert("Factuurvoorstel " + month + ": " + Object.keys(totals).length + " partner(s).\n" +
    "Dit is GEEN geldige factuur. Maak de factuur in je Peppol-facturatiesoftware (verplicht B2B sinds 1/1/2026)." +
    (openCredit ? "\nLet op: " + openCredit + " openstaande creditvraag/-vragen niet meegeteld — eerst beslissen." : ""));
}

function menuMarkInvoiced() {
  var ui = requireSheetUi_();
  var resp = ui.prompt("Welke maand markeren als gefactureerd? (YYYY-MM)\nDoe dit pas nadat de facturen in je facturatiesoftware verstuurd zijn.");
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var month = resp.getResponseText().trim();
  if (!/^\d{4}-\d{2}$/.test(month)) { ui.alert("Formaat moet YYYY-MM zijn."); return; }
  var n = 0;
  readAllWithRows_(SHEETS.LEADS).forEach(function (l) {
    if (l.obj.status === "geaccepteerd" && l.obj.geaccepteerd_op instanceof Date && monthKey_(l.obj.geaccepteerd_op) === month) {
      updateLead_(l.row, { status: "gefactureerd", factuurmaand: month }); n++;
    }
  });
  ui.alert(n + " aanvragen gemarkeerd als gefactureerd voor " + month + ". Zet ze na betaling op 'betaald'.");
}

/* ------------------------------------------------------------------ */
/* Mails naar aanvrager                                                */
/* ------------------------------------------------------------------ */

function informApplicantAccepted_(o, partner) {
  var fr = o.lang === "fr";
  safeSend_({
    to: o.email,
    subject: fr ? "Votre demande de deuxième devis — installateur trouvé" : "Je aanvraag tweede offerte — installateur gevonden",
    body: fr
      ? "Bonjour " + o.naam + ",\n\n" + partner.bedrijf + " a accepté votre demande et vous contactera. Nous lui avons transmis vos coordonnées.\n\nPrix, planning et exécution se règlent directement avec l'installateur.\n\nVous ne souhaitez plus être contacté ? Répondez à cet e-mail.\n\n" + cfg_("BRAND")
      : "Dag " + o.naam + ",\n\n" + partner.bedrijf + " heeft je aanvraag aangenomen en neemt contact met je op. We hebben je gegevens aan hen doorgegeven.\n\nPrijs, planning en uitvoering spreek je rechtstreeks af met de installateur.\n\nWil je toch niet gecontacteerd worden? Antwoord op deze mail.\n\n" + cfg_("BRAND")
  }, "aanvragermail " + o.id);
}

function informApplicantNoPartner_(o) {
  if (!o.email) return;
  var fr = o.lang === "fr";
  safeSend_({
    to: o.email,
    subject: fr ? "Votre demande de deuxième devis" : "Je aanvraag tweede offerte",
    body: fr
      ? "Bonjour " + o.naam + ",\n\nAucun de nos installateurs partenaires n'a de disponibilité pour votre demande en ce moment. Vos coordonnées n'ont été transmises à personne. Elles seront effacées selon notre déclaration de confidentialité.\n\nMerci pour votre confiance.\n\n" + cfg_("BRAND")
      : "Dag " + o.naam + ",\n\nGeen van onze partnerinstallateurs heeft momenteel ruimte voor je aanvraag. Je contactgegevens zijn aan niemand doorgegeven en worden gewist volgens onze privacyverklaring.\n\nBedankt voor je vertrouwen.\n\n" + cfg_("BRAND")
  }, "geen-partner-mail " + o.id);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Samenvatting ZONDER contactgegevens (naam/telefoon/e-mail). */
function leadSummary_(o) {
  return [
    "Aanvraag: " + o.id,
    "Postcode: " + o.postcode + " " + (o.gemeente || ""),
    "Dienst: vervanging gasketel",
    "Huidige ketel: gas" + (o.merk ? " (" + o.merk + ")" : "") + (o.leeftijd ? ", leeftijd " + o.leeftijd : ""),
    "Situatie: " + o.situatie,
    "Eerste offerte: " + o.offerte + (o.offerte_bedrag ? " (EUR " + o.offerte_bedrag + ")" : ""),
    "Termijn: " + o.termijn,
    "Aanvrager is: " + o.eigenaar,
    "Taal: " + (o.lang === "fr" ? "Frans" : "Nederlands"),
    "Opmerking: " + (o.opmerking || "-")
  ].join("\n") + "\n";
}

/** Verstuurt mail; logt fout en geeft false terug i.p.v. te crashen. */
function safeSend_(msg, context) {
  try {
    if (!msg.to) throw new Error("geen ontvanger");
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("dagelijkse mailquota op");
    msg.name = cfg_("BRAND") || "KetelCheck";
    msg.body = String(msg.body || "") + "\n\n--\n" + legalFooter_();
    if (cfg_("REPLY_TO")) msg.replyTo = cfg_("REPLY_TO");
    MailApp.sendEmail(msg);
    return true;
  } catch (ex) {
    logError_(context, ex);
    return false;
  }
}

function legalFooter_() {
  return (cfg_("BRAND") || "KetelCheck") + " is een dienst van " + LEGAL_ENTITY + " · ondernemingsnummer " + LEGAL_ENTERPRISE_NO +
    " · " + (cfg_("ADRES_ZETEL") || LEGAL_CITY) + (cfg_("REPLY_TO") ? " · " + cfg_("REPLY_TO") : "");
}

function notifyAdmin_(subject, body) {
  var admin = cfg_("ADMIN_EMAIL");
  if (admin) safeSend_({ to: admin, subject: "[" + cfg_("BRAND") + "] " + subject, body: body }, "adminmail");
}

function logError_(context, ex) {
  try {
    console.error(context + ": " + (ex && ex.stack || ex));
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ERRORS);
    if (sh) sh.appendRow([new Date(), String(context).slice(0, 100), safeCell_(String(ex && ex.message || ex).slice(0, 500))]);
  } catch (ignore) { /* laatste redmiddel: niets */ }
}

var _cfgCache = null;
function cfg_(key) {
  if (!_cfgCache) {
    _cfgCache = {};
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { _cfgCache[String(r[0]).trim()] = String(r[1]).trim(); });
    }
  }
  return _cfgCache[key] || "";
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAllWithRows_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return sh.getRange(2, 1, last - 1, headers.length).getValues().map(function (r, i) {
    var o = {};
    headers.forEach(function (h, j) { o[h] = (typeof r[j] === "string") ? r[j].trim() : r[j]; });
    return { row: i + 2, obj: o };
  });
}

function readAll_(name) { return readAllWithRows_(name).map(function (x) { return x.obj; }); }

/** Tekst die met = + - @ begint als tekst bewaren (telefoonnummers, formule-injectie). */
function safeCell_(v) {
  if (typeof v === "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function appendObj_(name, headers, obj) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
    .appendRow(headers.map(function (h) { return obj[h] === undefined ? "" : safeCell_(obj[h]); }));
}

function updateRow_(name, headers, row, patch) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  Object.keys(patch).forEach(function (k) {
    var col = headers.indexOf(k);
    if (col !== -1) sh.getRange(row, col + 1).setValue(safeCell_(patch[k]));
  });
}

function updateLead_(row, patch) { updateRow_(SHEETS.LEADS, LEAD_HEADERS, row, patch); }

function findLead_(id) {
  var all = readAllWithRows_(SHEETS.LEADS);
  for (var i = 0; i < all.length; i++) if (all[i].obj.id === id) return all[i];
  return null;
}

function findPartner_(pid) {
  var all = readAll_(SHEETS.PARTNERS);
  for (var i = 0; i < all.length; i++) if (all[i].partner_id === pid) return all[i];
  return null;
}

function findAssignment_(token) {
  if (!token) return null;
  var all = readAllWithRows_(SHEETS.LOG);
  for (var i = 0; i < all.length; i++) if (all[i].obj.token === token) return all[i];
  return null;
}

function openAssignment_(leadId) {
  return readAll_(SHEETS.LOG).some(function (l) { return l.lead_id === leadId && l.resultaat === "open" && !isExpired_(l); });
}

function closeOpenAssignment_(leadId, result) {
  readAllWithRows_(SHEETS.LOG).forEach(function (l) {
    if (l.obj.lead_id === leadId && l.obj.resultaat === "open") updateRow_(SHEETS.LOG, LOG_HEADERS, l.row, { resultaat: result, resultaat_op: new Date() });
  });
}

function selectedLeadIds_() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEETS.LEADS) return [];
  var idCol = LEAD_HEADERS.indexOf("id") + 1, ids = [];
  sh.getActiveRangeList().getRanges().forEach(function (rg) {
    for (var r = Math.max(2, rg.getRow()); r < rg.getRow() + rg.getNumRows(); r++) {
      var v = sh.getRange(r, idCol).getValue();
      if (v && ids.indexOf(v) === -1) ids.push(v);
    }
  });
  return ids;
}

function addNote_(o, text) { return (o.notities ? o.notities + " | " : "") + text + " " + fmt_(new Date()); }
function monthKey_(d) { return Utilities.formatDate(d, "Europe/Brussels", "yyyy-MM"); }
function fmt_(d) { return d instanceof Date ? Utilities.formatDate(d, "Europe/Brussels", "dd/MM/yyyy HH:mm") : ""; }
function clip_(v, n) { return String(v === undefined || v === null ? "" : v).trim().slice(0, n); }
function round2_(x) { return Math.round(x * 100) / 100; }
function esc_(s) { return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function script_(js) { return "<script>" + js + "</script>"; }
function msgHtml_(text) { return "<div style='font-family:system-ui,Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 16px'><h2>" + esc_(cfg_("BRAND") || "KetelCheck") + "</h2><p>" + esc_(text) + "</p></div>"; }

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function page_(title, innerHtml) {
  return HtmlService.createHtmlOutput(
    "<div style='font-family:system-ui,Arial,sans-serif;max-width:620px;margin:32px auto;padding:0 16px;line-height:1.5'>" +
    "<h2>" + title + "</h2>" + innerHtml + "</div>"
  ).setTitle(String(title).replace(/<[^>]*>/g, "")).addMetaTag("viewport", "width=device-width, initial-scale=1");
}
