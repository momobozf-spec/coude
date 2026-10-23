import fastifyJwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { requireRole } from './auth.js';
import type { Ctx } from './context.js';
import { many, maybeOne, one } from './db.js';
import { AppError, badRequest, conflict, forbidden, notFound } from './errors.js';
import { createUser, login, publicUser, tokenPayload } from './services/accounts.js';
import * as admin from './services/admin.js';
import * as ops from './services/operators.js';
import * as rides from './services/rides.js';

// ---------------------------------------------------------------------------
// Validatie
// ---------------------------------------------------------------------------
const cents = z.number().int().min(0).max(1_000_000);
const bps = z.number().int().min(0).max(10_000);
const point = z.object({ address: z.string().min(3).max(300), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const tripSchema = z.object({
  pickup: point,
  dropoff: point,
  pickupAt: z.coerce.date(),
  category: z.string().min(1).max(30),
  passengers: z.number().int().min(1).max(8),
  luggageItems: z.number().int().min(0).max(20).default(0),
});
const password = z.string().min(10).max(200);
const locale = z.enum(['nl', 'fr', 'en']);

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

const uuidParam = z.object({ id: z.string().uuid() });
const range = z.object({ from: z.coerce.date(), to: z.coerce.date() });

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export async function buildApp(ctx: Ctx, opts: { jwtSecret: string; logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(fastifyJwt, { secret: opts.jwtSecret, sign: { expiresIn: '12h' } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: 'validation', issues: err.issues });
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 401 || (err as { code?: string }).code?.startsWith('FST_JWT')) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Niet aangemeld' });
    }
    if (status && status < 500) return reply.status(status).send({ error: 'bad_request', message: (err as Error).message });
    app.log.error(err);
    return reply.status(500).send({ error: 'internal', message: 'Er ging iets mis' });
  });

  const customer = { preHandler: requireRole('customer') };
  const operator = { preHandler: requireRole('operator_admin') };
  const opOrDriver = { preHandler: requireRole('operator_admin', 'driver') };
  const driver = { preHandler: requireRole('driver') };
  const platform = { preHandler: requireRole('platform_admin') };

  app.get('/health', async () => {
    await ctx.db.query('select 1');
    return { ok: true };
  });

  // ---------------------------------------------------------------- publiek
  app.get('/v1/categories', async () => many(ctx.db, 'select * from vehicle_categories order by max_seats, code'));

  app.get('/v1/operators/:slug', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().max(80) }), req.params);
    const op = await maybeOne<{ id: string }>(
      ctx.db,
      `select id, trade_name, slug, description, phone, cancel_free_until_min, cancel_late_bps, no_show_bps
         from operators where slug = $1 and status = 'active'`,
      [slug],
    );
    if (!op) throw notFound('Vervoerder niet gevonden');
    const rating = await one(ctx.db, `select round(avg(rating)::numeric,1)::text as average, count(*)::int as count from reviews where operator_id = $1`, [op.id]);
    const recent = await many(ctx.db, `select rating, comment, created_at from reviews where operator_id = $1 order by created_at desc limit 10`, [op.id]);
    const categories = await many(ctx.db, `select category from operator_tariffs where operator_id = $1 and is_active`, [op.id]);
    return { ...op, rating, recentReviews: recent, categories: categories.map((c) => (c as { category: string }).category) };
  });

  app.post('/v1/auth/register', async (req, reply) => {
    const b = parse(z.object({ email: z.string().email(), password, fullName: z.string().min(2).max(120), phone: z.string().max(30).optional(), locale: locale.optional() }), req.body);
    const user = await createUser(ctx.db, { role: 'customer', ...b });
    const token = app.jwt.sign(await tokenPayload(ctx.db, user));
    return reply.status(201).send({ token, user: publicUser(user) });
  });

  app.post('/v1/auth/login', async (req) => {
    const b = parse(z.object({ email: z.string().email(), password: z.string() }), req.body);
    const { user, payload } = await login(ctx, b.email, b.password);
    return { token: app.jwt.sign(payload), user: publicUser(user) };
  });

  app.post('/v1/operators/signup', async (req, reply) => {
    const b = parse(
      z.object({
        legalName: z.string().min(2).max(200),
        tradeName: z.string().min(2).max(120),
        enterpriseNumber: z.string().min(10).max(14),
        exploitationLicenseRef: z.string().max(100).optional(),
        phone: z.string().min(6).max(30),
        email: z.string().email(),
        serviceArea: z.object({ lat: z.number(), lng: z.number(), radiusMeters: z.number().int().min(1000).max(100_000) }),
        admin: z.object({ fullName: z.string().min(2).max(120), email: z.string().email(), password, phone: z.string().max(30).optional() }),
      }),
      req.body,
    );
    return reply.status(201).send(await ops.registerOperator(ctx, b));
  });

  // ------------------------------------------------------------------- klant
  app.post('/v1/search', customer, async (req) => {
    const t = parse(tripSchema, req.body);
    return rides.searchOperators(ctx, t);
  });

  app.post('/v1/rides', customer, async (req, reply) => {
    const b = parse(
      tripSchema.extend({
        mode: z.enum(['chosen_operator', 'open_dispatch']),
        operatorId: z.string().uuid().optional(),
        source: z.enum(['platform', 'operator_channel']).default('platform'),
        acceptedPriceCents: cents,
        notes: z.string().max(500).optional(),
        idempotencyKey: z.string().min(8).max(100),
      }),
      req.body,
    );
    const ride = await rides.createRide(ctx, req.user.sub, b);
    return reply.status(201).send(await rides.rideView(ctx, ride));
  });

  app.get('/v1/rides', customer, async (req) => {
    const list = await many<rides.RideRow>(ctx.db, 'select * from rides where customer_id = $1 order by pickup_at desc limit 50', [req.user.sub]);
    return Promise.all(list.map((r) => rides.rideView(ctx, r)));
  });

  app.get('/v1/rides/:id', customer, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const ride = await rides.getRide(ctx, id);
    if (ride.customer_id !== req.user.sub) throw notFound('Rit niet gevonden');
    return rides.rideView(ctx, ride);
  });

  app.post('/v1/rides/:id/cancel', customer, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const { ride, outcome } = await rides.cancelByCustomer(ctx, req.user.sub, id);
    return { ride: await rides.rideView(ctx, ride), outcome };
  });

  app.post('/v1/rides/:id/review', customer, async (req, reply) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }), req.body);
    const ride = await rides.getRide(ctx, id);
    if (ride.customer_id !== req.user.sub) throw notFound('Rit niet gevonden');
    if (ride.status !== 'completed' || !ride.operator_id) throw conflict('not_completed', 'Enkel voltooide ritten kunnen beoordeeld worden');
    if (await maybeOne(ctx.db, 'select 1 from reviews where ride_id = $1', [id])) throw conflict('already_reviewed', 'Al beoordeeld');
    const r = await one(ctx.db, 'insert into reviews (ride_id, customer_id, operator_id, rating, comment) values ($1,$2,$3,$4,$5) returning *', [
      id,
      req.user.sub,
      ride.operator_id,
      b.rating,
      b.comment ?? null,
    ]);
    return reply.status(201).send(r);
  });

  app.get('/v1/favorites', customer, async (req) =>
    many(
      ctx.db,
      `select o.id, o.trade_name, o.slug from favorites f join operators o on o.id = f.operator_id where f.customer_id = $1 and o.status = 'active'`,
      [req.user.sub],
    ),
  );
  app.put('/v1/favorites/:id', customer, async (req, reply) => {
    const { id } = parse(uuidParam, req.params);
    if (!(await maybeOne(ctx.db, `select 1 from operators where id = $1 and status = 'active'`, [id]))) throw notFound('Vervoerder niet gevonden');
    await ctx.db.query('insert into favorites (customer_id, operator_id) values ($1,$2) on conflict do nothing', [req.user.sub, id]);
    return reply.status(204).send();
  });
  app.delete('/v1/favorites/:id', customer, async (req, reply) => {
    const { id } = parse(uuidParam, req.params);
    await ctx.db.query('delete from favorites where customer_id = $1 and operator_id = $2', [req.user.sub, id]);
    return reply.status(204).send();
  });

  // Incident melden (klant, chauffeur of vervoerder op eigen rit)
  app.post('/v1/rides/:id/incidents', { preHandler: requireRole('customer', 'driver', 'operator_admin') }, async (req, reply) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(
      z.object({ kind: z.enum(['driver_no_show', 'complaint', 'lost_item', 'safety', 'waiting_time', 'other']), description: z.string().min(5).max(2000) }),
      req.body,
    );
    const ride = await rides.getRide(ctx, id);
    const u = req.user;
    const allowed =
      (u.role === 'customer' && ride.customer_id === u.sub) ||
      (u.role === 'driver' && ride.driver_id === u.driverId) ||
      (u.role === 'operator_admin' && ride.operator_id === u.operatorId);
    if (!allowed) throw notFound('Rit niet gevonden');
    const inc = await one(ctx.db, 'insert into incidents (ride_id, opened_by, kind, description) values ($1,$2,$3,$4) returning *', [
      id,
      u.sub,
      b.kind,
      b.description,
    ]);
    return reply.status(201).send(inc);
  });

  app.get('/v1/notifications', { preHandler: requireRole('customer', 'driver', 'operator_admin', 'platform_admin') }, async (req) =>
    many(ctx.db, 'select id, template, payload, created_at from notifications where user_id = $1 order by id desc limit 50', [req.user.sub]),
  );

  // -------------------------------------------------------------- vervoerder
  app.get('/v1/operator/me', operator, async (req) => ops.getOperator(ctx, req.user.operatorId!));

  app.patch('/v1/operator/me', operator, async (req) => {
    const b = parse(
      z.object({
        description: z.string().max(2000).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().email().optional(),
        acceptTimeoutSec: z.number().int().min(30).max(86_400).optional(),
        minLeadTimeMin: z.number().int().min(0).max(10_080).optional(),
        cancelFreeUntilMin: z.number().int().min(0).max(10_080).optional(),
        cancelLateBps: bps.optional(),
        noShowBps: bps.optional(),
        noShowWaitMin: z.number().int().min(0).max(120).optional(),
      }),
      req.body,
    );
    return ops.updateOperatorProfile(ctx, req.user.operatorId!, b);
  });

  app.put('/v1/operator/tariffs/:category', operator, async (req) => {
    const { category } = parse(z.object({ category: z.string().max(30) }), req.params);
    const b = parse(
      z.object({
        baseFare: cents,
        perKm: cents,
        perMinute: cents,
        minimumFare: cents,
        nightSurcharge: cents.default(0),
        luggageSurchargePerItem: cents.default(0),
        freeLuggageItems: z.number().int().min(0).max(20).default(2),
        isActive: z.boolean().default(true),
      }),
      req.body,
    );
    if (!(await maybeOne(ctx.db, 'select 1 from vehicle_categories where code = $1', [category]))) throw badRequest('invalid_category', 'Onbekende categorie');
    return ops.upsertTariff(ctx, req.user.operatorId!, { category, ...b });
  });
  app.get('/v1/operator/tariffs', operator, async (req) => many(ctx.db, 'select * from operator_tariffs where operator_id = $1', [req.user.operatorId]));

  app.post('/v1/operator/vehicles', operator, async (req, reply) => {
    const b = parse(
      z.object({
        plate: z.string().min(2).max(15),
        make: z.string().max(50).optional(),
        model: z.string().max(50).optional(),
        category: z.string().max(30),
        seats: z.number().int().min(1).max(8),
        luggageCapacity: z.number().int().min(0).max(20).default(2),
      }),
      req.body,
    );
    return reply.status(201).send(await ops.addVehicle(ctx, req.user.operatorId!, b));
  });
  app.get('/v1/operator/vehicles', operator, async (req) => ops.listVehicles(ctx, req.user.operatorId!));

  app.post('/v1/operator/drivers', operator, async (req, reply) => {
    const b = parse(
      z.object({ fullName: z.string().min(2).max(120), email: z.string().email(), password, phone: z.string().min(6).max(30), canAcceptRequests: z.boolean().default(false) }),
      req.body,
    );
    return reply.status(201).send(await ops.addDriver(ctx, req.user.operatorId!, b));
  });
  app.get('/v1/operator/drivers', operator, async (req) => ops.listDrivers(ctx, req.user.operatorId!));

  app.post('/v1/operator/documents', operator, async (req, reply) => {
    const b = parse(
      z.object({
        ownerType: z.enum(['operator', 'driver', 'vehicle']),
        ownerId: z.string().uuid(),
        docType: z.string().min(2).max(50),
        expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        fileRef: z.string().max(500).optional(),
      }),
      req.body,
    );
    return reply.status(201).send(await ops.addDocument(ctx, req.user.operatorId!, b));
  });

  app.get('/v1/operator/rides', operator, async (req) => {
    const q = parse(range, req.query);
    return ops.operatorRides(ctx, req.user.operatorId!, q.from, q.to);
  });

  app.get('/v1/operator/earnings', operator, async (req) => {
    const q = parse(range, req.query);
    return ops.operatorEarnings(ctx, req.user.operatorId!, q.from, q.to);
  });

  app.post('/v1/operator/rides/:id/accept', opOrDriver, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ driverId: z.string().uuid().optional(), vehicleId: z.string().uuid().optional() }).default({}), req.body ?? {});
    const actor = rides.operatorActorFrom(req.user);
    const ride = await rides.acceptRide(ctx, actor, id, b.driverId ? { driverId: b.driverId, vehicleId: b.vehicleId } : undefined);
    return rides.rideView(ctx, ride);
  });

  app.post('/v1/operator/rides/:id/decline', opOrDriver, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ reason: z.string().max(300).optional() }).default({}), req.body ?? {});
    const ride = await rides.declineRide(ctx, rides.operatorActorFrom(req.user), id, b.reason);
    return { id: ride.id, status: ride.status };
  });

  app.post('/v1/operator/rides/:id/assign', operator, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ driverId: z.string().uuid(), vehicleId: z.string().uuid().optional() }), req.body);
    return rides.rideView(ctx, await rides.assignDriver(ctx, rides.operatorActorFrom(req.user), id, b.driverId, b.vehicleId));
  });

  app.post('/v1/operator/rides/:id/cancel', operator, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ reason: z.string().min(3).max(300) }), req.body);
    return rides.rideView(ctx, await rides.cancelByOperator(ctx, rides.operatorActorFrom(req.user), id, b.reason));
  });

  // ---------------------------------------------------------------- chauffeur
  app.get('/v1/driver/me', driver, async (req) =>
    one(
      ctx.db,
      `select d.id, d.status, d.is_available, d.current_vehicle_id, d.can_accept_requests, o.trade_name as operator
         from drivers d join operators o on o.id = d.operator_id where d.id = $1`,
      [req.user.driverId],
    ),
  );

  app.patch('/v1/driver/me', driver, async (req) => {
    const b = parse(z.object({ isAvailable: z.boolean().optional(), currentVehicleId: z.string().uuid().nullable().optional() }), req.body);
    if (b.currentVehicleId) {
      const v = await maybeOne(ctx.db, 'select 1 from vehicles where id = $1 and operator_id = $2 and is_active', [b.currentVehicleId, req.user.operatorId]);
      if (!v) throw notFound('Voertuig niet gevonden');
    }
    const d = await one<{ status: string }>(ctx.db, 'select status from drivers where id = $1', [req.user.driverId]);
    if (b.isAvailable && d.status !== 'active') throw forbidden('Chauffeur is nog niet geactiveerd');
    return one(
      ctx.db,
      `update drivers set is_available = coalesce($2, is_available),
              current_vehicle_id = case when $3::boolean then $4::uuid else current_vehicle_id end
        where id = $1 returning id, is_available, current_vehicle_id`,
      [req.user.driverId, b.isAvailable ?? null, b.currentVehicleId !== undefined, b.currentVehicleId ?? null],
    );
  });

  app.get('/v1/driver/rides', driver, async (req) =>
    many(
      ctx.db,
      `select id, status, pickup_at, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
              passengers, luggage_items, notes, price_cents
         from rides where driver_id = $1 and status not in ('completed','cancelled_by_customer','cancelled_by_operator','cancelled_by_platform','no_show')
        order by pickup_at`,
      [req.user.driverId],
    ),
  );

  app.get('/v1/driver/requests', driver, async (req) => {
    const d = await one<{ can_accept_requests: boolean }>(ctx.db, 'select can_accept_requests from drivers where id = $1', [req.user.driverId]);
    if (!d.can_accept_requests) return [];
    return (await ops.operatorRides(ctx, req.user.operatorId!, ctx.now(), ctx.now())).pendingRequests;
  });

  app.get('/v1/driver/history', driver, async (req) =>
    many(
      ctx.db,
      `select id, status, pickup_at, pickup_address, dropoff_address, price_cents, fee_cents, completed_at
         from rides where driver_id = $1 and status in ('completed','no_show') order by pickup_at desc limit 100`,
      [req.user.driverId],
    ),
  );

  app.post('/v1/driver/rides/:id/status', driver, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ status: z.enum(['driver_en_route', 'driver_arrived', 'in_progress', 'completed', 'no_show']) }), req.body);
    const r = await rides.driverStep(ctx, req.user.driverId!, req.user.sub, id, b.status);
    return { id: r.id, status: r.status };
  });

  // ---------------------------------------------------------------- platform
  app.get('/v1/admin/attention', platform, async () => admin.attention(ctx));
  app.get('/v1/admin/stats', platform, async (req) => {
    const q = parse(range, req.query);
    return admin.platformStats(ctx, q.from, q.to);
  });
  app.get('/v1/admin/operators', platform, async (req) => {
    const q = parse(z.object({ status: z.enum(['pending', 'active', 'suspended']).optional() }), req.query);
    return many(
      ctx.db,
      `select id, trade_name, legal_name, enterprise_number, status, created_at, verified_at from operators
        where ($1::text is null or status = $1) order by created_at desc`,
      [q.status ?? null],
    );
  });
  app.get('/v1/admin/operators/:id/documents', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    return many(
      ctx.db,
      `select d.* from documents d
        where (d.owner_type = 'operator' and d.owner_id = $1)
           or (d.owner_type = 'driver' and d.owner_id in (select id from drivers where operator_id = $1))
           or (d.owner_type = 'vehicle' and d.owner_id in (select id from vehicles where operator_id = $1))
        order by d.created_at`,
      [id],
    );
  });
  app.post('/v1/admin/documents/:id/review', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ decision: z.enum(['approved', 'rejected']) }), req.body);
    return admin.reviewDocument(ctx, req.user.sub, id, b.decision);
  });
  app.post('/v1/admin/operators/:id/activate', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    return admin.activateOperator(ctx, req.user.sub, id);
  });
  app.post('/v1/admin/operators/:id/suspend', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    return admin.suspendOperator(ctx, id);
  });
  app.patch('/v1/admin/operators/:id/commercial', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ commissionPlatformBps: bps.optional(), commissionOwnChannelBps: bps.optional(), payoutAccountRef: z.string().max(100).optional() }), req.body);
    const r = await maybeOne(
      ctx.db,
      `update operators set commission_platform_bps = coalesce($2, commission_platform_bps),
              commission_own_channel_bps = coalesce($3, commission_own_channel_bps),
              payout_account_ref = coalesce($4, payout_account_ref)
        where id = $1 returning id, commission_platform_bps, commission_own_channel_bps, payout_account_ref`,
      [id, b.commissionPlatformBps ?? null, b.commissionOwnChannelBps ?? null, b.payoutAccountRef ?? null],
    );
    if (!r) throw notFound('Vervoerder niet gevonden');
    return r;
  });
  app.post('/v1/admin/drivers/:id/activate', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    return admin.activateDriver(ctx, id);
  });
  app.get('/v1/admin/rides', platform, async (req) => {
    const q = parse(range.extend({ status: z.string().max(30).optional() }), req.query);
    return many(
      ctx.db,
      `select r.id, r.status, r.pickup_at, r.price_cents, r.max_price_cents, r.booking_mode, r.source, o.trade_name as operator
         from rides r left join operators o on o.id = r.operator_id
        where r.pickup_at between $1 and $2 and ($3::text is null or r.status = $3)
        order by r.pickup_at limit 500`,
      [q.from, q.to, q.status ?? null],
    );
  });
  app.get('/v1/admin/rides/:id', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const ride = await rides.getRide(ctx, id);
    const offers = await many(ctx.db, 'select * from ride_offers where ride_id = $1 order by sequence', [id]);
    const payment = await maybeOne(ctx.db, 'select * from payments where ride_id = $1', [id]);
    const ledger = await many(ctx.db, 'select entry_type, amount_cents, payout_id from ledger_entries where ride_id = $1 order by id', [id]);
    const events = await many(ctx.db, 'select * from ride_events where ride_id = $1 order by id', [id]);
    return { ride, offers, payment, ledger, events };
  });
  app.post('/v1/admin/rides/:id/cancel', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ reason: z.string().min(3).max(300) }), req.body);
    const r = await rides.cancelByPlatform(ctx, req.user.sub, id, b.reason);
    return { id: r.id, status: r.status };
  });
  app.post('/v1/admin/incidents/:id/resolve', platform, async (req) => {
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ resolution: z.string().min(3).max(2000) }), req.body);
    return admin.resolveIncident(ctx, id, b.resolution);
  });
  app.post('/v1/admin/payouts/run', platform, async () => admin.runPayouts(ctx));
  app.post('/v1/admin/tick', platform, async () => ({ expiredOffersHandled: await rides.processExpiries(ctx) }));

  return app;
}
