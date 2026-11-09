/**
 * Rooktest voor de supermarktvergelijker, tegen een draaiende API met
 * gevulde database (`npm run db:seed:compare`).
 *
 *   npm run dev:api                      # in één terminal
 *   npx tsx scripts/smoke-compare.ts     # in een andere
 *
 * Dekt de hoofdflows én de beveiligingsregels uit de opdracht: niet-ingelogd,
 * andermans alert lezen/wijzigen/verwijderen, ongeldige payloads, dubbele
 * alerts, en het interne sync-endpoint zonder sleutel.
 *
 * Let op: `/auth/register` staat op 5 per minuut per IP. Deze test maakt twee
 * accounts; draai hem niet vlak na de andere rooktests.
 */
const API = process.env['API_URL'] ?? 'http://localhost:4000/api/v1';

let passed = 0;
let failed = 0;
const skipped: string[] = [];
/**
 * In productie-modus triggeren alerts bewust nooit op DEMO-prijzen. Tegen zo'n
 * omgeving (staging met demobestanden) zet je EXPECT_DEMO_ALERTS=false; de
 * alertchecks die op demoprijzen rekenen worden dan met reden overgeslagen.
 */
const expectDemoAlerts = process.env['EXPECT_DEMO_ALERTS'] !== 'false';
function demoCheck(label: string, actual: unknown, expected: unknown): void {
  if (expectDemoAlerts) check(label, actual, expected);
  else skipped.push(label);
}

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}\n      verwacht: ${JSON.stringify(expected)}\n      kreeg:    ${JSON.stringify(actual)}`);
  }
}

function truthy(label: string, value: unknown): void {
  check(label, !!value, true);
}

async function call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function register(suffix: string): Promise<string> {
  const email = `smoke-compare-${Date.now()}-${suffix}@example.com`;
  const result = await call('POST', '/auth/register', {
    email,
    password: 'een-lang-genoeg-wachtwoord',
    fullName: `Smoke ${suffix}`,
    acceptsAccessLogging: true,
    acceptsCameraSurveillance: true,
  });
  if (result.status !== 201) throw new Error(`Registratie mislukt (${result.status}): ${JSON.stringify(result.body)}`);
  return result.body.accessToken as string;
}

async function main(): Promise<void> {
  console.log('\nSupermarkten en zoeken (publiek)');
  const chains = await call('GET', '/compare/chains');
  check('GET /compare/chains → 200', chains.status, 200);
  check('zeven ketens', chains.body.length, 7);
  truthy('ketens dragen bronvermelding', chains.body.every((c: any) => 'dataSourceKind' in c && 'lastImportedAt' in c));

  const search = await call('GET', '/compare/search?q=' + encodeURIComponent('Coca-Cola Zero 1,5 L'));
  check('GET /compare/search → 200', search.status, 200);
  truthy('zoekresultaten gevonden', search.body.total > 0);
  const first = search.body.items[0];
  truthy('resultaat heeft beste aanbod met eenheidsprijs', first?.bestOffer?.unitPrice?.cents > 0);
  truthy('elke prijs draagt herkomst en status', first?.offers.every((o: any) => o.provenance?.sourceKind && o.provenance?.status && typeof o.provenance?.observedAt === 'string'));
  truthy('dekking wordt gemeld', typeof search.body.coverage?.summary === 'string');
  check('demogegevens worden als zodanig gemarkeerd', search.body.containsDemoData, first?.offers[0]?.provenance?.isDemo ?? false);
  check('gesorteerd op eenheidsprijs', search.body.sort, 'UNIT_PRICE');

  const bySize = await call('GET', '/compare/search?q=melk&sort=PACKAGE_PRICE&onlyPromotions=false');
  truthy('zoeken op "melk" vindt huismerken en A-merken', bySize.body.items.length >= 2);

  const emptyQuery = await call('GET', '/compare/search?q=');
  check('lege zoekterm → 400', emptyQuery.status, 400);

  const detail = await call('GET', `/compare/products/${first.product.id}`);
  check('GET /compare/products/:id → 200', detail.status, 200);
  truthy('detail bevat prijzen per keten', detail.body.offers.length > 0);
  truthy('detail scheidt exacte matches van alternatieven', Array.isArray(detail.body.alternatives) && Array.isArray(detail.body.equivalents));
  truthy('detail bevat prijsgeschiedenis met disclaimer', typeof detail.body.history?.disclaimer === 'string');

  const missing = await call('GET', '/compare/products/clzzzzzzzzzzzzzzzzzzzzzz');
  check('onbekend product → 404', missing.status, 404);

  const promotions = await call('GET', '/compare/promotions');
  check('GET /compare/promotions → 200', promotions.status, 200);
  truthy('promoties gevonden', promotions.body.total > 0);

  console.log('\nZonder account');
  check('lijsten zonder token → 401', (await call('GET', '/compare/lists')).status, 401);
  check('alerts zonder token → 401', (await call('GET', '/compare/alerts')).status, 401);
  check('voorkeuren zonder token → 401', (await call('GET', '/compare/preferences')).status, 401);
  const internal = await call('POST', '/compare/internal/sync', {});
  truthy('interne sync zonder sleutel → 401 of 404', internal.status === 401 || internal.status === 404);
  check('interne sync met foute sleutel → 401/404', (await fetch(`${API}/compare/internal/sync`, { method: 'POST', headers: { 'x-job-key': 'fout' } })).status === 401 || internal.status === 404, true);

  console.log('\nAccounts');
  const alice = await register('alice');
  const bob = await register('bob');
  truthy('twee accounts aangemaakt', alice && bob);

  console.log('\nVoorkeuren');
  const prefs = await call('GET', '/compare/preferences', undefined, alice);
  check('GET /compare/preferences → 200', prefs.status, 200);
  check('standaard: alle ketens aan', prefs.body.enabledChainSlugs, []);
  const updatedPrefs = await call('PATCH', '/compare/preferences', { enabledChainSlugs: ['lidl', 'colruyt', 'delhaize'], loyaltyCardChainSlugs: ['delhaize'], postalCode: '2000' }, alice);
  check('PATCH voorkeuren → 200', updatedPrefs.status, 200);
  check('ketens bewaard', [...updatedPrefs.body.enabledChainSlugs].sort(), ['colruyt', 'delhaize', 'lidl']);
  check('klantenkaart bewaard', updatedPrefs.body.loyaltyCardChainSlugs, ['delhaize']);
  check('onbekende keten → 400', (await call('PATCH', '/compare/preferences', { enabledChainSlugs: ['aldi'] }, alice)).status, 400);
  check('ongeldige postcode → 400', (await call('PATCH', '/compare/preferences', { postalCode: '123' }, alice)).status, 400);

  console.log('\nBoodschappenlijst');
  const list = await call('POST', '/compare/lists', { name: 'Weekboodschappen' }, alice);
  check('POST /compare/lists → 201', list.status, 201);
  const listId = list.body.id as string;

  const milk = (await call('GET', '/compare/search?q=halfvolle%20melk')).body.items[0];
  const added = await call('POST', `/compare/lists/${listId}/items`, { catalogProductId: first.product.id, quantity: 2 }, alice);
  check('product toevoegen → 201', added.status, 201);
  await call('POST', `/compare/lists/${listId}/items`, { catalogProductId: milk.product.id, quantity: 3, allowStoreBrand: false }, alice);
  const freeText = await call('POST', `/compare/lists/${listId}/items`, { freeText: 'verjaardagskaarsjes' }, alice);
  check('vrije tekstregel → 201', freeText.status, 201);
  check('drie regels', freeText.body.items.length, 3);
  check('zonder product én zonder tekst → 400', (await call('POST', `/compare/lists/${listId}/items`, { quantity: 1 }, alice)).status, 400);

  const again = await call('POST', `/compare/lists/${listId}/items`, { catalogProductId: first.product.id, quantity: 1 }, alice);
  check('zelfde product nogmaals verhoogt het aantal', again.body.items.find((i: any) => i.catalogProductId === first.product.id)?.quantity, 3);

  const itemId = again.body.items[0].id as string;
  const checked = await call('PATCH', `/compare/lists/${listId}/items/${itemId}`, { checked: true, quantity: 2 }, alice);
  check('regel afvinken en aantal wijzigen → 200', checked.status, 200);
  check('regel afgevinkt', checked.body.items[0].checked, true);

  for (const mode of ['SINGLE_STORE', 'CHEAPEST_COMBINATION', 'BALANCED'] as const) {
    const compare = await call('POST', `/compare/lists/${listId}/compare`, { mode, maxStores: 2, minimumSavingCents: 100 }, alice);
    check(`vergelijken in modus ${mode} → 201`, compare.status, 201);
    truthy(`${mode}: per winkel een resultaat`, compare.body.perStore.length >= 3);
    truthy(`${mode}: samenvatting`, typeof compare.body.summary === 'string' && compare.body.summary.length > 0);
    truthy(`${mode}: vrije regels apart`, compare.body.freeTextLines.includes('verjaardagskaarsjes'));
    truthy(`${mode}: elke regel heeft een reden`, compare.body.perStore.every((s: any) => s.lines.every((l: any) => typeof l.reason === 'string')));
  }
  const balanced = await call('POST', `/compare/lists/${listId}/compare`, { mode: 'BALANCED', maxStores: 3, minimumSavingCents: 0 }, alice);
  truthy('beste enkele winkel bepaald', balanced.body.bestSingleStore?.storeChain?.slug);
  truthy('goedkoopste combinatie bepaald', balanced.body.cheapestCombination?.totalCents >= 0);
  truthy('gebalanceerde keuze legt uit', balanced.body.balanced?.explanation?.length > 0);

  check('Bob leest lijst van Alice → 404', (await call('GET', `/compare/lists/${listId}`, undefined, bob)).status, 404);
  check('Bob wijzigt lijst van Alice → 404', (await call('PATCH', `/compare/lists/${listId}`, { name: 'x' }, bob)).status, 404);
  check('Bob verwijdert lijst van Alice → 404', (await call('DELETE', `/compare/lists/${listId}`, undefined, bob)).status, 404);
  check('Bob voegt toe aan lijst van Alice → 404', (await call('POST', `/compare/lists/${listId}/items`, { freeText: 'x' }, bob)).status, 404);

  console.log('\nPrijsalerts');
  const lowest = first.bestOffer.priceCents as number;
  const preview = await call('POST', '/compare/alerts/preview', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: lowest - 10, chainSlugs: ['lidl', 'delhaize'] }, alice);
  check('preview → 201', preview.status, 201);
  demoCheck('preview toont huidige laagste prijs', preview.body.currentLowest?.offer?.priceCents > 0, true);
  truthy('preview bevat menselijke zin', /We laten je weten/.test(preview.body.sentence));
  check('preview: nog geen duplicaat', preview.body.duplicateOfAlertId, null);

  const alert = await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: lowest - 10, chainSlugs: ['lidl', 'delhaize'] }, alice);
  check('POST /compare/alerts → 201', alert.status, 201);
  const alertId = alert.body.id as string;
  check('alert actief', alert.body.status, 'ACTIVE');
  check('alert kent zijn ketens', [...alert.body.chains.map((c: any) => c.slug)].sort(), ['delhaize', 'lidl']);
  demoCheck('alert toont verschil tot doelprijs', typeof alert.body.differenceCents === 'number', true);

  const duplicate = await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: lowest - 5, chainSlugs: ['delhaize', 'lidl'] }, alice);
  check('dubbele alert → 409', duplicate.status, 409);
  check('dubbele alert verwijst naar bestaande', duplicate.body.existingAlertId, alertId);

  check('bedrag nul → 400', (await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: 0 }, alice)).status, 400);
  check('negatief bedrag → 400', (await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: -1 }, alice)).status, 400);
  check('float-bedrag → 400', (await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: 1.79 }, alice)).status, 400);
  check('product én categorie → 400', (await call('POST', '/compare/alerts', { catalogProductId: first.product.id, categoryId: 'x', comparisonType: 'PACKAGE_PRICE', targetPriceCents: 100 }, alice)).status, 400);
  check('kortingsalert zonder percentage → 400', (await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'DISCOUNT_PERCENTAGE' }, alice)).status, 400);
  check('onbekend product → 404', (await call('POST', '/compare/alerts', { catalogProductId: 'clzzzzzzzzzzzzzzzzzzzzzz', comparisonType: 'PACKAGE_PRICE', targetPriceCents: 100 }, alice)).status, 404);

  // "Al mijn supermarkten" (geen chainSlugs) moet óók als duplicaat herkend worden.
  const allChains = await call('POST', '/compare/alerts', { catalogProductId: milk.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: 50 }, alice);
  check('alert voor al mijn supermarkten → 201', allChains.status, 201);
  const allChainsPreview = await call('POST', '/compare/alerts/preview', { catalogProductId: milk.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: 60 }, alice);
  check('preview herkent duplicaat zonder ketens', allChainsPreview.body.duplicateOfAlertId, allChains.body.id);
  check('dubbele alert zonder ketens → 409', (await call('POST', '/compare/alerts', { catalogProductId: milk.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: 60 }, alice)).status, 409);
  check('DELETE alert zonder ketens → 204', (await call('DELETE', `/compare/alerts/${allChains.body.id}`, undefined, alice)).status, 204);

  const reached = await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'UNIT_PRICE', targetPriceCents: 99_999 }, alice);
  check('alert per eenheidsprijs → 201', reached.status, 201);
  demoCheck('ruim boven de laagste prijs → al bereikt', reached.body.derivedState, 'REACHED');

  const discount = await call('POST', '/compare/alerts', { catalogProductId: first.product.id, comparisonType: 'DISCOUNT_PERCENTAGE', minimumDiscountPercentage: 30, matchPreference: 'ALTERNATIVE' }, alice);
  check('kortingsalert → 201', discount.status, 201);

  const listed = await call('GET', '/compare/alerts?sort=NEWEST', undefined, alice);
  check('GET /compare/alerts → 200', listed.status, 200);
  check('drie alerts', listed.body.length, 3);
  const onlyReached = await call('GET', '/compare/alerts?state=REACHED', undefined, alice);
  truthy('filter op toestand werkt', onlyReached.body.every((a: any) => a.derivedState === 'REACHED'));

  const updated = await call('PATCH', `/compare/alerts/${alertId}`, { targetPriceCents: lowest + 1 }, alice);
  check('PATCH alert → 200', updated.status, 200);
  demoCheck('nieuwe grens boven laagste prijs → bereikt', updated.body.derivedState, 'REACHED');

  const paused = await call('POST', `/compare/alerts/${alertId}/pause`, undefined, alice);
  check('pauzeren → 201', paused.status, 201);
  check('status gepauzeerd', paused.body.derivedState, 'PAUSED');
  const resumed = await call('POST', `/compare/alerts/${alertId}/resume`, undefined, alice);
  check('hervatten → actief', resumed.body.status, 'ACTIVE');

  check('Bob leest alert van Alice → 404', (await call('GET', `/compare/alerts/${alertId}`, undefined, bob)).status, 404);
  check('Bob wijzigt alert van Alice → 404', (await call('PATCH', `/compare/alerts/${alertId}`, { targetPriceCents: 1 }, bob)).status, 404);
  check('Bob pauzeert alert van Alice → 404', (await call('POST', `/compare/alerts/${alertId}/pause`, undefined, bob)).status, 404);
  check('Bob verwijdert alert van Alice → 404', (await call('DELETE', `/compare/alerts/${alertId}`, undefined, bob)).status, 404);
  check('Bob ziet geen alerts', (await call('GET', '/compare/alerts', undefined, bob)).body.length, 0);

  const notifications = await call('GET', '/compare/notifications', undefined, alice);
  check('GET /compare/notifications → 200', notifications.status, 200);

  check('DELETE alert → 204', (await call('DELETE', `/compare/alerts/${alertId}`, undefined, alice)).status, 204);
  check('verwijderde alert → 404', (await call('GET', `/compare/alerts/${alertId}`, undefined, alice)).status, 404);

  check('ongeldig id-formaat → 400', (await call('GET', '/compare/alerts/niet-een-geldig-id!', undefined, alice)).status, 400);
  check('ongeldig lijst-id → 400', (await call('GET', '/compare/lists/x', undefined, alice)).status, 400);

  console.log('\nOpruimen');
  check('DELETE lijst → 204', (await call('DELETE', `/compare/lists/${listId}`, undefined, alice)).status, 204);

  console.log(`\n${passed} geslaagd, ${failed} mislukt${skipped.length ? `\nOvergeslagen (EXPECT_DEMO_ALERTS=false, productie-modus negeert DEMO-prijzen bij alerts): ${skipped.join('; ')}` : ''}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
