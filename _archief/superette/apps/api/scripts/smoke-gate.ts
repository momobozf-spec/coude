/**
 * Rooktest voor de volledige toegangsketen, tegen een draaiende API.
 *
 *   npm run db:seed && npm run start   # in één terminal
 *   npx tsx scripts/smoke-gate.ts      # in een andere
 *
 * Loopt niet alleen het gelukkige pad af, maar juist de scenario's waarop de
 * beveiliging staat of valt: replay, rotatie, vervalsing, ingetrokken
 * toestemming en een volle winkel.
 */
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:4000/api/v1';
const DEVICE_KEY = 'dev-scanner-antwerpen-zuid-vervang-in-productie';
const DEVICE_ID = 'scanner-voordeur-01';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  [32m✓[0m ${label}`);
  } else {
    failed++;
    console.log(`  [31m✗[0m ${label}\n      verwacht: ${JSON.stringify(expected)}\n      kreeg:    ${JSON.stringify(actual)}`);
  }
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const unlock = (qrPayload: string, storeId: string, deviceKey = DEVICE_KEY) =>
  post('/gate/unlock', { qrPayload, storeId, deviceId: DEVICE_ID }, { 'x-device-key': deviceKey });

async function main(): Promise<void> {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: 'antwerpen-zuid' } });
  const storeId = store.id;
  // Afbakening voor de audit-controles: alleen wat deze run zelf produceerde.
  const runStartedAt = new Date();

  // Verse gebruiker per run, zodat herhaald draaien niet op de e-mail-unique stukloopt.
  const email = `jamila+${Date.now()}@voorbeeld.be`;
  const password = 'een-heel-lang-wachtwoord';

  console.log('\n── Registratie & toestemming ──────────────────────────────────');
  const registered = await post('/auth/register', {
    email,
    password,
    fullName: 'Jamila Bouzouf',
    locale: 'nl',
    acceptsAccessLogging: true,
    acceptsCameraSurveillance: true,
    acceptsMarketing: false,
  });
  check('registratie slaagt', registered.status, 201);
  check('identiteit is NIET geverifieerd (geen itsme)', registered.body.user.identityVerified, false);

  const auth = { authorization: `Bearer ${registered.body.accessToken}` };
  const userId = registered.body.user.id as string;

  const weakPassword = await post('/auth/register', {
    email: `kort+${Date.now()}@voorbeeld.be`,
    password: 'kort',
    fullName: 'Test',
    acceptsAccessLogging: true,
    acceptsCameraSurveillance: true,
  });
  check('te kort wachtwoord wordt geweigerd', weakPassword.status, 400);

  const noConsent = await post('/auth/register', {
    email: `weiger+${Date.now()}@voorbeeld.be`,
    password: 'een-heel-lang-wachtwoord',
    fullName: 'Test',
    acceptsAccessLogging: false,
    acceptsCameraSurveillance: true,
  });
  check('registratie zonder AVG-toestemming wordt geweigerd', noConsent.status, 400);

  console.log('\n── Sleutel ophalen ────────────────────────────────────────────');
  const tokenA = await post('/access/token', { storeId }, auth);
  check('token uitgegeven', tokenA.status, 201);
  check('rotatie is korter dan de TTL', tokenA.body.rotateAfterSeconds < 60, true);

  console.log('\n── Apparaatauthenticatie ──────────────────────────────────────');
  const badDevice = await unlock(tokenA.body.qrPayload, storeId, 'ik-ben-geen-scanner');
  check('verkeerde device-sleutel → 401', badDevice.status, 401);

  const noDeviceKey = await post('/gate/unlock', { qrPayload: tokenA.body.qrPayload, storeId, deviceId: DEVICE_ID });
  check('ontbrekende device-sleutel → 401', noDeviceKey.status, 401);

  console.log('\n── De deur opent ──────────────────────────────────────────────');
  const granted = await unlock(tokenA.body.qrPayload, storeId);
  check('geldige sleutel → GRANTED', granted.body.result, 'GRANTED');
  check('winkelmandje aangemaakt', typeof granted.body.basketId, 'string');
  check('scherm toont geen interne reden', granted.body.displayMessage.nl, 'Welkom bij Jamal & Jamila');

  console.log('\n── Aanvalsscenario\'s ──────────────────────────────────────────');
  const replayed = await unlock(tokenA.body.qrPayload, storeId);
  check('dezelfde QR nogmaals scannen → DENIED_REPLAY', replayed.body.result, 'DENIED_REPLAY');
  check('weigering lekt de reden niet naar het scherm', replayed.body.displayMessage.nl, 'Toegang geweigerd. Open de app voor een nieuwe sleutel.');

  // Screenshot-scenario: klant haalt een verse QR op, iemand fotografeert de vorige.
  const tokenB = await post('/access/token', { storeId }, auth);
  const tokenC = await post('/access/token', { storeId }, auth);
  check('rotatievolgnummer loopt op', tokenC.body.seq > tokenB.body.seq, true);

  const supersededScan = await unlock(tokenB.body.qrPayload, storeId);
  check('achterhaalde QR (screenshot) → DENIED_SUPERSEDED', supersededScan.body.result, 'DENIED_SUPERSEDED');

  // Vervalsing: één teken in de handtekening omgooien.
  const parts = tokenC.body.qrPayload.split('.');
  const flipped = parts[2].endsWith('A') ? `${parts[2].slice(0, -1)}B` : `${parts[2].slice(0, -1)}A`;
  const forged = await unlock(`${parts[0]}.${parts[1]}.${flipped}`, storeId);
  check('geknoeide handtekening → DENIED_INVALID_SIGNATURE', forged.body.result, 'DENIED_INVALID_SIGNATURE');

  const nonsense = await unlock('dit-is-geen-jwt', storeId);
  check('willekeurige onzin → DENIED_INVALID_SIGNATURE', nonsense.body.result, 'DENIED_INVALID_SIGNATURE');

  console.log('\n── Volle winkel ───────────────────────────────────────────────');
  await prisma.store.update({ where: { id: storeId }, data: { maxOccupancy: 1, currentOccupancy: 1 } });
  const tokenD = await post('/access/token', { storeId }, auth);
  const full = await unlock(tokenD.body.qrPayload, storeId);
  check('bezetting bereikt → DENIED_STORE_FULL', full.body.result, 'DENIED_STORE_FULL');

  const tokenAfterFull = await prisma.accessToken.findFirstOrThrow({
    where: { userId, storeId },
    orderBy: { issuedAt: 'desc' },
  });
  // De transactie is teruggedraaid: de klant houdt zijn sleutel.
  check('sleutel is NIET verbruikt bij een volle winkel', tokenAfterFull.usedAt, null);

  await prisma.store.update({ where: { id: storeId }, data: { maxOccupancy: 6, currentOccupancy: 0 } });

  console.log('\n── Buiten openingsuren ────────────────────────────────────────');
  await prisma.store.update({ where: { id: storeId }, data: { opensAtMinute: 0, closesAtMinute: 1 } });
  const tokenE = await post('/access/token', { storeId }, auth);
  const closed = await unlock(tokenE.body.qrPayload, storeId);
  check('winkel gesloten → DENIED_STORE_CLOSED', closed.body.result, 'DENIED_STORE_CLOSED');
  await prisma.store.update({ where: { id: storeId }, data: { opensAtMinute: 360, closesAtMinute: 1380 } });

  console.log('\n── Toestemming intrekken ──────────────────────────────────────');
  // Eerst een geldige sleutel ophalen, dán pas intrekken. Zo staat de klant met
  // een technisch perfecte QR voor de deur — en moet de gate hem alsnog weigeren.
  const tokenF = await post('/access/token', { storeId }, auth);
  const revoked = await post('/consents', { type: 'CAMERA', granted: false }, auth);
  check('toestemming intrekken slaagt', revoked.status, 204);

  const afterRevoke = await unlock(tokenF.body.qrPayload, storeId);
  check('geldige QR na intrekken camera-toestemming → DENIED_CONSENT_MISSING', afterRevoke.body.result, 'DENIED_CONSENT_MISSING');

  const tokenRefused = await post('/access/token', { storeId }, auth);
  check('nieuwe sleutel aanvragen zonder toestemming → 403', tokenRefused.status, 403);

  // Toestemming is append-only: de historie moet beide beslissingen bevatten.
  const cameraHistory = await prisma.consent.findMany({ where: { userId, type: 'CAMERA' }, orderBy: { recordedAt: 'asc' } });
  check('toestemmingshistorie is bewaard (append-only)', cameraHistory.map((c) => c.granted), [true, false]);

  console.log('\n── Audit-trail ────────────────────────────────────────────────');

  // Pogingen mét een geldige handtekening zijn toe te schrijven aan een klant.
  const attributed = await prisma.accessLog.findMany({ where: { userId }, orderBy: { occurredAt: 'asc' } });
  check('elke toeschrijfbare poging is gelogd, geslaagd én geweigerd', attributed.map((l) => l.result), [
    'GRANTED',
    'DENIED_REPLAY',
    'DENIED_SUPERSEDED',
    'DENIED_STORE_FULL',
    'DENIED_STORE_CLOSED',
    'DENIED_CONSENT_MISSING',
  ]);

  // Pogingen met een ONGELDIGE handtekening zijn dat niet — en horen dat ook niet
  // te zijn. De `sub`-claim komt dan van de aanvaller. Wie die toch in de
  // audit-trail schrijft, laat een aanvaller kiezen wiens naam er bij een
  // inbraakpoging in het logboek komt te staan.
  const anonymous = await prisma.accessLog.findMany({
    where: { storeId, result: 'DENIED_INVALID_SIGNATURE', occurredAt: { gte: runStartedAt } },
  });
  check('vervalste pogingen zijn gelogd', anonymous.length, 2);
  check('vervalste pogingen zijn NIET aan een klant toegeschreven', anonymous.every((l) => l.userId === null), true);

  const logs = [...attributed, ...anonymous];
  check('elke logregel heeft een camerareferentie', logs.every((l) => typeof l.cameraRef === 'string' && l.cameraRef.length > 0), true);
  check('elke logregel kent het apparaat', logs.every((l) => l.deviceId === DEVICE_ID), true);

  console.log(`\n${failed === 0 ? '[32m' : '[31m'}${passed} geslaagd, ${failed} mislukt[0m\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
