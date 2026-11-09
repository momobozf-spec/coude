/**
 * Loopt de volledige klantreis door in een echte browser en maakt schermafbeeldingen.
 *
 *   npm run dev:db && npm run dev:api && npm run dev:pwa   # elk in een terminal
 *   node scripts/walkthrough.mjs
 *
 * Dit is geen vervanging van de rooktests — die controleren gedrag. Dit
 * controleert of het scherm doet wat we denken: rendert de QR, werkt het
 * thema-wisselen, klopt de Franse vertaling, en komt de klant na het betalen
 * echt bij zijn kasbon uit.
 *
 * De deurscanner wordt hier nagebootst met `fetch`: we lezen het sessietoken uit
 * de browser, vragen een sleutel op en wisselen die in bij `/gate/unlock` — exact
 * wat het kastje aan de muur doet.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = 'http://localhost:3000';
const API = 'http://localhost:4000/api/v1';
const DEVICE_KEY = 'dev-scanner-antwerpen-zuid-vervang-in-productie';
const DEVICE_ID = 'scanner-voordeur-01';

const here = dirname(fileURLToPath(import.meta.url));
const shots = resolve(here, '..', 'docs', 'screenshots');
mkdirSync(shots, { recursive: true });

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
  }
}

const prisma = new PrismaClient();

/**
 * Zet de bezettingsteller op nul.
 *
 * Nodig omdat elke `unlock` de teller verhoogt en alleen `/gate/exit` hem
 * verlaagt. De rooktests lopen de winkel wél in maar nooit uit, dus na een paar
 * runs staat de winkel administratief vol. In productie is dat precies wat er
 * gebeurt als de uitgangssensor hapert — vandaar dat deze doorloop hieronder ook
 * echt de deur uit gaat.
 */
async function resetOccupancy(storeId) {
  await prisma.store.update({ where: { id: storeId }, data: { currentOccupancy: 0 } });
}

/** Speelt de fysieke deurscanner: haalt een sleutel op en wisselt hem in. */
async function openDoor(sessionToken, storeId) {
  const tokenResponse = await fetch(`${API}/access/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ storeId }),
  });
  const { qrPayload } = await tokenResponse.json();

  const unlockResponse = await fetch(`${API}/gate/unlock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-key': DEVICE_KEY },
    body: JSON.stringify({ qrPayload, storeId, deviceId: DEVICE_ID }),
  });

  return unlockResponse.json();
}

