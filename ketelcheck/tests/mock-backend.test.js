// Mock-test KetelCheck backend v2 (geen echte Apps Script-omgeving!).
const fs = require("fs"), vm = require("vm"), assert = require("assert"), crypto = require("crypto");

function clean(x) {
  if (typeof x === "string" && x.startsWith("'")) return x.slice(1);
  if (typeof x === "string" && /^\+?\d+$/.test(x)) return Number(x);  // Sheets-gedrag zonder apostrof
  return x;
}
function makeSheet(name) {
  return {
    name, rows: [], prot: [],
    getName() { return this.name; }, getLastRow() { return this.rows.length; },
    getLastColumn() { return this.rows.length ? Math.max(...this.rows.map(r => r.length)) : 0; },
    getMaxRows() { return 1000; }, setFrozenRows() {},
    getProtections() { return this.prot; }, protect() { const p = { setWarningOnly() { return p; } }; this.prot.push(p); return p; },
    appendRow(a) { this.rows.push(a.map(clean)); }, deleteRow(i) { this.rows.splice(i - 1, 1); },
    getDataRange() { const s = this; return { getValues: () => s.rows.map(r => r.slice()) }; },
    getRange(r, c, nr = 1, nc = 1) {
      const s = this;
      return {
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => s.set(r + i, c + j, x))); return this; },
        setValue(x) { s.set(r, c, clean(x)); return this; },
        getValue() { return (s.rows[r - 1] || [])[c - 1]; },
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (s.rows[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? "" : v); } o.push(row); } return o; },
        setFontWeight() { return this; }, setDataValidation() { return this; }
      };
    },
    set(r, c, x) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(""); row[c - 1] = x; }
  };
}

const sheets = {}, mails = [], cache = {};
let quota = 100, mailFailTo = null, uiAvailable = true, activeSheetName = "Leads", selection = [];
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet(n)) };
const ui = { alert: m => { ui.last = m; }, Button: { OK: 1 }, prompt: () => ({ getSelectedButton: () => 1, getResponseText: () => ui.promptAnswer }), createMenu() { return { addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }; } };
const ctx = {
  console: { error: () => {}, log: console.log },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    getUi: () => { if (!uiAvailable) throw new Error("Cannot call SpreadsheetApp.getUi() from this context."); return ui; },
    newDataValidation: () => ({ requireValueInList() { return { build() { return {}; } }; } }),
    ProtectionType: { SHEET: "SHEET" },
    getActiveSheet: () => ({ getName: () => activeSheetName, getActiveRangeList: () => ({ getRanges: () => selection.map(r => ({ getRow: () => r, getNumRows: () => 1 })) }), getRange: (r, c) => sheets[activeSheetName].getRange(r, c) })
  },
  MailApp: {
    getRemainingDailyQuota: () => quota,
    sendEmail: m => { if (mailFailTo && m.to === mailFailTo) throw new Error("Invalid email"); quota--; mails.push(m); }
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, "0"); if (f === "yyMMdd") return String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()); if (f === "yyyy-MM") return d.getFullYear() + "-" + p(d.getMonth() + 1); if (f === "yyyyMMddHH") return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()); return d.toISOString(); }
  },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased() { return this; }, everyHours() { return this; }, atHour() { return this; }, everyDays() { return this; }, create() {} }) },
  ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
  HtmlService: { createHtmlOutput: h => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; } }) },
  Date, JSON, Math, String, Number, Object, Array, Error
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], "utf8"), ctx);
const resetCfg = () => vm.runInContext("_cfgCache = null;", ctx);
const results = [];
function t(name, fn) { fn(); results.push("OK  " + name); }

ctx.setup();
const cfg = sheets.Config;
const setCfg = (k, v) => { cfg.rows.find(r => r[0] === k)[1] = v; resetCfg(); };
setCfg("ADMIN_EMAIL", "admin@test.be");
setCfg("WEB_APP_URL", "https://script.google.com/macros/s/X/exec");
const P = sheets.Partners;
// partner_id,bedrijf,contact,email,tel,kbo,btw,bron,nrs,gecontroleerd,postcodes,diensten,status,max,prijs,pilot,notities
P.appendRow(["P1", "Alpha", "Ann", "alpha@x.be", "'+3220000001", "0123", "BE0123", "BE GII", "x", "2026-10-23", "1000-1299", "vervanging_gas", "open", 5, 80, "2026-10-24", ""]);
P.appendRow(["P2", "Beta", "Bert", "beta@x.be", "'+3220000002", "0456", "BE0456", "VEKA GI", "y", "2026-10-23", "1000-1299;1930", "vervanging_gas", "open", 5, 90, "2026-10-24", ""]);
P.appendRow(["P3", "Gamma (geen pilot)", "Gil", "gamma@x.be", "", "", "", "", "", "", "1000-1999", "vervanging_gas", "open", 5, 70, "", ""]);
P.appendRow(["P4", "Delta (enkel onderhoud)", "Dirk", "delta@x.be", "", "", "", "", "", "", "1000-1999", "onderhoud", "open", 5, 30, "2026-10-24", ""]);

