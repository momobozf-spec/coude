// Test frontend-formulier NL en FR met jsdom en een gemockte fetch.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const assert = require("assert");
const root = process.argv[2];

async function run(file, lang) {
  const html = fs.readFileSync(path.join(root, file), "utf8").replace('<script src="/assets/app.js"></script>', "");
  const dom = new JSDOM(html, { url: "https://ketelcheck.test/" + (lang === "fr" ? "fr/" : "") + "?utm_source=google&utm_term=cv%20ketel%20vervangen", runScripts: "outside-only" });
  const w = dom.window;
  let sent = null;
  w.fetch = (url, opts) => { sent = JSON.parse(opts.body); return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: "L1" }) }); };
  w.eval(fs.readFileSync(path.join(root, "assets/app.js"), "utf8"));
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
  console.log(lang.toUpperCase(), "formulier OK");
}
(async () => { await run("index.html", "nl"); await run("fr/index.html", "fr"); })().catch(e => { console.error(e); process.exit(1); });