/** Speelt de uitgangssensor. */
async function leaveStore(storeId, basketId) {
  const response = await fetch(`${API}/gate/exit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-key': DEVICE_KEY },
    body: JSON.stringify({ storeId, deviceId: DEVICE_ID, basketId }),
  });
  return response.status;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 15
  deviceScaleFactor: 2,
  locale: 'nl-BE',
});
const page = await context.newPage();

/**
 * Echte JavaScript-fouten. Niet: mislukte netwerkverzoeken.
 *
 * Chromium logt elke 4xx-respons als console-error. Deze doorloop lokt bewust
 * een 400 uit (een barcode met een fout controlecijfer), en dat is geen bug maar
 * de bedoeling. Een `pageerror` daarentegen is altijd een echte uitzondering.
 */
const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(`uncaught: ${error.message}`));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (text.startsWith('Failed to load resource')) return;
  consoleErrors.push(text);
});

/**
 * Onze eigen meldingen, zonder Next's route-announcer.
 *
 * Next injecteert een leeg `<div role="alert" id="__next-route-announcer__">`
 * voor schermlezers. Dat is correct van Next, maar het maakt `getByRole('alert')`
 * dubbelzinnig.
 */
const alerts = () => page.locator('[role="alert"]:not(#__next-route-announcer__)');

const email = `browser+${Date.now()}@voorbeeld.be`;

try {
  console.log('\n── Registratie ────────────────────────────────────────────────');
  await page.goto(`${APP}/registreren`);
  await page.waitForSelector('input[name="fullName"]');

  const submit = page.getByRole('button', { name: 'Account aanmaken' });
  check('knop staat uit zonder AVG-toestemming', await submit.isDisabled());

  await page.fill('input[name="fullName"]', 'Jamila Bouzouf');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'een-heel-lang-wachtwoord');
  await page.screenshot({ path: `${shots}/1-registreren.png` });

  await page.check('input[name="accessLog"]');
  check('knop staat nog uit met maar één toestemming', await submit.isDisabled());

  await page.check('input[name="camera"]');
  check('knop staat aan zodra beide toestemmingen staan', await submit.isEnabled());

  await submit.click();

  // Navigatie óf een foutmelding — wat het eerst komt. Zonder deze race is een
  // afgewezen registratie niet te onderscheiden van een trage server, en krijg je
  // een nietszeggende timeout in plaats van de reden.
  //
  // De meest voorkomende reden: `/auth/register` staat op 5 pogingen per minuut
  // per IP. Draai je de rooktests vlak hiervoor, dan zit je limiet vol.
  const outcome = await Promise.race([
    page.waitForURL('**/sleutel').then(() => 'navigated'),
    alerts()
      .first()
      .waitFor({ state: 'visible' })
      .then(async () => `geweigerd: ${(await alerts().first().textContent())?.trim()}`),
  ]).catch((error) => `geen reactie: ${error.message.split('\n')[0]}`);

  check(`registratie leidt naar de sleutelpagina (${outcome})`, outcome === 'navigated');
  if (outcome !== 'navigated') throw new Error(`Registratie mislukt — ${outcome}`);

  console.log('\n── Winkelkeuze & sleutel ──────────────────────────────────────');
  await page.getByText('Antwerpen Zuid').click();
  await page.waitForSelector('svg[viewBox="0 0 288 288"]');

  // De QR-code zelf. `qrcode` tekent eerst een witte achtergrond als kort
  // <path>, en daarna alle donkere modules als één lang <path>. Die tweede is de
  // maat: een echte QR met een ondertekende JWS erin heeft duizenden tekens aan
  // padcommando's. Een leeg of half gerenderd vakje niet.
  const qrPathLength = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('div[aria-hidden="true"] svg path[d]')];
    return Math.max(0, ...paths.map((path) => path.getAttribute('d').length));
  });
  check(`QR-code is echt getekend (pad van ${qrPathLength} tekens)`, qrPathLength > 2000);

  const countdown = await page.getByText(/Verloopt over \d+s/).textContent();
  check(`aftelling loopt: "${countdown?.trim()}"`, /Verloopt over \d+s/.test(countdown ?? ''));

  // De aftelring moet écht leeglopen. Deelt de component per ongeluk door de
  // verkeerde levensduur, dan blijft `strokeDashoffset` op 0 staan en beweegt de
  // ring nooit — wat je aan een groene cirkel niet ziet, maar hier wel.
  const ringOffset = () =>
    page.evaluate(() => {
      const circles = document.querySelectorAll('svg circle');
      return Number(circles[1]?.getAttribute('stroke-dashoffset') ?? 0);
    });

  const offsetBefore = await ringOffset();
  await page.waitForTimeout(3_000);
  const offsetAfter = await ringOffset();
  check(`aftelring loopt leeg (${offsetBefore.toFixed(0)} → ${offsetAfter.toFixed(0)})`, offsetAfter > offsetBefore);

  // De QR moet binnen de ring vallen, niet eronder hangen.
  const layout = await page.evaluate(() => {
    const ring = document.querySelector('svg circle')?.closest('svg')?.getBoundingClientRect();
    const qr = document.querySelector('div[aria-hidden="true"] svg')?.getBoundingClientRect();
    if (!ring || !qr) return null;
    return {
      inside: qr.top >= ring.top && qr.bottom <= ring.bottom && qr.left >= ring.left && qr.right <= ring.right,
    };
  });
  check('QR-code valt binnen de aftelring', layout?.inside === true);

  await page.screenshot({ path: `${shots}/2-sleutel-smaragd.png` });

  console.log('\n── Thema & taal ───────────────────────────────────────────────');
  const paletteBefore = await page.evaluate(() => document.documentElement.dataset.palette);
  await page.getByRole('button', { name: /Thema/ }).click();
  const paletteAfter = await page.evaluate(() => document.documentElement.dataset.palette);
  check(`thema wisselt (${paletteBefore} → ${paletteAfter})`, paletteBefore !== paletteAfter);

  const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`achtergrond is nu koningsblauw (${canvas})`, canvas === 'rgb(10, 31, 68)');
  await page.screenshot({ path: `${shots}/3-sleutel-koningsblauw.png` });

  await page.getByRole('button', { name: /Taal/ }).click();
  await page.waitForTimeout(200);
  const frenchTitle = await page.getByRole('heading', { level: 1 }).textContent();
  check(`Franse vertaling actief ("${frenchTitle?.trim()}")`, frenchTitle?.trim() === 'Ma clé');
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  check(`<html lang> volgt de taal (${htmlLang})`, htmlLang === 'fr');
  await page.screenshot({ path: `${shots}/4-sleutel-frans.png` });

  // Terug naar Nederlands en smaragd voor de rest van de doorloop.
  await page.getByRole('button', { name: /Langue/ }).click();
  await page.getByRole('button', { name: /Thema/ }).click();
  await page.waitForTimeout(200);

  console.log('\n── Scannen zonder open deur ───────────────────────────────────');
  await page.getByRole('link', { name: 'Scannen' }).click();
  await page.waitForURL('**/scannen');
  await alerts().first().waitFor();
  const blocked = await alerts().first().textContent();
  check('scannen wordt geweigerd zolang de deur dicht is', blocked?.includes('niet in de winkel') ?? false);
  await page.screenshot({ path: `${shots}/5-scannen-geen-toegang.png` });

  console.log('\n── De deur gaat open ──────────────────────────────────────────');
  const sessionToken = await page.evaluate(() => window.localStorage.getItem('jj.session'));
  const storeId = await page.evaluate(() => window.localStorage.getItem('jj.store'));

  await resetOccupancy(storeId);
  const unlocked = await openDoor(sessionToken, storeId);
  check(`scanner opent de deur (${unlocked.result})`, unlocked.result === 'GRANTED');

  const occupied = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  check(`bezetting staat op 1 (max ${occupied.maxOccupancy})`, occupied.currentOccupancy === 1);
  const basketId = unlocked.basketId;

  console.log('\n── Scannen ────────────────────────────────────────────────────');
  await page.reload();
  await page.waitForSelector('input[name="barcode"]');

  // De camera bestaat niet in headless Chromium, dus de app valt terug op
  // handmatige invoer. Dat is precies het pad dat een Safari-gebruiker neemt.
  const cameraFallback = await alerts().first().textContent();
  check(
    `zonder camera valt de app terug op handmatige invoer ("${cameraFallback?.slice(0, 32)}…")`,
    cameraFallback?.includes('ondersteunt camerascannen niet') ?? false,
  );

  for (const barcode of ['5412345000013', '5412345000044', '5412345000075']) {
    await page.fill('input[name="barcode"]', barcode);
    await page.getByRole('button', { name: 'Toevoegen' }).click();
    await page.waitForTimeout(400);
  }

  const added = await alerts().last().textContent();
  check(`laatste scan bevestigd ("${added?.trim()}")`, added?.includes('toegevoegd') ?? false);
  await page.screenshot({ path: `${shots}/6-scannen.png` });

  await page.fill('input[name="barcode"]', '5412345000018'); // fout controlecijfer
  await page.getByRole('button', { name: 'Toevoegen' }).click();
  await page.waitForTimeout(600);
  const rejected = await alerts().last().textContent();
  check(`fout controlecijfer wordt geweigerd ("${rejected?.trim()}")`, rejected?.includes('onleesbaar') ?? false);

  console.log('\n── Mandje ─────────────────────────────────────────────────────');
  await page.getByRole('link', { name: 'Mandje' }).click();
  await page.waitForURL('**/mandje');
  await page.waitForSelector('text=Te betalen');

  // De totalenkaart, niet de productregels: die tonen óók "Btw 21%".
  const totals = page.getByTestId('totals');

  const total = await totals.getByText(/^€/).last().textContent();
  // 1 × €34,50 + 1 × €12,50 = €47,00 @ 21%  +  1 × €7,95 @ 6%  =  €54,95
  check(`totaal klopt (${total?.trim()})`, total?.includes('54,95') ?? false);

  const vatRows = await totals.getByText(/^Btw \d+%$/).count();
  check(`btw is per tarief uitgesplitst in de totalen (${vatRows} tarieven)`, vatRows === 2);

  // Productnamen mogen niet afgekapt worden: een klant die "Geschenkset “Lay…"
  // leest, weet niet wat hij koopt.
  const truncated = await page.evaluate(() =>
    [...document.querySelectorAll('li p')].some((el) => el.scrollWidth > el.clientWidth + 1),
  );
  check('productnamen worden niet afgekapt', truncated === false);

  // De betaalknop moet bereikbaar zijn, niet verstopt achter de navigatiebalk.
  await page.getByRole('button', { name: /betalen/ }).scrollIntoViewIfNeeded();
  const payVisible = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('betalen'));
    const nav = document.querySelector('nav');
    if (!button || !nav) return false;
    const b = button.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    return b.bottom <= n.top + 1; // knop eindigt boven de navigatiebalk
  });
  check('betaalknop wordt niet bedekt door de navigatiebalk', payVisible);

  await page.screenshot({ path: `${shots}/7-mandje.png`, fullPage: true });

  console.log('\n── Betalen ────────────────────────────────────────────────────');
  check('Bancontact staat als eerste betaalmethode', (await page.locator('label').first().textContent()) === 'Bancontact');

  await page.getByRole('button', { name: /betalen/ }).click();
  await page.waitForURL('**/betaling/simulatie**');
  check('checkout stuurt door naar de betaalpagina', page.url().includes('/betaling/simulatie'));
  await page.screenshot({ path: `${shots}/8-betalen.png` });

  await page.getByRole('button', { name: 'Betaling simuleren' }).click();
  await page.waitForURL('**/bonnen', { timeout: 10_000 });

  console.log('\n── Kasbon ─────────────────────────────────────────────────────');
  await page.waitForSelector('text=/Factuur JJ/');
  const invoice = await page.getByText(/Factuur JJ\/\d{4}\/\d{6}/).textContent();
  check(`kasbon met wettelijk factuurnummer ("${invoice?.trim()}")`, /Factuur JJ\/\d{4}\/\d{6}/.test(invoice ?? ''));

  const vatTable = await page.locator('table tbody tr').count();
  check(`btw-uitsplitsing op de bon (${vatTable} tarieven)`, vatTable === 2);

  const vatNumber = await page.getByText(/BE 0123\.456\.789/).count();
  check('btw-nummer van de uitbater staat op de bon', vatNumber === 1);
  await page.screenshot({ path: `${shots}/9-kasbon.png`, fullPage: true });

  console.log('\n── De klant verlaat de winkel ─────────────────────────────────');
  const exitStatus = await leaveStore(storeId, basketId);
  check(`uitgangssensor meldt het vertrek (${exitStatus})`, exitStatus === 204);

  const emptied = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  check('bezetting staat weer op 0', emptied.currentOccupancy === 0);

  // Een dubbel exit-signaal — haperende sensor, klant die twee keer langs de
  // poort loopt — mag de teller niet negatief maken.
  await leaveStore(storeId, basketId);
  const doubleExit = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  check('dubbel exit-signaal maakt de teller niet negatief', doubleExit.currentOccupancy === 0);

  console.log('\n── Consolefouten ──────────────────────────────────────────────');
  check(`geen javascript-fouten (${consoleErrors.length})`, consoleErrors.length === 0);
  if (consoleErrors.length > 0) consoleErrors.forEach((error) => console.log(`      ${error}`));
} finally {
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} geslaagd, ${failed} mislukt\x1b[0m`);
console.log(`Schermafbeeldingen: ${shots}\n`);
if (failed > 0) process.exitCode = 1;