const L = sheets.Leads, H = L.rows[0], col = n => H.indexOf(n);
const LOG = sheets.Toewijzingen, LH = LOG.rows[0], lcol = n => LH.indexOf(n);
const post = o => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(o) } }).text);
let n = 0;
const base = () => ({ lang: "nl", postcode: "1030", gemeente: "Schaarbeek", brandstof: "gas", merk: "Vaillant", leeftijd: "15-20", situatie: "defect", offerte: "ja", offerte_bedrag: "4200", termijn: "<1m", eigenaar: "eigenaar", naam: "Test " + (++n), telefoon: "04701234" + String(n).padStart(2, "0"), email: "t" + n + "@voorbeeld.be", opmerking: "=HYPERLINK(\"x\")", toestemming: "ja", pagina: "/", elapsed_ms: 30000, utm: { utm_source: "google" } });
const rowOf = id => L.rows.findIndex(r => r[0] === id) + 1;
const leadVal = (id, c) => L.rows[rowOf(id) - 1][col(c)];
const tokensFor = id => LOG.rows.filter(r => r[lcol("lead_id")] === id);
function control(id) { L.rows[rowOf(id) - 1][col("status")] = "gecontroleerd"; }
function forward(id) { activeSheetName = "Leads"; selection = [rowOf(id)]; ctx.menuForward(); return ui.last; }

