const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const PW = "klushulp-demo-2026";
const shots = "/home/claude/klushulp/demo-output";
const log = (...a) => console.log("[e2e]", ...a);

(async () => {
  const browser = await chromium.launch();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "nl-BE" });
  const page = await mobile.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  // 1. Klant: wizard
  await page.goto(`${BASE}/nl`);
  await page.fill("#home-description", "Keukenkraan lekt al twee dagen, druppelt continu onder de gootsteen.");
  await page.fill("#home-place", "2600");
  await page.screenshot({ path: `${shots}/01-home-mobiel.png`, fullPage: true });
  await page.click("button[type=submit]");
  await page.waitForURL(/\/nl\/aanvraag/);
  await page.waitForSelector("#description");
  await page.selectOption("#q-problem", "leak");
  await page.screenshot({ path: `${shots}/02-stap1-mobiel.png`, fullPage: true });
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.waitForSelector("#place");
  // gemeente wordt automatisch gekozen bij 4-cijferige postcode
  await page.waitForFunction(() => (document.querySelector("#place")).value.includes("Berchem"), null, { timeout: 5000 });
  await page.fill("#street", "Teststraat 12");
  await page.screenshot({ path: `${shots}/03-stap2-mobiel.png`, fullPage: true });
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.waitForSelector("#name");
  await page.fill("#name", "Mo Test");
  await page.fill("#email", "mo@test.local");
  await page.fill("#phone", "0470 00 00 00");
  await page.check("input[type=checkbox]");
  await page.screenshot({ path: `${shots}/04-stap3-mobiel.png`, fullPage: true });
  await page.getByRole("button", { name: "Aanvraag versturen" }).click();
  await page.waitForURL(/\/nl\/a\/[A-Za-z0-9_-]+\?nieuw=1/, { timeout: 20000 });
  const customerUrl = page.url().split("?")[0];
  log("klantlink", customerUrl);
  const matchText = await page.locator("[role=status]").first().innerText();
  log("match", matchText.replace(/\n/g, " | "));
  await page.screenshot({ path: `${shots}/05-aanvraag-verstuurd-mobiel.png`, fullPage: true });

  // 2. Dienstverlener: inloggen, aanvraag zien, voorstel sturen
  const prov = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await prov.newPage();
  pp.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await pp.goto(`${BASE}/nl/login`);
  await pp.fill("#email", "loodgieter1@klushulp.local");
  await pp.fill("#password", PW);
  await pp.click("button[type=submit]");
  await pp.waitForURL(/\/nl\/dashboard/);
  await pp.screenshot({ path: `${shots}/06-dashboard-mobiel.png`, fullPage: true });
  await pp.goto(`${BASE}/nl/dashboard/aanvragen`);
  const detail = pp.getByRole("link", { name: "Details" }).first();
  await detail.click();
  await pp.waitForSelector("#priceType");
  await pp.fill("#amount", "120");
  await pp.fill("#included", "Kraan vervangen, afvoer controleren");
  await pp.fill("#excluded", "Nieuwe kraan (klant koopt zelf)");
  await pp.fill("#message", "Ik kan woensdagvoormiddag langskomen.");
  await pp.screenshot({ path: `${shots}/07-voorstel-formulier-mobiel.png`, fullPage: true });
  await pp.getByRole("button", { name: "Voorstel sturen" }).click();
  await pp.waitForSelector("text=Verstuurd", { timeout: 15000 });
  log("voorstel verstuurd");

  // Niet-passende dienstverlener (elektricien) mag deze aanvraag niet zien.
  const el = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ep = await el.newPage();
  await ep.goto(`${BASE}/nl/login`);
  await ep.fill("#email", "elektricien1@klushulp.local");
  await ep.fill("#password", PW);
  await ep.click("button[type=submit]");
  await ep.waitForURL(/\/nl\/dashboard/);
  const reqId = pp.url().split("/").pop();
  const resp = await ep.goto(`${BASE}/nl/dashboard/aanvragen/${reqId}`);
  log("elektricien opent loodgieteraanvraag → HTTP", resp.status());

  // Klant ziet voorstel niet als elektricien... klant zonder token:
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  const r2 = await ap.goto(`${BASE}/nl/dashboard/aanvragen/${reqId}`);
  log("anoniem opent dashboard → eindigt op", ap.url(), r2.status());

  // 3. Klant vergelijkt en accepteert
  await page.goto(customerUrl);
  await page.waitForSelector("text=Vaste prijs");
  await page.screenshot({ path: `${shots}/08-voorstellen-mobiel.png`, fullPage: true });
  await page.getByRole("button", { name: "Dit voorstel kiezen" }).click();
  await page.getByRole("button", { name: "Afspraak bevestigen" }).click();
  await page.waitForSelector("text=Je afspraak", { timeout: 15000 });
  await page.screenshot({ path: `${shots}/09-afspraak-mobiel.png`, fullPage: true });
  log("afspraak bevestigd");

  // 4. Dienstverlener rondt af
  await pp.goto(`${BASE}/nl/dashboard/opdrachten`);
  await pp.getByRole("link", { name: "Details" }).first().click();
  await pp.waitForSelector("text=mo@test.local");
  await pp.screenshot({ path: `${shots}/10-opdracht-detail-mobiel.png`, fullPage: true });
  await pp.getByRole("button", { name: "Opdracht afronden" }).click();
  await pp.waitForSelector("text=Afgerond", { timeout: 15000 });
  log("afgerond");

  // 5. Klant beoordeelt
  await page.goto(customerUrl);
  await page.waitForSelector("text=Hoe was het?");
  await page.getByRole("radio", { name: "5/5" }).click();
  await page.fill("#review-body", "Snel en netjes.");
  await page.getByRole("button", { name: "Beoordeling plaatsen" }).click();
  await page.waitForSelector("text=Bedankt voor je beoordeling", { timeout: 15000 });
  await page.screenshot({ path: `${shots}/11-beoordeling-mobiel.png`, fullPage: true });
  log("beoordeling geplaatst");

  // 6. Beheer
  const adm = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adp = await adm.newPage();
  await adp.goto(`${BASE}/nl/login`);
  await adp.fill("#email", "beheer@klushulp.local");
  await adp.fill("#password", PW);
  await adp.click("button[type=submit]");
  await adp.waitForURL(/\/nl\/(dashboard|beheer)/);
  await adp.goto(`${BASE}/nl/beheer`);
  await adp.screenshot({ path: `${shots}/12-beheer-desktop.png`, fullPage: true });
  await adp.goto(`${BASE}/nl/beheer/dienstverleners`);
  await adp.getByRole("link", { name: /Wachtend/ }).click();
  await adp.waitForSelector("text=Verificaties");
  await adp.screenshot({ path: `${shots}/13-beheer-dienstverlener-desktop.png`, fullPage: true });
  // Publiek profiel + zoeken + FR
  await page.goto(`${BASE}/fr/zoeken?c=plumbing&p=2600`);
  await page.screenshot({ path: `${shots}/14-zoeken-fr-mobiel.png`, fullPage: true });
  await browser.close();
  log("KLAAR");
})().catch((e) => { console.error("E2E FAIL", e); process.exit(1); });
