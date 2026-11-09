// Test frontend-formulier NL en FR met jsdom en een gemockte fetch.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const assert = require("assert");
const root = process.argv[2];

async function run(file, lang) {
  const html = fs.readFileSync(path.join(root, file), "utf8").replace(/<script src="\/assets\/[a-z]+\.js"><\/script>/g, "");
  const dom = new JSDOM(html, { url: "https://ketelcheck.test/" + (lang === "fr" ? "fr/" : "") + "?utm_source=google&utm_term=cv%20ketel%20vervangen", runScripts: "outside-only" });
  const w = dom.window;
  let sent = null;
  w.fetch = (url, opts) => { endpoint = url; sent = JSON.parse(opts.body); return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: "L1" }) }); };
  w.eval(fs.readFileSync(path.join(root, "assets/config.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "assets/legal.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "assets/app.js"), "utf8"));
  let endpoint = null;
  const d = w.document, f = d.getElementById("aanvraag");
  const submit = () => f.dispatchEvent(new w.Event("submit", { cancelable: true }));
  const msg = () => d.getElementById("msg").textContent;

  submit();
  assert.ok(msg().length > 0, "lege submit geeft fout");
  const set = (n, v) => { f.elements[n].value = v; };
  set("postcode", "9000"); set("brandstof", "gas"); set("offerte", "ja"); set("termijn", "<1m"); set("eigenaar", "eigenaar");
  f.querySelector("input[name=situatie][value=defect]").checked = true;
  set("naam", "Test"); set("telefoon", "0470 12 34 56"); set("email", "t@x.be");
  submit();
  assert.ok(/1000-1299/.test(msg()), "regio-check: " + msg());
  set("postcode", "3000");
  submit();
  assert.ok(sent === null && /1500-1999/.test(msg()), "Leuven valt buiten startregio: " + msg());
  set("brandstof", "andere"); set("postcode", "1930");
  submit();
  assert.ok(sent === null && /gas|gaz/i.test(msg()), "enkel gas: " + msg());
  set("brandstof", "gas"); set("postcode", "1030"); set("eigenaar", "huurder");
  submit();
  assert.ok(sent === null && /eigenaar|propriétaire/.test(msg()), "huurder geblokkeerd: " + msg());
  set("eigenaar", "eigenaar");
  submit();
  assert.ok(sent === null && msg().length > 0, "toestemming verplicht");
  f.elements["toestemming"].checked = true;
  submit();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(sent, "payload verstuurd");
  assert.strictEqual(sent.telefoon, "+32470123456");
  assert.strictEqual(sent.lang, lang);
  assert.ok(sent.elapsed_ms >= 0 && !("interesse" in sent));
  assert.strictEqual(sent.utm.utm_term, "cv ketel vervangen");
  assert.strictEqual(d.getElementById("done").style.display, "block");
  assert.ok(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(endpoint), "endpoint uit config.js: " + endpoint);
  const legal = d.querySelector("[data-legal-line]").textContent;
  assert.ok(/Marhaba Data & AI Agent BV · (ondernemingsnummer|n° d'entreprise) BE 1003\.552\.102 · Zaventem/.test(legal), "footer: " + legal);
  assert.strictEqual(d.querySelector("[data-contact-email]").getAttribute("href"), "mailto:momobozf@gmail.com");
  console.log(lang.toUpperCase(), "formulier OK");
}
function privacyPage() {
  const html = fs.readFileSync(path.join(root, "privacy.html"), "utf8").replace(/<script src="\/assets\/[a-z]+\.js"><\/script>/g, "");
  assert.ok(!html.includes("JOUWDOMEIN"), "geen placeholder in de HTML zelf");
  const run = (cfgPatch) => {
    const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://ketelcheck.test/privacy.html" });
    dom.window.eval(fs.readFileSync(path.join(root, "assets/config.js"), "utf8"));
    if (cfgPatch) dom.window.eval(cfgPatch);
    dom.window.eval(fs.readFileSync(path.join(root, "assets/legal.js"), "utf8"));
    return dom.window.document;
  };
  let d = run();
  const mails = [...d.querySelectorAll("[data-privacy-email]")].map((a) => a.getAttribute("href"));
  assert.ok(mails.length === 2 && mails.every((m) => m === "mailto:momobozf@gmail.com"), "placeholder-privacyadres valt terug op contactadres: " + mails);
  d = run('window.KETELCHECK_CONFIG.privacyEmail = "privacy@ketelcheck.be"; window.KETELCHECK_CONFIG.legal.address = "Straat 1, 1930 Zaventem";');
  assert.ok([...d.querySelectorAll("[data-privacy-email]")].every((a) => a.textContent === "privacy@ketelcheck.be"), "ingesteld privacyadres wordt gebruikt");
  assert.ok(d.querySelector("[data-legal-address]").textContent === "Straat 1, 1930 Zaventem");
  assert.ok(/Concept — laten nalezen door een jurist/.test(html) && /BE 1003\.552\.102/.test(html));
  console.log("Privacy OK");
}
(async () => { await run("index.html", "nl"); await run("fr/index.html", "fr"); privacyPage(); })().catch(e => { console.error(e); process.exit(1); });
