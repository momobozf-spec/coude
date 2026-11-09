/**
 * Mijlpaal-test: klant boekt → vervoerder aanvaardt → chauffeur voert uit →
 * commissie correct verwerkt → vervoerder uitbetaald. Draait tegen echte Postgres.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DbNotifier, FakePaymentProvider, StraightLineRouting } from './adapters.js';
import { buildApp } from './app.js';
import type { Ctx } from './context.js';
import { createPool, many, one, type Db } from './db.js';
import { migrate } from './migrate.js';
import { createUser } from './services/accounts.js';

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://ritna@localhost:5433/ritna_test?host=/tmp';
const SECRET = 'test-secret-test-secret-test-secret-123';

let db: Db;
let app: FastifyInstance;
let payments: FakePaymentProvider;
let clock = new Date('2026-11-02T08:00:00Z');
const ctxNow = () => clock;
const advance = (min: number) => (clock = new Date(clock.getTime() + min * 60_000));

// Brussel-Centraal → Brussels Airport
const CENTRAAL = { address: 'Carrefour de l’Europe 2, 1000 Brussel', lat: 50.8455, lng: 4.3571 };
const AIRPORT = { address: 'Brussels Airport, 1930 Zaventem', lat: 50.9014, lng: 4.4844 };
const BRUSSEL = { lat: 50.8467, lng: 4.3525, radiusMeters: 25_000 };

function kbo(base8: number): string {
  const b = String(base8).padStart(8, '0');
  const check = 97 - (Number(b) % 97);
  return b + String(check).padStart(2, '0');
}

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token?: string, body?: unknown) {
  const res = await app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  const json = res.body ? JSON.parse(res.body) : null;
  return { status: res.statusCode, body: json };
}

async function loginAs(email: string, password: string): Promise<string> {
  const r = await call('POST', '/v1/auth/login', undefined, { email, password });
  expect(r.status).toBe(200);
  return r.body.token;
}

let adminToken: string;
let seq = 1;

interface OperatorSetup {
  operatorId: string;
  opToken: string;
  driverId: string;
  driverToken: string;
  vehicleId: string;
}

async function setupOperator(name: string, tariff: Record<string, number>, opts: { driverCanAccept?: boolean } = {}): Promise<OperatorSetup> {
  const n = seq++;
  const signup = await call('POST', '/v1/operators/signup', undefined, {
    legalName: `${name} BV`,
    tradeName: name,
    enterpriseNumber: kbo(4_000_000 + n * 13),
    exploitationLicenseRef: `LIC-${n}`,
    phone: '+3220000000',
    email: `ops${n}@example.be`,
    serviceArea: BRUSSEL,
    admin: { fullName: `Admin ${name}`, email: `admin${n}@example.be`, password: 'wachtwoord-123' },
  });
  expect(signup.status).toBe(201);
  const operatorId = signup.body.operatorId as string;
  const opToken = await loginAs(`admin${n}@example.be`, 'wachtwoord-123');

  expect((await call('PUT', '/v1/operator/tariffs/standard', opToken, tariff)).status).toBe(200);
  const v = await call('POST', '/v1/operator/vehicles', opToken, { plate: `1-ABC-${100 + n}`, make: 'Toyota', model: 'Corolla', category: 'standard', seats: 4, luggageCapacity: 3 });
  expect(v.status).toBe(201);
  const d = await call('POST', '/v1/operator/drivers', opToken, {
    fullName: `Karim Chauffeur${n}`,
    email: `driver${n}@example.be`,
    password: 'wachtwoord-123',
    phone: '+32470000000',
    canAcceptRequests: opts.driverCanAccept ?? false,
  });
  expect(d.status).toBe(201);

  const docs = [
    { ownerType: 'operator', ownerId: operatorId, docType: 'exploitation_license', expiresOn: '2027-12-31' },
    { ownerType: 'operator', ownerId: operatorId, docType: 'insurance', expiresOn: '2027-06-30' },
    { ownerType: 'driver', ownerId: d.body.id, docType: 'driver_permit', expiresOn: '2027-03-31' },
  ];
  for (const doc of docs) {
    const r = await call('POST', '/v1/operator/documents', opToken, doc);
    expect(r.status).toBe(201);
    expect((await call('POST', `/v1/admin/documents/${r.body.id}/review`, adminToken, { decision: 'approved' })).status).toBe(200);
  }
  expect((await call('POST', `/v1/admin/operators/${operatorId}/activate`, adminToken)).status).toBe(200);
  expect((await call('POST', `/v1/admin/drivers/${d.body.id}/activate`, adminToken)).status).toBe(200);
  expect((await call('PATCH', `/v1/admin/operators/${operatorId}/commercial`, adminToken, { payoutAccountRef: `acct_${n}` })).status).toBe(200);

  const driverToken = await loginAs(`driver${n}@example.be`, 'wachtwoord-123');
  expect((await call('PATCH', '/v1/driver/me', driverToken, { isAvailable: true, currentVehicleId: v.body.id })).status).toBe(200);
  return { operatorId, opToken, driverId: d.body.id, driverToken, vehicleId: v.body.id };
}

const TARIFF_A = { baseFare: 250, perKm: 200, perMinute: 30, minimumFare: 1200 };
const TARIFF_B = { baseFare: 300, perKm: 220, perMinute: 35, minimumFare: 1500 };

let A: OperatorSetup;
let B: OperatorSetup;
let customerToken: string;
let otherCustomerToken: string;

const trip = () => ({
  pickup: CENTRAAL,
  dropoff: AIRPORT,
  pickupAt: new Date(clock.getTime() + 24 * 3600_000).toISOString(),
  category: 'standard',
  passengers: 2,
  luggageItems: 2,
});

beforeAll(async () => {
  db = createPool(DATABASE_URL);
  await db.query('drop schema public cascade; create schema public;');
  await migrate(db);
  payments = new FakePaymentProvider();
  const ctx: Ctx = { db, payments, routing: new StraightLineRouting(), notifier: new DbNotifier(), now: ctxNow, commissionVatBps: 2100 };
  app = await buildApp(ctx, { jwtSecret: SECRET });
  await createUser(db, { role: 'platform_admin', email: 'mohamed@ritna.test', password: 'wachtwoord-123', fullName: 'Mohamed Admin' });
  adminToken = await loginAs('mohamed@ritna.test', 'wachtwoord-123');

  A = await setupOperator('Taxi Atlas', TARIFF_A);
  B = await setupOperator('Taxi Brabo', TARIFF_B, { driverCanAccept: true });

  const c1 = await call('POST', '/v1/auth/register', undefined, { email: 'klant@example.be', password: 'wachtwoord-123', fullName: 'Sara Klant', locale: 'nl' });
  expect(c1.status).toBe(201);
  customerToken = c1.body.token;
  const c2 = await call('POST', '/v1/auth/register', undefined, { email: 'andere@example.be', password: 'wachtwoord-123', fullName: 'Andere Klant' });
  otherCustomerToken = c2.body.token;
});

afterAll(async () => {
  await app?.close();
  await db?.end();
});

beforeEach(() => {
  clock = new Date('2026-11-02T08:00:00Z');
});

async function search() {
  const r = await call('POST', '/v1/search', customerToken, trip());
  expect(r.status).toBe(200);
  return r.body as { options: { operatorId: string; priceCents: number }[] };
}

async function bookChosen(op: OperatorSetup, key: string) {
  const s = await search();
  const opt = s.options.find((o) => o.operatorId === op.operatorId)!;
  const r = await call('POST', '/v1/rides', customerToken, {
    ...trip(),
    mode: 'chosen_operator',
    operatorId: op.operatorId,
    acceptedPriceCents: opt.priceCents,
    idempotencyKey: key,
  });
  expect(r.status).toBe(201);
  return { ride: r.body, price: opt.priceCents };
}

describe('mijlpaal: volledige testboeking', () => {
  it('klant boekt → vervoerder aanvaardt → chauffeur rijdt → commissie → uitbetaling', async () => {
    // Zoeken: beide vervoerders, goedkoopste eerst
    const s = await search();
    expect(s.options.map((o) => o.operatorId)).toEqual([A.operatorId, B.operatorId]);

    // Boeken bij Atlas
    const { ride, price } = await bookChosen(A, 'milestone-0001');
    expect(ride.status).toBe('requested');
    expect(ride.confirmed).toBe(false); // nog niet als geboekt tonen
    expect(ride.priceCents).toBeNull();

    // Vervoerder ziet de aanvraag en kreeg een notificatie
    const dash = await call('GET', `/v1/operator/rides?from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z`, A.opToken);
    expect(dash.body.pendingRequests.map((p: { ride_id: string }) => p.ride_id)).toContain(ride.id);
    const notes = await call('GET', '/v1/notifications', A.opToken);
    expect(notes.body[0].template).toBe('ride_request');

    // Aanvaarden + chauffeur toewijzen in één stap
    const acc = await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, { driverId: A.driverId });
    expect(acc.status).toBe(200);
    expect(acc.body.status).toBe('driver_assigned');
    expect(acc.body.confirmed).toBe(true);
    expect(acc.body.priceCents).toBe(price);
    expect(acc.body.driver.first_name).toBe('Karim');
    expect(acc.body.vehicle.plate).toMatch(/^1-ABC-/);

    // Chauffeur voert uit
    for (const st of ['driver_en_route', 'driver_arrived', 'in_progress', 'completed']) {
      const r = await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: st });
      expect(r.status, st).toBe(200);
      expect(r.body.status).toBe(st);
    }

    // Klant ziet voltooide rit met tijdlijn
    const view = await call('GET', `/v1/rides/${ride.id}`, customerToken);
    expect(view.body.status).toBe('completed');
    expect(view.body.timeline.map((e: { to_status: string }) => e.to_status)).toEqual([
      'requested',
      'accepted',
      'driver_assigned',
      'driver_en_route',
      'driver_arrived',
      'in_progress',
      'completed',
    ]);

    // Grootboek klopt: 12% commissie, 21% btw op commissie, rest naar vervoerder
    const detail = await call('GET', `/v1/admin/rides/${ride.id}`, adminToken);
    const L = Object.fromEntries(detail.body.ledger.map((e: { entry_type: string; amount_cents: number }) => [e.entry_type, e.amount_cents]));
    const commission = Math.round((price * 1200) / 10_000);
    const vat = Math.round((commission * 2100) / 10_000);
    expect(L).toEqual({
      customer_charge: price,
      platform_commission: commission,
      commission_vat: vat,
      operator_payable: price - commission - vat,
    });
    expect(detail.body.payment.status).toBe('captured');
    expect(detail.body.payment.captured_cents).toBe(price);

    // Review
    expect((await call('POST', `/v1/rides/${ride.id}/review`, customerToken, { rating: 5, comment: 'Stipt en vriendelijk' })).status).toBe(201);
    expect((await call('POST', `/v1/rides/${ride.id}/review`, customerToken, { rating: 4 })).status).toBe(409);
    const pub = await call('GET', '/v1/operators/taxi-atlas');
    expect(pub.body.rating.count).toBe(1);

    // Uitbetaling
    const earningsBefore = await call('GET', `/v1/operator/earnings?from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z`, A.opToken);
    expect(earningsBefore.body.unpaidBalance).toBe(price - commission - vat);
    const payout = await call('POST', '/v1/admin/payouts/run', adminToken);
    expect(payout.body).toContainEqual({ operatorId: A.operatorId, amountCents: price - commission - vat, status: 'paid' });
    const earningsAfter = await call('GET', `/v1/operator/earnings?from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z`, A.opToken);
    expect(earningsAfter.body.unpaidBalance).toBe(0);
    expect(earningsAfter.body.payouts[0].status).toBe('paid');

    // Opnieuw uitbetalen = niets dubbel
    const again = await call('POST', '/v1/admin/payouts/run', adminToken);
    expect(again.body.find((p: { operatorId: string }) => p.operatorId === A.operatorId)).toBeUndefined();
  });
});

describe('boekingsregels', () => {
  it('weigert boeking bij gewijzigde prijs', async () => {
    const r = await call('POST', '/v1/rides', customerToken, { ...trip(), mode: 'chosen_operator', operatorId: A.operatorId, acceptedPriceCents: 1, idempotencyKey: 'price-0001' });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('price_changed');
  });

  it('idempotent: dubbele klik maakt geen tweede rit', async () => {
    const one1 = await bookChosen(A, 'idem-00001');
    const s = await search();
    const again = await call('POST', '/v1/rides', customerToken, {
      ...trip(),
      mode: 'chosen_operator',
      operatorId: A.operatorId,
      acceptedPriceCents: s.options[0]!.priceCents,
      idempotencyKey: 'idem-00001',
    });
    expect(again.body.id).toBe(one1.ride.id);
  });

  it('mislukte betaling = geen rit', async () => {
    const before = (await many(db, 'select id from rides')).length;
    payments.failNextAuthorize = true;
    const s = await search();
    const r = await call('POST', '/v1/rides', customerToken, { ...trip(), mode: 'chosen_operator', operatorId: A.operatorId, acceptedPriceCents: s.options[0]!.priceCents, idempotencyKey: 'payfail-01' });
    expect(r.status).toBe(402);
    expect((await many(db, 'select id from rides')).length).toBe(before);
  });

  it('ophaaltijd in het verleden geweigerd', async () => {
    const r = await call('POST', '/v1/search', customerToken, { ...trip(), pickupAt: '2026-11-01T08:00:00Z' });
    expect(r.status).toBe(400);
  });

  it('vervoerder buiten dienstgebied verschijnt niet', async () => {
    const r = await call('POST', '/v1/search', customerToken, { ...trip(), pickup: { address: 'Groenplaats, Antwerpen', lat: 51.2194, lng: 4.4025 } });
    expect(r.body.options).toEqual([]);
  });
});

describe('weigeren en verlopen (gekozen vervoerder)', () => {
  it('weigering → klant krijgt geen boeking, betaling vrijgegeven', async () => {
    const { ride } = await bookChosen(A, 'decline-001');
    const r = await call('POST', `/v1/operator/rides/${ride.id}/decline`, A.opToken, { reason: 'Volgeboekt' });
    expect(r.body.status).toBe('declined');
    const p = await one<{ status: string }>(db, 'select status from payments where ride_id = $1', [ride.id]);
    expect(p.status).toBe('voided');
    // Niet stilzwijgend naar andere vervoerder
    const offers = await many(db, 'select * from ride_offers where ride_id = $1', [ride.id]);
    expect(offers).toHaveLength(1);
  });

  it('geen antwoord → verlopen na timeout', async () => {
    const { ride } = await bookChosen(A, 'expire-0001');
    advance(5);
    await call('POST', '/v1/admin/tick', adminToken);
    expect((await call('GET', `/v1/rides/${ride.id}`, customerToken)).body.status).toBe('requested');
    advance(6); // standaard timeout 10 min
    // ≥1: openstaande aanvragen uit eerdere tests verlopen in dezelfde run mee
    expect((await call('POST', '/v1/admin/tick', adminToken)).body.expiredOffersHandled).toBeGreaterThanOrEqual(1);
    const v = await call('GET', `/v1/rides/${ride.id}`, customerToken);
    expect(v.body.status).toBe('expired');
    // Te laat aanvaarden kan niet meer
    expect((await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, {})).status).toBe(404);
  });
});

describe('open aanvraag', () => {
  it('eerste vervoerder weigert → tweede krijgt aanbod en aanvaardt tegen eigen prijs', async () => {
    const s = await search();
    const max = Math.max(...s.options.map((o) => o.priceCents));
    const r = await call('POST', '/v1/rides', customerToken, { ...trip(), mode: 'open_dispatch', acceptedPriceCents: max, idempotencyKey: 'open-00001' });
    expect(r.status).toBe(201);
    const id = r.body.id;

    // B ziet nog niets: A is eerst (goedkoopst)
    expect((await call('POST', `/v1/operator/rides/${id}/accept`, B.opToken, {})).status).toBe(404);
    await call('POST', `/v1/operator/rides/${id}/decline`, A.opToken, {});

    // Chauffeur van B mag namens B aanvaarden → wordt meteen toegewezen
    const req = await call('GET', '/v1/driver/requests', B.driverToken);
    expect(req.body.map((x: { ride_id: string }) => x.ride_id)).toContain(id);
    const acc = await call('POST', `/v1/operator/rides/${id}/accept`, B.driverToken, {});
    expect(acc.status).toBe(200);
    expect(acc.body.status).toBe('driver_assigned');
    const priceB = s.options.find((o) => o.operatorId === B.operatorId)!.priceCents;
    expect(acc.body.priceCents).toBe(priceB);
    expect(acc.body.operator.trade_name).toBe('Taxi Brabo');
  });

  it('niemand aanvaardt → onvervuld, betaling vrijgegeven', async () => {
    const s = await search();
    const max = Math.max(...s.options.map((o) => o.priceCents));
    const r = await call('POST', '/v1/rides', customerToken, { ...trip(), mode: 'open_dispatch', acceptedPriceCents: max, idempotencyKey: 'open-00002' });
    const id = r.body.id;
    await call('POST', `/v1/operator/rides/${id}/decline`, A.opToken, {});
    advance(11);
    await call('POST', '/v1/admin/tick', adminToken);
    const v = await call('GET', `/v1/rides/${id}`, customerToken);
    expect(v.body.status).toBe('unfulfilled');
    expect((await one<{ status: string }>(db, 'select status from payments where ride_id = $1', [id])).status).toBe('voided');
  });

  it('chauffeur zonder aanvaardrecht kan niet aanvaarden', async () => {
    const { ride } = await bookChosen(A, 'noright-001');
    const r = await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.driverToken, {});
    expect(r.status).toBe(403);
  });
});

describe('annuleren en no-show', () => {
  it('gratis annuleren ruim op voorhand', async () => {
    const { ride } = await bookChosen(A, 'cancel-free1');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, {});
    const r = await call('POST', `/v1/rides/${ride.id}/cancel`, customerToken);
    expect(r.body.outcome).toMatchObject({ fee: 0, reason: 'free_window' });
    expect((await one<{ status: string }>(db, 'select status from payments where ride_id = $1', [ride.id])).status).toBe('voided');
  });

  it('late annulering → 50% aangerekend en geboekt', async () => {
    const { ride, price } = await bookChosen(A, 'cancel-late1');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, {});
    advance(24 * 60 - 30); // 30 min voor ophaling
    const r = await call('POST', `/v1/rides/${ride.id}/cancel`, customerToken);
    const fee = Math.round(price / 2);
    expect(r.body.outcome).toMatchObject({ fee, reason: 'late_cancel' });
    const charge = await one<{ amount_cents: number }>(db, `select amount_cents from ledger_entries where ride_id = $1 and entry_type = 'customer_charge'`, [ride.id]);
    expect(charge.amount_cents).toBe(fee);
  });

  it('no-show pas na wachttijd', async () => {
    const { ride, price } = await bookChosen(A, 'noshow-0001');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, { driverId: A.driverId });
    await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: 'driver_en_route' });
    await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: 'driver_arrived' });
    advance(5);
    expect((await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: 'no_show' })).status).toBe(409);
    advance(5);
    const r = await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: 'no_show' });
    expect(r.body.status).toBe('no_show');
    const v = await call('GET', `/v1/rides/${ride.id}`, customerToken);
    expect(v.body.feeCents).toBe(price);
  });

  it('vervoerder annuleert → alles terug + klant krijgt alternatieven', async () => {
    const { ride } = await bookChosen(A, 'opcancel-01');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, {});
    const r = await call('POST', `/v1/operator/rides/${ride.id}/cancel`, A.opToken, { reason: 'Voertuig defect' });
    expect(r.body.status).toBe('cancelled_by_operator');
    const n = await call('GET', '/v1/notifications', customerToken);
    expect(n.body[0]).toMatchObject({ template: 'ride_cancelled_by_operator', payload: { showAlternatives: true } });
  });
});

describe('toegang', () => {
  it('andere klant ziet rit niet', async () => {
    const { ride } = await bookChosen(A, 'access-0001');
    expect((await call('GET', `/v1/rides/${ride.id}`, otherCustomerToken)).status).toBe(404);
    expect((await call('POST', `/v1/rides/${ride.id}/cancel`, otherCustomerToken)).status).toBe(404);
  });

  it('andere vervoerder/chauffeur kan rit niet sturen', async () => {
    const { ride } = await bookChosen(A, 'access-0002');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, { driverId: A.driverId });
    expect((await call('POST', `/v1/driver/rides/${ride.id}/status`, B.driverToken, { status: 'driver_en_route' })).status).toBe(404);
    expect((await call('POST', `/v1/operator/rides/${ride.id}/assign`, B.opToken, { driverId: B.driverId })).status).toBe(404);
  });

  it('chauffeur kan status niet overslaan', async () => {
    const { ride } = await bookChosen(A, 'skip-000001');
    await call('POST', `/v1/operator/rides/${ride.id}/accept`, A.opToken, { driverId: A.driverId });
    const r = await call('POST', `/v1/driver/rides/${ride.id}/status`, A.driverToken, { status: 'completed' });
    expect(r.status).toBe(409);
  });

  it('klant kan geen beheer-endpoints gebruiken', async () => {
    expect((await call('GET', '/v1/admin/attention', customerToken)).status).toBe(403);
    expect((await call('GET', '/v1/admin/attention')).status).toBe(401);
  });

  it('vervoerder zonder documenten kan niet geactiveerd worden', async () => {
    const s = await call('POST', '/v1/operators/signup', undefined, {
      legalName: 'Nieuw BV',
      tradeName: 'Taxi Nieuw',
      enterpriseNumber: kbo(7_654_321),
      phone: '+3220000001',
      email: 'nieuw@example.be',
      serviceArea: BRUSSEL,
      admin: { fullName: 'Nieuw Admin', email: 'nieuw-admin@example.be', password: 'wachtwoord-123' },
    });
    const r = await call('POST', `/v1/admin/operators/${s.body.operatorId}/activate`, adminToken);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('documents_missing');
  });

  it('ongeldig KBO-nummer geweigerd', async () => {
    const r = await call('POST', '/v1/operators/signup', undefined, {
      legalName: 'X BV',
      tradeName: 'Taxi X',
      enterpriseNumber: '0123456789',
      phone: '+3220000002',
      email: 'x@example.be',
      serviceArea: BRUSSEL,
      admin: { fullName: 'X', email: 'x-admin@example.be', password: 'wachtwoord-123' },
    });
    expect(r.status).toBe(400);
  });
});

describe('beheer', () => {
  it('aandachtslijst en cijfers uit echte data', async () => {
    const att = await call('GET', '/v1/admin/attention', adminToken);
    expect(att.status).toBe(200);
    expect(att.body.pendingOperators.length).toBeGreaterThan(0);
    const stats = await call('GET', '/v1/admin/stats?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z', adminToken);
    expect(stats.status).toBe(200);
    const completed = stats.body.ridesByStatus.find((x: { status: string }) => x.status === 'completed');
    expect(completed.n).toBeGreaterThanOrEqual(1);
  });

  it('grootboek is per rit altijd in balans', async () => {
    const rows = await many<{ ride_id: string; ok: boolean }>(
      db,
      `select ride_id,
              sum(case when entry_type='customer_charge' then amount_cents else 0 end) =
              sum(case when entry_type<>'customer_charge' then amount_cents else 0 end) as ok
         from ledger_entries group by ride_id`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok)).toBe(true);
  });
});
