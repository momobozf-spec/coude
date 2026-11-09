/**
 * Doorloop van de Superette-app in een echte browser, met schermafbeeldingen.
 *
 *   npm run dev:db && npm run dev:api && npm run dev:web      # elk in een terminal
 *   COMPARE_JOB_KEY=<sleutel> node scripts/walkthrough-superette.mjs
 *
 * Dekt de verticale flow uit de opdracht: zoeken → vergelijken → productdetail
 * → lijst → mandje → voorkeuren → prijsalert → "Mijn prijsalerts" → in-app
 * melding, plus eigendomscontrole met een tweede gebruiker, demodata-
 * aanduidingen, Nederlandse notatie, responsive schermen (390 px en 1280 px)
 * en basisregels voor toegankelijkheid (één h1, labels, namen van knoppen,
 * skip-link, toetsenbord, landmarks).
 *
 * De meldingsflow vraagt de API om een synchronisatie via het interne
 * endpoint; dat kan alleen server-side met `COMPARE_JOB_KEY`. Zonder sleutel
 * wordt die stap overgeslagen en gemeld.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = process.env.WEB_URL ?? 'http://localhost:3001';
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const JOB_KEY = process.env.COMPARE_JOB_KEY ?? '';
/** Tegen `next start` (productie-CSP zonder unsafe-eval): zet EXPECT_PRODUCTION_CSP=true. */
const EXPECT_PRODUCTION_CSP = process.env.EXPECT_PRODUCTION_CSP === 'true';
const PASSWORD = 'een-lang-genoeg-wachtwoord';
/** Tegen een staging met zelfondertekend certificaat: IGNORE_TLS_ERRORS=true. */
const IGNORE_TLS = process.env.IGNORE_TLS_ERRORS === 'true';

// axe-core wordt via een init-script (CDP) ingeladen: dat omzeilt de CSP van de
// pagina, zoals een browserextensie, zonder de CSP zelf te verzwakken.
const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const axeViolations = [];

const here = dirname(fileURLToPath(import.meta.url));
const shots = resolve(here, '..', 'docs', 'screenshots-superette');
mkdirSync(shots, { recursive: true });

let passed = 0;
let failed = 0;
const skipped = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/**
 * Playwright's eigen Chromium-revisie, of — als die niet geïnstalleerd is — de
 * nieuwste lokaal aanwezige revisie in `%LOCALAPPDATA%\ms-playwright`.
 * `PLAYWRIGHT_CHROMIUM_EXECUTABLE` wint altijd.
 */
function launchOptions() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit && existsSync(explicit)) return { executablePath: explicit };
  if (existsSync(chromium.executablePath())) return {};

  const local = resolve(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (existsSync(local)) {
    const dirs = readdirSync(local)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const exe = resolve(local, dir, 'chrome-win64', 'chrome.exe');
      if (existsSync(exe)) return { executablePath: exe };
    }
  }
  return {};
}

/** Basiscontroles voor toegankelijkheid op de huidige pagina. */
async function a11y(page, name) {
  const h1 = await page.locator('h1').count();
  check(`${name}: precies één h1`, h1 === 1, `gevonden: ${h1}`);

  const unlabeled = await page.$$eval('input:not([type=hidden]), select, textarea', (els) =>
    els.filter((el) => {
      const id = el.getAttribute('id');
      const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const wrapped = el.closest('label');
      return !hasLabel && !wrapped && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
    }).length,
  );
  check(`${name}: elk invoerveld heeft een label`, unlabeled === 0, `zonder label: ${unlabeled}`);

  const nameless = await page.$$eval('button, a[href]', (els) =>
    els.filter((el) => (el.textContent ?? '').trim() === '' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')).length,
  );
  check(`${name}: elke knop en link heeft een naam`, nameless === 0, `zonder naam: ${nameless}`);

  check(`${name}: main-landmark aanwezig`, (await page.locator('main#main').count()) === 1);
  check(`${name}: navigatie met aria-label`, (await page.locator('nav[aria-label]').count()) >= 1);
  const lang = await page.evaluate(() => document.documentElement.lang);
  check(`${name}: lang-attribuut gezet`, /^(nl|fr|en)/.test(lang), lang);
  await axeScan(page, name);
}

/** Volledige axe-core-scan (WCAG 2.1 A/AA + best practices) van de huidige pagina. */
async function axeScan(page, name) {
  const result = await page.evaluate(async () => {
    if (typeof window.axe === 'undefined') return { error: 'axe niet geladen' };
    const run = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
    return { violations: run.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })) };
  });
  if (result.error) {
    check(`${name}: axe-core geladen`, false, result.error);
    return;
  }
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of result.violations) axeViolations.push({ page: name, ...v });
  check(
    `${name}: axe zonder serious/critical-overtredingen`,
    serious.length === 0,
    serious.map((v) => `${v.id} (${v.impact}, ${v.nodes}×): ${v.help} → ${v.targets.join(', ')}`).join('\n      '),
  );
  if (result.violations.length > serious.length) {
    console.log(`      ℹ ${name}: ${result.violations.length - serious.length} minor/moderate axe-opmerking(en): ${result.violations.filter((v) => !serious.includes(v)).map((v) => v.id).join(', ')}`);
  }
}

