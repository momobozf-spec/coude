#!/usr/bin/env node
// Controle vóór livegang (ook gebruikt als build command op Cloudflare Pages / Render).
// Faalt (exit 1) bij blokkerende placeholders; waarschuwt bij niet-blokkerende.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const web = path.join(__dirname, "..", "web");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(web, "assets", "config.js"), "utf8"), ctx);
const c = ctx.window.KETELCHECK_CONFIG;
const errors = [], warnings = [];

if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(c.endpoint || "") || /VUL_HIER/.test(c.endpoint))
  errors.push("endpoint in web/assets/config.js is nog geen echte Apps Script /exec-URL");
if (/JOUWDOMEIN/.test(c.privacyEmail || ""))
  warnings.push("privacyEmail is nog een placeholder — de site toont tot dan " + c.contactEmail);
if (!c.legal || !c.legal.address)
  warnings.push("legal.address (straat + nr + postcode zetel) is nog leeg — de site toont alleen 'Zaventem'");

const headers = fs.readFileSync(path.join(web, "_headers"), "utf8");
if (!/Content-Security-Policy:.*connect-src 'self' https:\/\/script\.google\.com/.test(headers))
  errors.push("_headers: CSP connect-src moet script.google.com toelaten");
for (const f of ["index.html", "fr/index.html", "privacy.html", "partners.html"]) {
  const html = fs.readFileSync(path.join(web, f), "utf8");
  if (/JOUWDOMEIN|VUL_HIER/.test(html)) errors.push(f + " bevat nog een placeholder");
  if (!/BE 1003\.552\.102/.test(html)) errors.push(f + " mist het ondernemingsnummer");
}

warnings.forEach((w) => console.warn("LET OP: " + w));
if (errors.length) { errors.forEach((e) => console.error("FOUT: " + e)); process.exit(1); }
console.log("Deploy-controle OK");
