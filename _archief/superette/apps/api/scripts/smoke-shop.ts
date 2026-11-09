/**
 * Rooktest voor de winkelketen: scannen → mandje → afrekenen → kasbon.
 *
 *   npm run start                       # in één terminal
 *   npx tsx scripts/smoke-shop.ts       # in een andere
 *
 * Draait tegen de `StubPaymentGateway` zolang `MOLLIE_API_KEY` leeg is. Alles
 * ná de betaling — order, voorraad, gapenloos factuurnummer, BTW-uitsplitsing —
 * is daarmee echt getest; alleen het HTTP-gesprek met Mollie niet.
 */
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api/v1';
const DEVICE_KEY = 'dev-scanner-antwerpen-zuid-vervang-in-productie';
const DEVICE_ID = 'scanner-voordeur-01';

const SERUM = '5412345000013'; // €34,50 @ 21%
const KAARS = '5412345000044'; // €12,50 @ 21%
const DADELS = '5412345000075'; // €7,95 @ 6%

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  [32m✓[0m ${label}`);
  } else {
    failed++;
    console.log(`  [31m✗[0m ${label}\n      verwacht: ${JSON.stringify(expected)}\n      kreeg:    ${JSON.stringify(actual)}`);
  }
}

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main(): Promise<void> {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: 'antwerpen-zuid' } });
  const storeId = store.id;
  await prisma.store.update({ where: { id: storeId }, data: { currentOccupancy: 0 } });

  const email = `shopper+${Date.now()}@voorbeeld.be`;
  const registered = await call('POST', '/auth/register', {
    email,
    password: 'een-heel-lang-wachtwoord',
    fullName: 'Jamal Bouzouf',
    locale: 'nl',
    acceptsAccessLogging: true,
    acceptsCameraSurveillance: true,
  });
  const auth = { authorization: `Bearer ${registered.body.accessToken}` };
  const userId = registered.body.user.id as string;

  /** Loopt door de deur en geeft het verse winkelmandje terug. */
  async function enterStore(): Promise<string> {
    const token = await call('POST', '/access/token', { storeId }, auth);
    const opened = await call(
      'POST',
      '/gate/unlock',
      { qrPayload: token.body.qrPayload, storeId, deviceId: DEVICE_ID },
      { 'x-device-key': DEVICE_KEY },
    );
    if (opened.body.result !== 'GRANTED') throw new Error(`Deur ging niet open: ${opened.body.result}`);
    return opened.body.basketId as string;
  }

  console.log('\n── Scannen ────────────────────────────────────────────────────');
  const basketId = await enterStore();

  const badChecksum = await call('POST', '/baskets/scan', { basketId, barcode: '5412345000018' }, auth);
  check('barcode met fout controlecijfer → 400', badChecksum.status, 400);

  const unknownProduct = await call('POST', '/baskets/scan', { basketId, barcode: '5449000000996' }, auth);
  check('geldige EAN die niet in de catalogus staat → 404', unknownProduct.status, 404);

  const tooShort = await call('POST', '/baskets/scan', { basketId, barcode: '12345' }, auth);
  check('barcode van verkeerde lengte → 400', tooShort.status, 400);

  await call('POST', '/baskets/scan', { basketId, barcode: SERUM }, auth);
  await call('POST', '/baskets/scan', { basketId, barcode: KAARS, quantity: 3 }, auth);
  const scanned = await call('POST', '/baskets/scan', { basketId, barcode: DADELS, quantity: 2 }, auth);

  check('drie productregels in het mandje', scanned.body.items.length, 3);

  console.log('\n── Prijssnapshot ──────────────────────────────────────────────');
  // De uitbater verhoogt de prijs terwijl de klant in de winkel staat.
  await prisma.product.update({ where: { barcode: SERUM }, data: { priceInclCents: 9999 } });
  const rescanned = await call('POST', '/baskets/scan', { basketId, barcode: SERUM }, auth);

  const serumLine = rescanned.body.items.find((i: { barcode: string }) => i.barcode === SERUM);
  check('tweede scan verhoogt het aantal, geen tweede regel', serumLine.quantity, 2);
  check('prijs blijft die van de eerste scan (schapprijs)', serumLine.unitPriceInclCents, 3450);

  // Terugzetten voor volgende runs.
  await prisma.product.update({ where: { barcode: SERUM }, data: { priceInclCents: 3450 } });

  console.log('\n── BTW-uitsplitsing ───────────────────────────────────────────');
  const basket = (await call('GET', `/baskets/${basketId}`, undefined, auth)).body;

  // 2 × €34,50 + 3 × €12,50 = €69,00 + €37,50 = €106,50 @ 21%
  //                            2 × €7,95  = €15,90 @ 6%
  check('totaal inclusief', basket.totalInclCents, 10650 + 1590);
  check('twee BTW-tarieven op de bon', basket.vatBuckets.map((b: { rate: number }) => b.rate), [6, 21]);

  const btw6 = basket.vatBuckets.find((b: { rate: number }) => b.rate === 6);
  const btw21 = basket.vatBuckets.find((b: { rate: number }) => b.rate === 21);
  check('BTW 6% over €15,90', btw6.vatCents, 90); // 1590 × 6/106 = 90,00 exact
  check('BTW 21% over €106,50', btw21.vatCents, 1848); // 10650 × 21/121 = 1848,35 → 1848
  check('excl + btw === incl', basket.totalExclCents + basket.totalVatCents, basket.totalInclCents);

  console.log('\n── Voorraad ───────────────────────────────────────────────────');
  const tooMany = await call('PATCH', `/baskets/${basketId}/items`, { productId: serumLine.productId, quantity: 99 }, auth);
  check('meer scannen dan er ligt → 400', tooMany.status, 400);

  console.log('\n── Afrekenen ──────────────────────────────────────────────────');
  const checkout = await call('POST', '/checkout', { basketId, method: 'BANCONTACT' }, auth);
  check('checkout geeft een betaal-URL', typeof checkout.body.redirectUrl, 'string');
  check('ordernummer heeft het JJ-formaat', /^JJ-\d{8}-[0-9A-F]{8}$/.test(checkout.body.orderNumber), true);

  const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } });
  check('order wacht op betaling', orderBefore.status, 'AWAITING_PAYMENT');
  check('order bewaart de volledige BTW-uitsplitsing', (orderBefore.vatBuckets as unknown[]).length, 2);

  const emptyBasketId = await (async () => {
    // Een leeg mandje mag niet afrekenen. Nieuwe klant, want de vorige zijn mand
    // hangt aan een order.
    const other = await call('POST', '/auth/register', {
      email: `leeg+${Date.now()}@voorbeeld.be`,
      password: 'een-heel-lang-wachtwoord',
      fullName: 'Lege Mand',
      acceptsAccessLogging: true,
      acceptsCameraSurveillance: true,
    });
    const otherAuth = { authorization: `Bearer ${other.body.accessToken}` };
    const token = await call('POST', '/access/token', { storeId }, otherAuth);
    const opened = await call(
      'POST',
      '/gate/unlock',
      { qrPayload: token.body.qrPayload, storeId, deviceId: DEVICE_ID },
      { 'x-device-key': DEVICE_KEY },
    );
    const empty = await call('POST', '/checkout', { basketId: opened.body.basketId, method: 'PAYCONIQ' }, otherAuth);
    return empty.status;
  })();
  check('leeg mandje afrekenen → 400', emptyBasketId, 400);

  console.log('\n── Betaling & kasbon ──────────────────────────────────────────');
  const paymentId = orderBefore.providerPaymentId!;
  const stockBefore = await prisma.inventory.findUniqueOrThrow({
    where: { storeId_productId: { storeId, productId: serumLine.productId } },
  });

  const webhook = await call('POST', '/webhooks/mollie', { id: paymentId });
  check('webhook → 204', webhook.status, 204);

  const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } });
  check('order is betaald', orderAfter.status, 'PAID');

  const basketAfter = await prisma.basket.findUniqueOrThrow({ where: { id: basketId } });
  check('mandje is afgesloten', basketAfter.status, 'PAID');

  const stockAfter = await prisma.inventory.findUniqueOrThrow({
    where: { storeId_productId: { storeId, productId: serumLine.productId } },
  });
  check('voorraad is afgeboekt met 2', stockBefore.quantity - stockAfter.quantity, 2);

  const receipts = await call('GET', '/receipts', undefined, auth);
  check('kasbon staat in de historiek', receipts.body.length, 1);

  const receipt = receipts.body[0];
  check('factuurnummer heeft het wettelijke formaat', /^JJ\/\d{4}\/\d{6}$/.test(receipt.invoiceNumber), true);
  check('kasbon vermeldt het BTW-nummer van de uitbater', receipt.storeVatNumber, 'BE 0123.456.789');
  check('kasbontotaal komt overeen met het mandje', receipt.totalInclCents, basket.totalInclCents);
  check('kasbon splitst beide BTW-tarieven uit', receipt.vatBuckets.length, 2);
  check('kasbon vermeldt de betaalmethode', receipt.paymentMethod, 'BANCONTACT');

  console.log('\n── Idempotentie ───────────────────────────────────────────────');
  // Mollie herhaalt de webhook bij elke twijfel. Twee kasbonnen, twee
  // voorraadafboekingen of twee factuurnummers zou een ramp zijn.
  await call('POST', '/webhooks/mollie', { id: paymentId });
  await call('POST', '/webhooks/mollie', { id: paymentId });

  const receiptsAgain = await call('GET', '/receipts', undefined, auth);
  check('herhaalde webhook maakt geen tweede kasbon', receiptsAgain.body.length, 1);
  check('factuurnummer is niet veranderd', receiptsAgain.body[0].invoiceNumber, receipt.invoiceNumber);

  const stockFinal = await prisma.inventory.findUniqueOrThrow({
    where: { storeId_productId: { storeId, productId: serumLine.productId } },
  });
  check('voorraad is niet nogmaals afgeboekt', stockFinal.quantity, stockAfter.quantity);

  console.log('\n── Gapenloze factuurnummering ─────────────────────────────────');
  const secondBasket = await enterStore();
  await call('POST', '/baskets/scan', { basketId: secondBasket, barcode: DADELS }, auth);
  const secondCheckout = await call('POST', '/checkout', { basketId: secondBasket, method: 'PAYCONIQ' }, auth);
  const secondOrder = await prisma.order.findUniqueOrThrow({ where: { id: secondCheckout.body.orderId } });
  await call('POST', '/webhooks/mollie', { id: secondOrder.providerPaymentId! });

  const secondReceipt = await prisma.receipt.findUniqueOrThrow({ where: { orderId: secondOrder.id } });

  const firstSequence = Number(receipt.invoiceNumber.split('/')[2]);
  const secondSequence = Number(secondReceipt.invoiceNumber.split('/')[2]);
  check('tweede factuurnummer volgt direct op het eerste', secondSequence - firstSequence, 1);

  const year = new Date().getFullYear();
  const counter = await prisma.invoiceCounter.findUniqueOrThrow({ where: { storeId_year: { storeId, year } } });
  check('de teller staat op het laatst uitgegeven nummer', counter.lastNumber, secondSequence);

  console.log('\n── Mislukte betaling verbrandt geen factuurnummer ──────────────');
  const thirdBasket = await enterStore();
  await call('POST', '/baskets/scan', { basketId: thirdBasket, barcode: KAARS }, auth);
  const thirdCheckout = await call('POST', '/checkout', { basketId: thirdBasket, method: 'CARD' }, auth);
  // Een payment-id die de gateway niet kent → status FAILED.
  await call('POST', '/webhooks/mollie', { id: 'stub_bestaatniet00' });
  const thirdOrder = await prisma.order.findUniqueOrThrow({ where: { id: thirdCheckout.body.orderId } });
  check('onbekende betaling laat de order met rust', thirdOrder.status, 'AWAITING_PAYMENT');

  const counterAfter = await prisma.invoiceCounter.findUniqueOrThrow({ where: { storeId_year: { storeId, year } } });
  check('geen factuurnummer verbruikt', counterAfter.lastNumber, counter.lastNumber);

  const userOrders = await prisma.order.count({ where: { userId } });
  check('drie orders voor deze klant', userOrders, 3);

  console.log(`\n${failed === 0 ? '[32m' : '[31m'}${passed} geslaagd, ${failed} mislukt[0m\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