/** Beveiligingsheaders van de app-server (middleware.ts). */
function headerChecks(response, name) {
  const headers = response.headers();
  const csp = headers['content-security-policy'] ?? '';
  check(`${name}: CSP met nonce en strict-dynamic`, /script-src[^;]*'nonce-[^']+'[^;]*'strict-dynamic'/.test(csp), csp.slice(0, 160));
  check(`${name}: CSP zonder wildcard-bronnen`, !/\s\*[\s;]/.test(csp) && !/https?:\s/.test(csp), csp.slice(0, 160));
  check(`${name}: CSP verbiedt framing`, /frame-ancestors 'none'/.test(csp));
  if (EXPECT_PRODUCTION_CSP) check(`${name}: CSP zonder unsafe-eval (productie)`, !csp.includes('unsafe-eval'), csp.slice(0, 160));
  check(`${name}: X-Content-Type-Options nosniff`, headers['x-content-type-options'] === 'nosniff');
  check(`${name}: Referrer-Policy gezet`, !!headers['referrer-policy']);
  check(`${name}: Permissions-Policy gezet`, !!headers['permissions-policy']);
  check(`${name}: X-Frame-Options DENY`, headers['x-frame-options'] === 'DENY');
  check(`${name}: geen X-Powered-By`, !headers['x-powered-by']);
}

async function register(page, suffix) {
  const email = `walkthrough-${Date.now()}-${suffix}@example.com`;
  await page.goto(`${WEB}/registreren`);
  await page.getByLabel('Naam').fill(`Walkthrough ${suffix}`);
  await page.getByLabel('E-mailadres').fill(email);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByLabel(/gebruiksvoorwaarden/).check();
  await page.getByRole('button', { name: 'Account maken' }).click();
  await page.waitForURL(/\/profiel/);
  return email;
}

