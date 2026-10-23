// KetelCheck lokaal: draait apps-script/Code.gs in een nagebootste Google-omgeving.
// Sheet = lokaal/data.json, mails = mailbox op /beheer. Niets gaat naar Google of naar echte mailadressen.
// Start: node lokaal/server.cjs   (poort via PORT, standaard 4300)
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), http = require("http"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");
const DATA = path.join(__dirname, "data.json");
const PORT = Number(process.env.PORT || 4300);
const BASE = `http://localhost:${PORT}`;

// ---------- persistente "spreadsheet" ----------
const revive = (v) => (v && typeof v === "object" && v.__d ? new Date(v.__d) : v);
const freeze = (v) => (v instanceof Date ? { __d: v.toISOString() } : v);
let state = { sheets: {}, mails: [] };
if (fs.existsSync(DATA)) {
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  for (const [n, rows] of Object.entries(raw.sheets || {})) state.sheets[n] = rows.map((r) => r.map(revive));
  state.mails = raw.mails || [];
}
function persist() {
  const out = { sheets: {}, mails: state.mails };
  for (const [n, s] of Object.entries(sheets)) out.sheets[n] = s.rows.map((r) => r.map(freeze));
  fs.writeFileSync(DATA, JSON.stringify(out, null, 1));
}

function clean(x) {
  if (typeof x === "string" && x.startsWith("'")) return x.slice(1);
  if (typeof x === "string" && /^\+?\d+$/.test(x)) return Number(x);
  return x;
}
function makeSheet(name, rows = []) {
  return {
    name, rows, prot: [],
    getName() { return this.name; }, getLastRow() { return this.rows.length; },
    getLastColumn() { return this.rows.length ? Math.max(...this.rows.map((r) => r.length)) : 0; },
    getMaxRows() { return 1000; }, setFrozenRows() {},
    getProtections() { return this.prot; }, protect() { const p = { setWarningOnly() { return p; } }; this.prot.push(p); return p; },
    appendRow(a) { this.rows.push(a.map(clean)); }, deleteRow(i) { this.rows.splice(i - 1, 1); },
    getDataRange() { const s = this; return { getValues: () => s.rows.map((r) => r.slice()) }; },
    getRange(r, c, nr = 1, nc = 1) {
      const s = this;
      return {
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => s.set(r + i, c + j, x))); return this; },
        setValue(x) { s.set(r, c, clean(x)); return this; },
        getValue() { return (s.rows[r - 1] || [])[c - 1]; },
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (s.rows[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? "" : v); } o.push(row); } return o; },
        setFontWeight() { return this; }, setDataValidation() { return this; },
      };
    },
    set(r, c, x) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(""); row[c - 1] = x; },
  };
}
const sheets = {};
for (const [n, rows] of Object.entries(state.sheets)) sheets[n] = makeSheet(n, rows);

const cache = {};
let activeSheetName = "Leads", selection = [], promptAnswer = "";
const ss = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = makeSheet(n)) };
const ui = {
  last: "", alert: (m) => { ui.last = String(m); }, Button: { OK: 1 },
  prompt: () => ({ getSelectedButton: () => 1, getResponseText: () => promptAnswer }),
  createMenu() { return { addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }; },
};
let uiAvailable = false;
const pad = (n) => String(n).padStart(2, "0");
const ctx = {
  console: { error: (...a) => console.error("[script]", ...a), log: (...a) => console.log("[script]", ...a) },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    getUi: () => { if (!uiAvailable) throw new Error("Cannot call SpreadsheetApp.getUi() from this context."); return ui; },
    newDataValidation: () => ({ requireValueInList() { return { build() { return {}; } }; } }),
    ProtectionType: { SHEET: "SHEET" },
    getActiveSheet: () => ({
      getName: () => activeSheetName,
      getActiveRangeList: () => ({ getRanges: () => selection.map((r) => ({ getRow: () => r, getNumRows: () => 1 })) }),
      getRange: (r, c) => sheets[activeSheetName].getRange(r, c),
    }),
  },
  MailApp: {
    getRemainingDailyQuota: () => 100,
    sendEmail: (m) => { state.mails.unshift({ at: new Date().toISOString(), to: m.to, subject: m.subject, body: m.body, replyTo: m.replyTo || "" }); },
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => {
      if (f === "yyMMdd") return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
      if (f === "yyyy-MM") return d.getFullYear() + "-" + pad(d.getMonth() + 1);
      if (f === "yyyyMMddHH") return "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours());
      return d.toLocaleString("nl-BE");
    },
  },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased() { return this; }, everyHours() { return this; }, atHour() { return this; }, everyDays() { return this; }, create() {} }) },
  ContentService: { createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
  HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; } }) },
  Date, JSON, Math, String, Number, Object, Array, Error,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "apps-script", "Code.gs"), "utf8"), ctx, { filename: "Code.gs" });
const resetCfg = () => vm.runInContext("_cfgCache = null;", ctx);

function asSheetUser(fn) {
  uiAvailable = true; ui.last = "";
  try { fn(); } finally { uiAvailable = false; }
  return ui.last;
}