t("validatie: buiten regio (3000), stookolie, ongeldige telefoon, geen toestemming", () => {
  assert.strictEqual(post({ ...base(), postcode: "3000" }).ok, false);
  assert.strictEqual(post({ ...base(), brandstof: "andere" }).ok, false);
  assert.strictEqual(post({ ...base(), telefoon: "123" }).ok, false);
  assert.strictEqual(post({ ...base(), toestemming: "" }).ok, false);
  assert.strictEqual(L.rows.length, 1);
});
t("bot: honeypot en te snel ingevuld worden stil genegeerd", () => {
  assert.ok(post({ ...base(), website: "spam" }).ok);
  assert.ok(post({ ...base(), elapsed_ms: 900 }).ok);
  assert.strictEqual(L.rows.length, 1, "niets opgeslagen");
});
let A, AB, APH;
t("intake: telefoon en formule als tekst, adminmail zonder contactgegevens", () => {
  mails.length = 0;
  AB = base(); APH = "+32" + AB.telefoon.slice(1);
  const r = post(AB); assert.ok(r.ok); A = r.id;
  assert.strictEqual(leadVal(A, "telefoon"), APH);
  assert.strictEqual(leadVal(A, "opmerking"), "=HYPERLINK(\"x\")");
  const adm = mails.find(m => m.to === "admin@test.be");
  assert.ok(adm && !adm.body.includes(APH) && !adm.body.includes(AB.email));
});
t("duplicaat (zelfde telefoon, andere mail)", () => {
  const b = base(); const r = post({ ...b, telefoon: AB.telefoon }); assert.ok(r.duplicate);
});
t("doorsturen vereist status gecontroleerd", () => { assert.ok(/moet 'gecontroleerd'/.test(forward(A))); });
let tokA1, firstP;
t("doorsturen: enkel partners met pilot + juiste dienst + postcode; geen contactgegevens in mail", () => {
  control(A); mails.length = 0;
  const msg = forward(A); assert.ok(/doorgestuurd naar/.test(msg), msg);
  firstP = leadVal(A, "huidige_partner"); assert.ok(["P1", "P2"].includes(firstP), firstP);
  const pm = mails.find(m => m.to.endsWith("@x.be"));
  assert.ok(!pm.body.includes(APH) && !pm.body.includes(AB.naam) && !pm.body.includes(AB.email));
  tokA1 = tokensFor(A)[0][lcol("token")];
  assert.ok(String(tokA1).length >= 60);
});
t("dubbel doorsturen tijdens open toewijzing geblokkeerd", () => {
  assert.ok(/moet 'gecontroleerd'/.test(forward(A)));
  control(A); const m = forward(A); assert.ok(/open toewijzing/.test(m), m);
  L.rows[rowOf(A) - 1][col("status")] = "doorgestuurd";
});
t("link openen (mailpreview/linkscanner) doet niets", () => {
  const before = JSON.stringify(LOG.rows);
  const pg = ctx.doGet({ parameter: { t: tokA1 } });
  assert.ok(/Aanvaarden/.test(pg.html) && /google\.script\.run/.test(pg.html));
  assert.strictEqual(JSON.stringify(LOG.rows), before);
  assert.strictEqual(leadVal(A, "status"), "doorgestuurd");
});
t("ongeldige/afgeknotte token geweigerd", () => {
  assert.ok(/ongeldig/i.test(ctx.doGet({ parameter: { t: "abc" } }).html));
  assert.ok(/niet \(meer\) geldig/.test(ctx.confirmAction("x".repeat(68), "accept", "")));
});
let secondP, tokA2;
t("weigeren -> automatisch tweede partner; oude token kan niet meer aanvaarden", () => {
  ctx.confirmAction(tokA1, "reject", "");
  secondP = leadVal(A, "huidige_partner"); assert.ok(secondP && secondP !== firstP);
  tokA2 = tokensFor(A)[1][lcol("token")];
  assert.ok(/niet meer beschikbaar|al verwerkt/.test(ctx.confirmAction(tokA1, "accept", "")));
});
t("aanvaarden: contact naar partner, aanvrager krijgt naam, herhaald klikken idempotent", () => {
  mails.length = 0;
  const h = ctx.confirmAction(tokA2, "accept", ""); assert.ok(/Aanvaard/.test(h), h);
  assert.strictEqual(leadVal(A, "status"), "geaccepteerd");
  assert.ok(mails.some(m => m.subject.includes("Contactgegevens") && m.body.includes(APH)));
  assert.ok(mails.some(m => m.to === AB.email));
  const cnt = mails.length;
  assert.ok(/al aanvaard/.test(ctx.confirmAction(tokA2, "accept", "")));
  assert.strictEqual(mails.length, cnt, "geen dubbele mails");
});
t("aanvaarde lead kan niet opnieuw doorgestuurd worden (ook niet via 'volgende partner')", () => {
  selection = [rowOf(A)]; ctx.menuNextPartner(); assert.ok(/Enkel mogelijk/.test(ui.last));
  control; const tmp = leadVal(A, "status"); assert.strictEqual(tmp, "geaccepteerd");
  assert.ok(/niet doorgestuurd: status/.test(vm.runInContext("routeToNextPartner_(findLead_('" + A + "'))", ctx)));
});
t("credit: keuzepagina, ongeldige reden geweigerd, aanvraag + weigering", () => {
  assert.ok(/Credit vragen/.test(ctx.doGet({ parameter: { t: tokA2 } }).html));
  assert.ok(/geldige reden/.test(ctx.confirmAction(tokA2, "credit", "hack")));
  ctx.confirmAction(tokA2, "credit", "onbereikbaar");
  assert.strictEqual(leadVal(A, "status"), "credit_gevraagd");
  assert.ok(/al credit gevraagd/.test(ctx.confirmAction(tokA2, "credit", "onbereikbaar")));
  selection = [rowOf(A)]; ctx.menuRejectCredit(); assert.strictEqual(leadVal(A, "status"), "geaccepteerd");
});
t("credit na termijn geweigerd", () => {
  const r = LOG.rows.find(x => x[lcol("token")] === tokA2); const keep = r[lcol("resultaat_op")];
  r[lcol("resultaat_op")] = new Date(Date.now() - 100 * 3600000);
  assert.ok(/verstreken/.test(ctx.confirmAction(tokA2, "credit", "onbereikbaar")));
  r[lcol("resultaat_op")] = keep;
});
let B;
t("verlopen link: aanvaarden na vervaldatum kan niet, gaat naar volgende partner", () => {
  B = post(base()).id; control(B); forward(B);
  const r = LOG.rows.find(x => x[lcol("lead_id")] === B);
  r[lcol("vervalt_op")] = new Date(Date.now() - 1000);
  const h = ctx.confirmAction(r[lcol("token")], "accept", ""); assert.ok(/verlopen/.test(h), h);
  assert.strictEqual(tokensFor(B).length, 2, "tweede partner kreeg de aanvraag");
});
t("gelijktijdige acceptatie: enkel de huidige partner kan aanvaarden", () => {
  const [t1, t2] = tokensFor(B).map(r => r[lcol("token")]);
  const h1 = ctx.confirmAction(t2, "accept", ""); assert.ok(/Aanvaard/.test(h1));
  const h2 = ctx.confirmAction(t1, "accept", ""); assert.ok(!/^.*Aanvaard\. /.test(h2));
  assert.strictEqual(L.rows.filter(r => r[0] === B).length, 1);
  assert.strictEqual(LOG.rows.filter(r => r[lcol("lead_id")] === B && r[lcol("resultaat")] === "aanvaard").length, 1);
});
let C;
t("mislukte partnermail: geen toewijzing, lead blijft gecontroleerd, fout gelogd", () => {
  C = post(base()).id; control(C);
  mailFailTo = "alpha@x.be"; P.rows[2][12] = "pauze"; // enkel P1 open
  const m = forward(C); assert.ok(/mislukt/.test(m), m);
  assert.strictEqual(leadVal(C, "status"), "gecontroleerd");
  assert.strictEqual(tokensFor(C).length, 0);
  assert.ok(sheets.Fouten.rows.length > 1);
  mailFailTo = null; P.rows[2][12] = "open";
});
t("mislukte contactmail bij aanvaarden: niets aangerekend", () => {
  forward(C); const tk = tokensFor(C)[0][lcol("token")]; const pid = tokensFor(C)[0][lcol("partner_id")];
  mailFailTo = pid === "P1" ? "alpha@x.be" : "beta@x.be";
  const h = ctx.confirmAction(tk, "accept", ""); assert.ok(/NIETS aangerekend/.test(h), h);
  assert.strictEqual(leadVal(C, "status"), "doorgestuurd");
  mailFailTo = null;
  assert.ok(/Aanvaard/.test(ctx.confirmAction(tk, "accept", "")));
});
t("mailquota-reserve blokkeert doorsturen", () => {
  const D = post(base()).id; control(D); const keep = quota; quota = 5;
  assert.ok(/mailquota/.test(forward(D))); quota = keep;
});
t("spam-noodrem: max formulieren per uur", () => {
  setCfg("MAX_SUBMISSIONS_PER_HOUR", "3");
  const r = post(base()); assert.strictEqual(r.ok, false); setCfg("MAX_SUBMISSIONS_PER_HOUR", "30");
});
t("menu/beheerfuncties werken niet buiten de Sheet (web app-context)", () => {
  uiAvailable = false;
  const before = JSON.stringify(L.rows);
  for (const fn of ["setup", "menuForward", "menuNextPartner", "menuApproveCredit", "menuRejectCredit", "menuMarkUncollectible", "menuBuildInvoicesPrev", "menuBuildInvoicesCurrent", "menuMarkInvoiced", "menuQuota"]) {
    assert.throws(() => ctx[fn](), /getUi/, fn);
  }
  assert.strictEqual(JSON.stringify(L.rows), before);
  uiAvailable = true;
});
t("factuurvoorstel: enkel aanvaard, excl. gecrediteerd/openstaand, gemarkeerd als CONCEPT", () => {
  ctx.menuBuildInvoicesCurrent();
  const inv = sheets.Factuurvoorstel.rows.slice(1);
  const total = inv.reduce((s, r) => s + r[4], 0);
  const accepted = L.rows.filter(r => r[col("status")] === "geaccepteerd").length;
  assert.strictEqual(total, accepted);
  inv.forEach(r => { assert.strictEqual(r[6], Math.round(r[5] * 21) / 100); assert.ok(/CONCEPT/.test(r[9])); });
  ui.promptAnswer = inv[0][0]; ctx.menuMarkInvoiced();
  assert.strictEqual(L.rows.filter(r => r[col("status")] === "geaccepteerd").length, 0);
});
t("bewaartermijn: niet-aanvaard na 183d gewist, aanvaard behoudt status maar wist contact na 730d", () => {
  const E = post(base()).id;
  L.rows[rowOf(E) - 1][col("ontvangen")] = new Date(Date.now() - 200 * 86400000);
  L.rows[rowOf(A) - 1][col("ontvangen")] = new Date(Date.now() - 800 * 86400000);
  ctx.applyRetention();
  assert.strictEqual(leadVal(E, "status"), "gewist"); assert.strictEqual(leadVal(E, "email"), "");
  assert.strictEqual(leadVal(A, "telefoon"), ""); assert.notStrictEqual(leadVal(A, "status"), "gewist");
});
t("expiry-trigger is idempotent", () => { ctx.expireAssignments(); ctx.expireAssignments(); });

t("huurder en ongeldige termijn geweigerd (server)", () => {
  assert.strictEqual(post({ ...base(), eigenaar: "huurder" }).ok, false);
  assert.strictEqual(post({ ...base(), termijn: "orienterend" }).ok, false);
});
t("elke mail eindigt met uitbatergegevens (BV, ondernemingsnummer, zetel)", () => {
  assert.ok(mails.length > 0);
  for (const m of mails) assert.ok(/Marhaba Data & AI Agent BV · ondernemingsnummer BE 1003\.552\.102 · Zaventem/.test(m.body), m.subject);
  setCfg("ADRES_ZETEL", "Teststraat 1, 1930 Zaventem");
  assert.ok(vm.runInContext("legalFooter_()", ctx).includes("Teststraat 1, 1930 Zaventem"));
  setCfg("ADRES_ZETEL", "");
});
console.log(results.join("\n"));
console.log("\n" + results.length + " mock-tests geslaagd");