async function main() {
  const browser = await chromium.launch(launchOptions());
  const mobile = await browser.newContext({ ignoreHTTPSErrors: IGNORE_TLS, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'nl-BE', timezoneId: 'Europe/Brussels' });
  await mobile.addInitScript({ content: AXE_SOURCE });
  const page = await mobile.newPage();
  page.setDefaultTimeout(20_000);

  section('Landingspagina (mobiel)');
  const landing = await page.goto(WEB);
  await page.waitForSelector('h1');
  headerChecks(landing, 'home');
  // Zonder nonce op Next's eigen script-tags blokkeert de CSP de hydratie: de
  // pagina lijkt te werken (HTML), maar niets reageert.
  const landingHtml = await landing.text();
  const scriptsWithoutNonce = (landingHtml.match(/<script(?![^>]*\bnonce=)[^>]*>/g) ?? []).filter((tag) => !/type="application\/(ld\+)?json"/.test(tag));
  check('alle script-tags dragen de CSP-nonce', scriptsWithoutNonce.length === 0, scriptsWithoutNonce.slice(0, 2).join(' '));
  check('pagina hydrateert (interactief)', await page.evaluate(() => !!document.querySelector('nav.fixed a[href="/zoeken"]')) );
  check('titel bevat Superette', /Superette/.test(await page.title()));
  check('demobanner zichtbaar', await page.getByRole('status').filter({ hasText: /demogegevens/i }).first().isVisible());
  // De heldertekst noemt de ketens ook; wacht op de kaartjes zelf.
  await page.waitForSelector('section[aria-labelledby="chains-title"] li >> text=Delhaize');
  check('zeven supermarkten getoond', (await page.locator('section[aria-labelledby="chains-title"] li').count()) === 7);
  // Staging kan één keten als (fictieve) niet-geverifieerde bron voeren: EXPECT_DEMO_CHAINS=6.
  const expectedDemoChains = Number(process.env.EXPECT_DEMO_CHAINS ?? 7);
  check(`ketens gemarkeerd als DEMO (${expectedDemoChains})`, (await page.locator('section[aria-labelledby="chains-title"]').getByText('DEMO', { exact: true }).count()) === expectedDemoChains);
  check('mobiele tabbalk met vijf bestemmingen', (await page.locator('nav.fixed ul li').count()) === 5);
  await page.keyboard.press('Tab');
  check('skip-link krijgt eerst de focus', await page.evaluate(() => document.activeElement?.getAttribute('href') === '#main'));
  await a11y(page, 'home');
  await page.screenshot({ path: resolve(shots, '01-home-mobiel.png'), fullPage: true });

  section('Zoeken en vergelijken');
  await page.getByLabel('Zoeken').first().fill('Coca-Cola Zero 1,5 L');
  await page.getByRole('button', { name: 'Vergelijk prijzen' }).click();
  await page.waitForURL(/\/zoeken\?q=/);
  await page.waitForSelector('[data-testid="product-card"]');
  const cards = await page.locator('[data-testid="product-card"]').count();
  check('zoekresultaten gevonden', cards >= 1, `kaarten: ${cards}`);
  const firstCard = page.locator('[data-testid="product-card"]').first();
  check('prijs in Belgische notatie', /€\s?\d+,\d{2}/.test(await firstCard.innerText()));
  check('eenheidsprijs per liter getoond', /\/l/.test(await firstCard.innerText()));
  check('bron en controlemoment bij de prijs', /Laatst gecontroleerd/.test(await firstCard.innerText()));
  check('DEMO-aanduiding op zoekresultaat', (await firstCard.getByText('DEMO', { exact: true }).count()) >= 1);
  check('meerdere supermarkten vergeleken', /Vergelijk bij \d+ winkels/.test(await firstCard.innerText()));

  await page.getByLabel('Sorteren').selectOption('PACKAGE_PRICE');
  await page.waitForURL(/sorteer=PACKAGE_PRICE/);
  check('sortering in de URL', page.url().includes('sorteer=PACKAGE_PRICE'));

  // De URL is de bron van waarheid voor de filters: klikken → URL → vinkje.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByLabel('Lidl', { exact: false }).first().click();
  await page.waitForURL(/winkels=lidl/);
  check('ketenfilter in de URL', page.url().includes('winkels=lidl'));
  check('ketenfilter aangevinkt vanuit de URL', await page.getByLabel('Lidl', { exact: false }).first().isChecked());
  await page.waitForSelector('[data-testid="product-card"]');
  const onlyLidl = await page
    .waitForFunction(() => {
      const card = document.querySelector('[data-testid="product-card"]');
      return !!card && card.textContent.includes('Lidl') && !card.textContent.includes('Delhaize');
    }, undefined, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check('resultaten beperkt tot de gekozen keten', onlyLidl);
  await page.getByLabel('Lidl', { exact: false }).first().click();
  await page.waitForURL((url) => !url.toString().includes('winkels='));
  await page.getByLabel('Alleen promoties').click();
  await page.waitForURL(/promoties=1/);
  check('promotiefilter in de URL', page.url().includes('promoties=1'));
  await page.getByLabel('Alleen promoties').click();
  await page.waitForURL((url) => !url.toString().includes('promoties=1'));
  await page.getByRole('button', { name: /^Filters/ }).click();
  await a11y(page, 'zoeken');
  await page.screenshot({ path: resolve(shots, '02-zoeken-mobiel.png'), fullPage: true });

  section('Productdetail');
  await page.waitForSelector('[data-testid="product-card"]');
  await page.locator('[data-testid="product-card"] h2 a').first().click();
  await page.waitForURL(/\/producten\//);
  await page.waitForSelector('#offers-title');
  const productUrl = page.url();
  const offerCount = await page.locator('section[aria-labelledby="offers-title"] li').count();
  check('prijzen per supermarkt (≥ 2)', offerCount >= 2, `aanbiedingen: ${offerCount}`);
  check('laagste prijs gemarkeerd', (await page.getByText('Laagste prijs', { exact: true }).count()) >= 1);
  check('alternatieven apart van exacte matches', (await page.getByRole('heading', { name: /Alternatieven/ }).count()) === 1);
  check('waarschuwing bij alternatieven', (await page.getByText(/geen exact hetzelfde product/).count()) >= 1);
  check('prijsgeschiedenis met disclaimer', (await page.getByText(/meetmomenten/).count()) >= 1);
  await a11y(page, 'product');
  await page.screenshot({ path: resolve(shots, '03-product-mobiel.png'), fullPage: true });

  section('Account en lijst');
  await page.getByRole('button', { name: 'Voeg toe aan lijst' }).first().click();
  check('zonder account: uitleg en loginknop', (await page.getByRole('link', { name: 'Log in om verder te gaan' }).count()) === 1);
  await page.keyboard.press('Escape');
  const alice = await register(page, 'alice');
  check('registratie geslaagd', /Ingelogd als/.test(await page.locator('main').innerText()), alice);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  check('geen token in localStorage of sessionStorage', !/token|eyJ[A-Za-z0-9_-]{10,}\./i.test(storage), storage.slice(0, 200));
  const cookies = await mobile.cookies();
  const accessCookie = cookies.find((c) => c.name === 'sup_access');
  const refreshCookie = cookies.find((c) => c.name === 'sup_refresh');
  check('sessiecookies zijn HttpOnly', !!accessCookie?.httpOnly && !!refreshCookie?.httpOnly, JSON.stringify(cookies.map((c) => c.name)));
  check('refresh-cookie beperkt tot /api/v1/auth, SameSite=Strict', refreshCookie?.path === '/api/v1/auth' && refreshCookie?.sameSite === 'Strict', JSON.stringify(refreshCookie));
  check('document.cookie ziet de sessie niet', !(await page.evaluate(() => document.cookie)).includes('sup_'));

  await page.goto(productUrl);
  await page.waitForSelector('#offers-title');
  await page.getByRole('button', { name: 'Voeg toe aan lijst' }).first().click();
  await page.getByLabel('Nieuwe lijst maken').fill('Walkthrough-lijst');
  await page.getByRole('dialog').getByRole('button', { name: 'Toevoegen' }).click();
  await page.waitForSelector('text=Toegevoegd aan');
  check('product toegevoegd aan nieuwe lijst', true);
  await page.getByRole('link', { name: 'Bekijk lijst' }).click();
  await page.waitForURL(/\/lijsten\//);
  await page.waitForSelector('#items-title');
  const listUrl = page.url();
  check('lijst toont één regel', /1 regel/.test(await page.locator('#items-title').innerText()));

  // Tweede product via zoeken, toegevoegd aan dezelfde lijst.
  await page.goto(`${WEB}/zoeken?q=halfvolle%20melk`);
  await page.waitForSelector('[data-testid="product-card"]');
  await page.locator('[data-testid="product-card"]').first().getByRole('button', { name: 'Voeg toe aan lijst' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Walkthrough-lijst/ }).click();
  await page.waitForSelector('text=Toegevoegd aan');
  await page.goto(listUrl);
  await page.waitForSelector('#items-title');
  await page.waitForFunction(() => document.querySelector('#items-title')?.textContent?.includes('2 regels'), undefined, { timeout: 15_000 }).catch(() => undefined);
  check('lijst toont twee regels', /2 regels/.test(await page.locator('#items-title').innerText()));

  await page.getByLabel('+').first().click();
  await page.waitForTimeout(600);
  check('aantal verhoogd', (await page.locator('main').innerText()).includes('2'));
  await page.getByLabel('Vrije regel toevoegen').fill('verjaardagskaarsjes');
  await page.getByRole('button', { name: 'Toevoegen' }).last().click();
  await page.waitForSelector('text=verjaardagskaarsjes');
  check('vrije regel toegevoegd', true);

  section('Mandje vergelijken');
  await page.getByRole('button', { name: 'Mandje vergelijken' }).click();
  await page.waitForSelector('[data-testid="combination"], [data-testid="store-basket"]');
  const compareText = await page.locator('section[aria-labelledby="compare-title"]').innerText();
  check('gebalanceerde keuze met uitleg', /Waarom deze keuze/.test(compareText));
  check('vrije regel apart gemeld', /verjaardagskaarsjes/.test(compareText));
  check('per supermarkt een resultaat', (await page.locator('[data-testid="store-basket"]').count()) >= 5);
  check('demogegevens gemeld bij de vergelijking', /demoprijzen/.test(compareText));
  await page.getByRole('button', { name: 'Alles bij één winkel' }).click();
  await page.getByRole('button', { name: 'Mandje vergelijken' }).click();
  await page.waitForTimeout(1500);
  check('één-winkelmodus toont aanbevolen winkel', (await page.getByText('Aanbevolen', { exact: true }).count()) >= 1);
  await page.getByRole('button', { name: 'Goedkoopste combinatie' }).click();
  await page.getByRole('button', { name: 'Mandje vergelijken' }).click();
  await page.waitForSelector('[data-testid="combination"]');
  check('combinatiemodus toont winkelbezoeken', /winkelbezoek/.test(await page.locator('[data-testid="combination"]').innerText()));
  await a11y(page, 'lijst');
  await page.screenshot({ path: resolve(shots, '04-lijst-mandje-mobiel.png'), fullPage: true });

  section('Supermarktvoorkeuren');
  await page.goto(`${WEB}/profiel/voorkeuren`);
  await page.waitForSelector('text=Supermarkten in mijn vergelijking');
  const enabledGroup = page.getByRole('group', { name: 'Supermarkten in mijn vergelijking' });
  await enabledGroup.getByLabel(/Lidl/).check();
  await enabledGroup.getByLabel(/Colruyt/).check();
  await page.getByRole('group', { name: /klantenkaart/ }).getByLabel(/Delhaize/).check();
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('text=Voorkeuren opgeslagen');
  await page.reload();
  await page.waitForSelector('text=Supermarkten in mijn vergelijking');
  check('voorkeuren bewaard na herladen', await page.getByRole('group', { name: 'Supermarkten in mijn vergelijking' }).getByLabel(/Lidl/).isChecked());
  await a11y(page, 'voorkeuren');
  // Terug naar alle ketens, zodat de rest van de doorloop alle winkels ziet.
  await page.getByRole('group', { name: 'Supermarkten in mijn vergelijking' }).getByLabel(/Lidl/).uncheck();
  await page.getByRole('group', { name: 'Supermarkten in mijn vergelijking' }).getByLabel(/Colruyt/).uncheck();
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.waitForSelector('text=Voorkeuren opgeslagen');

  section('Prijsalert');
  await page.goto(productUrl);
  await page.waitForSelector('#offers-title');
  await page.getByRole('link', { name: 'Stel prijsalert in' }).first().click();
  await page.waitForURL(/\/alerts\/nieuw/);
  await page.waitForSelector('text=We laten je weten');
  check('preview met menselijke zin', true);
  check('preview toont huidige laagste prijs', (await page.getByText('Huidige laagste prijs').count()) === 1);
  const lowestText = await page.locator('section[aria-live="polite"]').innerText();
  // Het bedrag ná "Huidige laagste prijs", niet het voorgestelde doel uit de zin erboven
  // (op staging verschillen die: de zin volgt de productpagina, de preview sluit DEMO uit).
  const lowestBlock = lowestText.split(/huidige laagste prijs/i)[1] ?? lowestText;
  const lowestMatch = /€\s?(\d+),(\d{2})/.exec(lowestBlock);
  check('huidige laagste prijs leesbaar', !!lowestMatch, lowestText.slice(0, 80));
  const lowestCents = lowestMatch ? Number(lowestMatch[1]) * 100 + Number(lowestMatch[2]) : 100;
  const target = lowestCents + 20;
  const targetText = `${Math.floor(target / 100)},${String(target % 100).padStart(2, '0')}`;
  await page.getByLabel('Doelprijs (€)').fill(targetText);
  await page.waitForSelector('text=onder je doel');
  check('verschil tot doelprijs getoond', true);
  await page.getByRole('button', { name: 'Alert instellen' }).click();
  await page.waitForURL(/\/alerts\?melding=aangemaakt/);
  await page.waitForSelector('[data-testid="alert-card"]');
  check('alert verschijnt onder Mijn prijsalerts', (await page.locator('[data-testid="alert-card"]').count()) === 1);
  check('alert is al behaald (grens boven laagste prijs)', (await page.getByText('Behaald', { exact: true }).count()) >= 1);
  await a11y(page, 'alerts');
  await page.screenshot({ path: resolve(shots, '05-alerts-mobiel.png'), fullPage: true });

  // Duplicaat: zelfde instellingen nogmaals.
  await page.goto(productUrl);
  await page.waitForSelector('#offers-title');
  await page.getByRole('link', { name: 'Stel prijsalert in' }).first().click();
  await page.waitForURL(/\/alerts\/nieuw/);
  await page.getByLabel('Doelprijs (€)').fill(targetText);
  await page.waitForSelector('text=al een alert');
  check('duplicaat gemeld met link naar bestaande alert', (await page.getByRole('link', { name: 'Bestaande alert bewerken' }).count()) === 1);
  check('opslaan geblokkeerd bij duplicaat', await page.getByRole('button', { name: 'Alert instellen' }).isDisabled());

  await page.goto(`${WEB}/alerts`);
  await page.waitForSelector('[data-testid="alert-card"]');
  await page.getByRole('button', { name: 'Pauzeren' }).click();
  await page.waitForSelector('text=Gepauzeerd');
  check('alert gepauzeerd', true);
  await page.getByRole('button', { name: 'Hervatten' }).click();
  await page.waitForSelector('[data-testid="alert-card"] >> text=Behaald');
  check('alert hervat', true);

  section('In-app melding na synchronisatie');
  if (!JOB_KEY) {
    skipped.push('synchronisatie en melding (COMPARE_JOB_KEY ontbreekt)');
    console.log('  – overgeslagen: COMPARE_JOB_KEY ontbreekt');
  } else {
    // Een werker kan de lease net vasthouden (run van enkele seconden): 409 is dan
    // legitiem en tijdelijk; hoogstens drie pogingen.
    let sync = await fetch(`${API}/compare/internal/sync`, { method: 'POST', headers: { 'x-job-key': JOB_KEY, 'content-type': 'application/json' }, body: '{}' });
    for (let attempt = 1; attempt < 3 && sync.status === 409; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      sync = await fetch(`${API}/compare/internal/sync`, { method: 'POST', headers: { 'x-job-key': JOB_KEY, 'content-type': 'application/json' }, body: '{}' });
    }
    check('interne synchronisatie server-side geslaagd', sync.status === 201 || sync.status === 200, `status ${sync.status}`);
    await page.goto(`${WEB}/meldingen`);
    await page.waitForSelector('[data-testid="notification"]');
    const note = await page.locator('[data-testid="notification"]').first().innerText();
    check('melding met product, winkel en prijs', /€\s?\d+,\d{2}/.test(note), note.slice(0, 160).replace(/\n/g, ' | '));
    // `innerText` volgt de CSS-hoofdletters van het badge ("NIEUW").
    check('melding gemarkeerd als nieuw', /nieuw/i.test(note), note.slice(0, 80).replace(/\n/g, ' | '));
    // Op staging in productie-modus triggeren alerts niet op DEMO-prijzen; de
    // melding komt dan van een (fictieve) niet-geverifieerde bron: EXPECT_DEMO_NOTIFICATION=false.
    if (process.env.EXPECT_DEMO_NOTIFICATION === 'false') skipped.push('melding gemarkeerd als demogegevens (staging: alert op niet-geverifieerde bron)');
    else check('melding gemarkeerd als demogegevens', /demogegevens/.test(note));
    check('ongelezen-badge in navigatie', (await page.locator('nav.fixed').getByText(/^\d+$/).count()) >= 1);
    await page.getByRole('button', { name: 'Als gelezen markeren' }).first().click();
    await page.waitForTimeout(800);
    check('melding als gelezen gemarkeerd', (await page.locator('[data-testid="notification"]').first().getByText('Nieuw', { exact: true }).count()) === 0);
    await page.screenshot({ path: resolve(shots, '06-meldingen-mobiel.png'), fullPage: true });
  }

  section('Eigendomscontrole met een tweede gebruiker');
  const alertHref = await (async () => {
    await page.goto(`${WEB}/alerts`);
    await page.waitForSelector('[data-testid="alert-card"]');
    return page.locator('[data-testid="alert-card"]').first().getByRole('link', { name: 'Bewerken' }).getAttribute('href');
  })();
  const bobContext = await browser.newContext({ ignoreHTTPSErrors: IGNORE_TLS, viewport: { width: 390, height: 844 }, locale: 'nl-BE' });
  await bobContext.addInitScript({ content: AXE_SOURCE });
  const bob = await bobContext.newPage();
  bob.setDefaultTimeout(20_000);
  await register(bob, 'bob');
  await bob.goto(`${WEB}${listUrl.replace(WEB, '')}`);
  await bob.waitForSelector('text=Pagina niet gevonden');
  check('Bob ziet de lijst van Alice niet', true);
  await bob.goto(`${WEB}${alertHref}`);
  await bob.waitForSelector('text=Pagina niet gevonden');
  check('Bob ziet de alert van Alice niet', true);
  await bob.goto(`${WEB}/alerts`);
  await bob.waitForSelector('text=Nog geen prijsalerts');
  check('Bob heeft een lege alertlijst', true);
  await bobContext.close();

  section('Opruimen en verwijderen');
  await page.goto(`${WEB}/alerts`);
  await page.waitForSelector('[data-testid="alert-card"]');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Verwijderen' }).first().click();
  await page.waitForSelector('text=Nog geen prijsalerts');
  check('alert verwijderd', true);

  section('Taal en thema');
  await page.goto(`${WEB}/profiel`);
  await page.getByLabel('Taal').selectOption('fr');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Profil');
  check('interface schakelt naar Frans', (await page.locator('html').getAttribute('lang')) === 'fr-BE');
  await page.goto(WEB);
  check('Franse landingstekst', /moins chères/.test(await page.locator('h1').innerText()));
  await page.goto(`${WEB}/profiel`);
  await page.getByLabel('Langue').selectOption('nl');
  await page.getByLabel('Thema').selectOption('dark');
  check('donker thema actief', (await page.locator('html').getAttribute('data-theme')) === 'dark');
  await page.screenshot({ path: resolve(shots, '07-profiel-donker-mobiel.png'), fullPage: true });
  await page.getByLabel('Thema').selectOption('system');

  section('Desktop');
  const desktop = await browser.newContext({ ignoreHTTPSErrors: IGNORE_TLS, viewport: { width: 1280, height: 800 }, locale: 'nl-BE' });
  await desktop.addInitScript({ content: AXE_SOURCE });
  const wide = await desktop.newPage();
  wide.setDefaultTimeout(20_000);
  await wide.goto(`${WEB}/zoeken?q=olijfolie`);
  await wide.waitForSelector('[data-testid="product-card"]');
  check('desktop: koptekstnavigatie zichtbaar', await wide.locator('header nav').isVisible());
  check('desktop: tabbalk verborgen', !(await wide.locator('nav.fixed').isVisible()));
  check('desktop: filters als zijbalk zichtbaar', await wide.locator('aside#filters').isVisible());
  check('desktop: geen horizontale scroll', await wide.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await wide.screenshot({ path: resolve(shots, '08-zoeken-desktop.png'), fullPage: true });
  await wide.goto(`${WEB}/over-de-gegevens`);
  await wide.waitForSelector('text=Over de gegevens');
  check('gegevenspagina legt DEMO uit', /demogegevens/i.test(await wide.locator('main').innerText()));
  await a11y(wide, 'over-de-gegevens');
  await wide.screenshot({ path: resolve(shots, '09-gegevens-desktop.png'), fullPage: true });

  // Toetsenbord: van zoekresultaat naar productdetail zonder muis.
  await wide.goto(`${WEB}/zoeken?q=melk`);
  await wide.waitForSelector('[data-testid="product-card"] h2 a');
  await wide.locator('[data-testid="product-card"] h2 a').first().focus();
  await wide.keyboard.press('Enter');
  await wide.waitForURL(/\/producten\//);
  check('toetsenbord: Enter op resultaat opent productdetail', true);

  section('Overige routes: toegankelijkheid (axe) en inhoud');
  await wide.goto(`${WEB}/promoties`);
  await wide.waitForSelector('h1');
  await a11y(wide, 'promoties');
  await wide.goto(`${WEB}/privacy`);
  await wide.waitForSelector('h1');
  check('privacypagina gemarkeerd als voorstel voor juridische controle', /jurist/.test(await wide.locator('main').innerText()));
  check('privacypagina noemt rechten en bewaartermijnen', /Bewaartermijn/.test(await wide.locator('main').innerText()) && /Je rechten/.test(await wide.locator('main').innerText()));
  await a11y(wide, 'privacy');
  await wide.goto(`${WEB}/inloggen`);
  await wide.waitForSelector('h1');
  await a11y(wide, 'inloggen');
  await wide.goto(`${WEB}/registreren`);
  await wide.waitForSelector('h1');
  await a11y(wide, 'registreren');
  await wide.goto(`${WEB}/lijsten`);
  await wide.waitForSelector('h1');
  await a11y(wide, 'lijsten-gast');
  const missing = await wide.goto(`${WEB}/deze-pagina-bestaat-niet`);
  check('onbekende route → 404', missing.status() === 404, `status ${missing.status()}`);
  await wide.waitForSelector('text=Pagina niet gevonden');
  await a11y(wide, '404');
  await desktop.close();

  // Ingelogde routes die nog niet gescand zijn.
  await page.goto(`${WEB}/meldingen`);
  await page.waitForSelector('h1');
  await a11y(page, 'meldingen');
  await page.goto(`${WEB}/lijsten`);
  await page.waitForSelector('h1');
  await a11y(page, 'lijsten');
  await page.goto(`${WEB}/profiel`);
  await page.waitForSelector('h1');
  await a11y(page, 'profiel');

  section('Gegevensexport in de browser');
  await page.goto(`${WEB}/profiel`);
  await page.waitForSelector('text=Jouw gegevens');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download mijn gegevens' }).click()]);
  check('export start als download', /^superette-gegevens-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  const exportPath = await download.path();
  const exported = exportPath ? JSON.parse(readFileSync(exportPath, 'utf8')) : null;
  check('export bevat het eigen profiel en de lijst', exported?.profile?.email === alice && Array.isArray(exported?.shoppingLists) && exported.shoppingLists.length >= 1);

  section('Sessieverloop tijdens gebruik');
  await page.goto(`${WEB}/alerts`);
  await page.waitForSelector('h1');
  // De sessie wordt elders beëindigd (of verloopt): cookies weg, app weet het nog niet.
  await mobile.clearCookies();
  // Client-side navigatie (de app weet nog niet dat de sessie weg is): de
  // lijstenpagina vraagt de API, krijgt 401, kan niet verversen → verlopen.
  // (De meldingenpagina toont gegevens uit de provider en doet geen nieuw verzoek.)
  await page.locator('nav.fixed').getByRole('link', { name: /Mijn lijst/ }).click();
  await page.waitForURL(/\/inloggen\?.*reden=verlopen/);
  check('verlopen sessie → loginpagina met reden', page.url().includes('reden=verlopen'), page.url());
  check('melding over verlopen sessie zichtbaar', (await page.getByText(/sessie is verlopen/).count()) === 1);
  check('terugkeerpad bewaard', decodeURIComponent(page.url()).includes('terug=/lijsten'), page.url());
  await page.getByLabel('E-mailadres').fill(alice);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.waitForURL(/\/lijsten$/);
  check('na opnieuw inloggen terug op de bedoelde pagina', page.url().endsWith('/lijsten'));

  section('Account verwijderen');
  await page.goto(`${WEB}/profiel`);
  await page.waitForSelector('text=Jouw gegevens');
  await page.getByRole('button', { name: 'Account verwijderen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  check('dialoog legt uit wat verdwijnt en wat blijft', /Wat we verwijderen/.test(await dialog.innerText()) && /Wat we bewaren/.test(await dialog.innerText()));
  check('bevestigen geblokkeerd zonder wachtwoord en zin', await dialog.getByRole('button', { name: 'Definitief verwijderen' }).isDisabled());
  await dialog.getByLabel('Bevestig met je wachtwoord').fill('verkeerd-wachtwoord');
  await dialog.getByLabel(/Typ VERWIJDER MIJN ACCOUNT/).fill('VERWIJDER MIJN ACCOUNT');
  await dialog.getByRole('button', { name: 'Definitief verwijderen' }).click();
  await dialog.getByText('Wachtwoord is onjuist').waitFor();
  check('fout wachtwoord geweigerd', true);
  await dialog.getByLabel('Bevestig met je wachtwoord').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Definitief verwijderen' }).click();
  await dialog.getByText('Je account is verwijderd').waitFor();
  check('account verwijderd met herbevestiging', true);
  await page.screenshot({ path: resolve(shots, '10-account-verwijderd-mobiel.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Naar de startpagina' }).click();
  await page.waitForURL((url) => new URL(url).pathname === '/');
  await page.goto(`${WEB}/profiel`);
  await page.waitForSelector('h1');
  check('na verwijdering uitgelogd', (await page.getByRole('link', { name: 'Inloggen' }).count()) >= 1);
  await page.goto(`${WEB}/inloggen`);
  await page.getByLabel('E-mailadres').fill(alice);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await page.getByText('E-mailadres of wachtwoord is onjuist').waitFor();
  check('verwijderd account kan niet meer inloggen', true);

  await mobile.close();
  await browser.close();

  const seriousAxe = axeViolations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`\naxe-core: ${axeViolations.length} overtreding(en) in totaal, ${seriousAxe.length} serious/critical, over ${new Set(axeViolations.map((v) => v.page)).size} pagina('s)`);
  console.log(`\n${passed} geslaagd, ${failed} mislukt${skipped.length ? `, overgeslagen: ${skipped.join('; ')}` : ''}`);
  console.log(`Schermafbeeldingen in ${shots}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