// ---------- eerste start: setup + demo-partners ----------
if (!sheets.Config) {
  asSheetUser(() => ctx.setup());
  const setCfg = (k, v) => { const r = sheets.Config.rows.find((x) => x[0] === k); if (r) r[1] = v; };
  setCfg("ADMIN_EMAIL", "beheer@ketelcheck.lokaal");
  setCfg("REPLY_TO", "beheer@ketelcheck.lokaal");
  setCfg("WEB_APP_URL", `${BASE}/exec`);
  resetCfg();
  // Fictieve demopartners (geen echte bedrijven).
  const vandaag = new Date().toISOString().slice(0, 10);
  sheets.Partners.appendRow(["P1", "DEMO Verwarming Noord (fictief)", "Demo Ann", "partner1@ketelcheck.lokaal", "'+3220000001", "0000.000.001", "BE0000000001", "demo", "DEMO-1", vandaag, "1000-1299;1500-1999", "vervanging_gas", "open", 5, 80, vandaag, "demo"]);
  sheets.Partners.appendRow(["P2", "DEMO Thermo Rand (fictief)", "Demo Bert", "partner2@ketelcheck.lokaal", "'+3220000002", "0000.000.002", "BE0000000002", "demo", "DEMO-2", vandaag, "1000-1299;1500-1999", "vervanging_gas", "open", 5, 80, vandaag, "demo"]);
  persist();
  console.log("[ketelcheck] eerste start: Sheet en 2 fictieve demopartners aangemaakt");
}

// ---------- HTTP ----------
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const send = (res, code, body, type = "text/html; charset=utf-8") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
const readBody = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });

// google.script.run nabootsen op de partnerpagina
const GSR = `<script>window.google={script:{run:(function mk(ok,fail){return new Proxy({},{get:function(_,k){
if(k==='withSuccessHandler')return function(f){return mk(f,fail)};if(k==='withFailureHandler')return function(f){return mk(ok,f)};
return function(){var a=[].slice.call(arguments);fetch('/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fn:k,args:a})})
.then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){ok&&ok(d.result)}).catch(function(e){fail&&fail(e)})}}})})()}};</script>`;

const PUBLIC_FUNCS = new Set(["confirmAction"]);
const MENU = {
  menuForward: "Doorsturen", menuNextPartner: "Volgende partner", menuApproveCredit: "Credit goedkeuren",
  menuRejectCredit: "Credit weigeren", menuMarkUncollectible: "Oninbaar", menuBuildInvoicesCurrent: "Factuurvoorstel (deze maand)",
  menuBuildInvoicesPrev: "Factuurvoorstel (vorige maand)", menuMarkInvoiced: "Maand gefactureerd", menuQuota: "Mailquota",
};

function sheetJson() {
  const out = {};
  for (const [n, s] of Object.entries(sheets)) out[n] = s.rows.map((r) => r.map((v) => (v instanceof Date ? v.toLocaleString("nl-BE") : v)));
  return out;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, BASE);
    if (req.method === "POST" && url.pathname === "/exec") {
      const body = await readBody(req);
      const out = ctx.doPost({ postData: { contents: body } });
      persist();
      return send(res, 200, out.text, "application/json");
    }
    if (req.method === "GET" && url.pathname === "/exec") {
      const out = ctx.doGet({ parameter: Object.fromEntries(url.searchParams) });
      return send(res, 200, GSR + out.html);
    }
    if (req.method === "POST" && url.pathname === "/run") {
      const { fn, args } = JSON.parse(await readBody(req));
      if (!PUBLIC_FUNCS.has(fn)) return send(res, 403, JSON.stringify({ error: "niet toegestaan" }), "application/json");
      const result = ctx[fn](...(args || []));
      persist();
      return send(res, 200, JSON.stringify({ result }), "application/json");
    }
    if (url.pathname === "/api/state") return send(res, 200, JSON.stringify({ sheets: sheetJson(), mails: state.mails, menu: MENU }), "application/json");
    if (req.method === "POST" && url.pathname === "/api/action") {
      const b = JSON.parse(await readBody(req));
      let msg = "";
      const rowOf = (id) => sheets.Leads.rows.findIndex((r) => r[0] === id) + 1;
      if (b.action === "controle") {
        const H = sheets.Leads.rows[0]; const r = rowOf(b.leadId);
        if (r < 2) msg = "Lead niet gevonden";
        else { sheets.Leads.rows[r - 1][H.indexOf("status")] = "gecontroleerd"; msg = b.leadId + " staat op 'gecontroleerd'"; }
      } else if (b.action === "expire") {
        ctx.expireAssignments(); msg = "Verlopen toewijzingen verwerkt";
      } else if (b.action === "retention") {
        ctx.applyRetention(); msg = "Bewaartermijnen toegepast";
      } else if (MENU[b.action]) {
        activeSheetName = "Leads"; selection = b.leadId ? [rowOf(b.leadId)] : [];
        promptAnswer = b.prompt || "";
        msg = asSheetUser(() => ctx[b.action]()) || "Uitgevoerd";
      } else if (b.action === "reset") {
        fs.existsSync(DATA) && fs.unlinkSync(DATA);
        send(res, 200, JSON.stringify({ msg: "Gewist. Herstart KetelCheck om opnieuw te beginnen." }), "application/json");
        return process.exit(0);
      } else msg = "Onbekende actie";
      persist();
      return send(res, 200, JSON.stringify({ msg }), "application/json");
    }
    if (url.pathname === "/beheer" || url.pathname === "/beheer/") return send(res, 200, fs.readFileSync(path.join(__dirname, "beheer.html")));
    // statische site
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Niet gevonden");
    return send(res, 200, fs.readFileSync(file), types[path.extname(file)] || "application/octet-stream");
  } catch (e) {
    console.error(e);
    return send(res, 500, "Fout: " + e.message, "text/plain; charset=utf-8");
  }
}).listen(PORT, () => console.log(`[ketelcheck] lokaal op ${BASE}  ·  beheer: ${BASE}/beheer`));
