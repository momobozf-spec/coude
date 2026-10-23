import {
  assertTransition,
  customerCancellation,
  isConfirmed,
  isInServiceArea,
  noShow,
  noShowAllowed,
  quote,
  settle,
  STATUS_LABELS,
  type Actor,
  type BookingSource,
  type CancellationPolicy,
  type LatLng,
  type Quote,
  type RideStatus,
  type Tariff,
  type TransitionError,
} from '@ritna/core';
import { PaymentError } from '../adapters.js';
import type { AuthUser } from '../auth.js';
import type { Ctx } from '../context.js';
import { many, maybeOne, one, withTx, type Queryable, type Tx } from '../db.js';
import { badRequest, conflict, forbidden, notFound, paymentRequired } from '../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RideRow {
  id: string;
  customer_id: string;
  operator_id: string | null;
  booking_mode: 'chosen_operator' | 'open_dispatch';
  source: BookingSource;
  category: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_at: Date;
  passengers: number;
  luggage_items: number;
  notes: string | null;
  distance_m: number;
  duration_s: number;
  max_price_cents: number;
  price_cents: number | null;
  quote_lines: unknown;
  cancellation_policy: CancellationPolicy;
  commission_terms: { platformSourceBps: number; operatorChannelBps: number } | null;
  status: RideStatus;
  driver_id: string | null;
  vehicle_id: string | null;
  accepted_at: Date | null;
  arrived_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  ended_at: Date | null;
  fee_cents: number;
  refund_cents: number;
  version: number;
  created_at: Date;
}

interface OperatorRow {
  id: string;
  trade_name: string;
  slug: string;
  status: string;
  service_center_lat: number;
  service_center_lng: number;
  service_radius_m: number;
  commission_platform_bps: number;
  commission_own_channel_bps: number;
  cancel_free_until_min: number;
  cancel_late_bps: number;
  no_show_bps: number;
  no_show_wait_min: number;
  accept_timeout_sec: number;
  min_lead_time_min: number;
}

interface TariffRow {
  base_fare: number;
  per_km: number;
  per_minute: number;
  minimum_fare: number;
  night_surcharge: number;
  luggage_surcharge_item: number;
  free_luggage_items: number;
}

export interface TripRequest {
  pickup: LatLng & { address: string };
  dropoff: LatLng & { address: string };
  pickupAt: Date;
  category: string;
  passengers: number;
  luggageItems: number;
}

export interface OperatorOption {
  operatorId: string;
  tradeName: string;
  slug: string;
  priceCents: number;
  quote: Quote;
  rating: { average: number | null; count: number };
  cancellationPolicy: CancellationPolicy;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toTariff = (t: TariffRow): Tariff => ({
  baseFare: t.base_fare,
  perKm: t.per_km,
  perMinute: t.per_minute,
  minimumFare: t.minimum_fare,
  nightSurcharge: t.night_surcharge,
  luggageSurchargePerItem: t.luggage_surcharge_item,
  freeLuggageItems: t.free_luggage_items,
});

const policyOf = (o: OperatorRow): CancellationPolicy => ({
  freeUntilMinutesBefore: o.cancel_free_until_min,
  lateCancelBps: o.cancel_late_bps,
  noShowBps: o.no_show_bps,
  noShowWaitMinutes: o.no_show_wait_min,
});

async function lockRide(tx: Tx, rideId: string): Promise<RideRow> {
  const ride = await maybeOne<RideRow>(tx, 'select * from rides where id = $1 for update', [rideId]);
  if (!ride) throw notFound('Rit niet gevonden');
  return ride;
}

async function transition(
  ctx: Ctx,
  tx: Tx,
  ride: RideRow,
  to: RideStatus,
  actor: Actor,
  actorId: string | null,
  extra: Record<string, unknown> = {},
  data?: Record<string, unknown>,
): Promise<RideRow> {
  try {
    assertTransition(ride.status, to, actor);
  } catch (e) {
    const te = e as TransitionError;
    throw conflict('invalid_transition', te.message);
  }
  const sets = ['status = $2', 'version = version + 1', 'updated_at = $3'];
  const params: unknown[] = [ride.id, to, ctx.now()];
  for (const [col, val] of Object.entries(extra)) {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  }
  const updated = await one<RideRow>(tx, `update rides set ${sets.join(', ')} where id = $1 returning *`, params);
  await tx.query(
    'insert into ride_events (ride_id, from_status, to_status, actor_type, actor_id, data, at) values ($1,$2,$3,$4,$5,$6,$7)',
    [ride.id, ride.status, to, actor, actorId, data ? JSON.stringify(data) : null, ctx.now()],
  );
  return updated;
}

async function operatorUserIds(q: Queryable, operatorId: string): Promise<string[]> {
  return (await many<{ user_id: string }>(q, 'select user_id from operator_users where operator_id = $1', [operatorId])).map(
    (r) => r.user_id,
  );
}

async function notifyOperator(ctx: Ctx, q: Queryable, operatorId: string, template: string, payload: Record<string, unknown>) {
  for (const uid of await operatorUserIds(q, operatorId)) await ctx.notifier.send(q, uid, template, payload);
}

async function driverUserId(q: Queryable, driverId: string): Promise<string> {
  return (await one<{ user_id: string }>(q, 'select user_id from drivers where id = $1', [driverId])).user_id;
}

// ---------------------------------------------------------------------------
// Zoeken
// ---------------------------------------------------------------------------
export function validateTrip(ctx: Ctx, t: TripRequest) {
  if (t.pickupAt.getTime() <= ctx.now().getTime()) throw badRequest('pickup_in_past', 'Ophaaltijd ligt in het verleden');
  const max = new Date(ctx.now().getTime() + 90 * 24 * 3600 * 1000);
  if (t.pickupAt > max) throw badRequest('pickup_too_far', 'Boeken kan tot 90 dagen vooruit');
}

/** Beschikbare vervoerders met vaste prijs voor deze rit. */
export async function searchOperators(ctx: Ctx, t: TripRequest): Promise<{ options: OperatorOption[]; distanceMeters: number; durationSeconds: number }> {
  validateTrip(ctx, t);
  const trip = await ctx.routing.estimate(t.pickup, t.dropoff);

  const rows = await many<OperatorRow & TariffRow>(
    ctx.db,
    `select o.*, t.base_fare, t.per_km, t.per_minute, t.minimum_fare, t.night_surcharge,
            t.luggage_surcharge_item, t.free_luggage_items
       from operators o
       join operator_tariffs t on t.operator_id = o.id and t.category = $1 and t.is_active
      where o.status = 'active'
        and exists (select 1 from vehicles v
                     where v.operator_id = o.id and v.is_active and v.category = $1
                       and v.seats >= $2 and v.luggage_capacity >= $3)
        and exists (select 1 from drivers d where d.operator_id = o.id and d.status = 'active')`,
    [t.category, t.passengers, Math.min(t.luggageItems, 99)],
  );

  const leadOk = (o: OperatorRow) => t.pickupAt.getTime() - ctx.now().getTime() >= o.min_lead_time_min * 60_000;
  const area = (o: OperatorRow) => ({ center: { lat: o.service_center_lat, lng: o.service_center_lng }, radiusMeters: o.service_radius_m });

  const eligible = rows.filter((o) => leadOk(o) && isInServiceArea(t.pickup, area(o)));
  const ratings = await many<{ operator_id: string; avg: string | null; cnt: number }>(
    ctx.db,
    'select operator_id, round(avg(rating)::numeric, 1)::text as avg, count(*) as cnt from reviews where operator_id = any($1) group by operator_id',
    [eligible.map((o) => o.id)],
  );
  const ratingMap = new Map(ratings.map((r) => [r.operator_id, r]));

  const options = eligible
    .map((o): OperatorOption => {
      const q = quote({ tariff: toTariff(o), trip, pickupAt: t.pickupAt, luggageItems: t.luggageItems });
      const r = ratingMap.get(o.id);
      return {
        operatorId: o.id,
        tradeName: o.trade_name,
        slug: o.slug,
        priceCents: q.total,
        quote: q,
        rating: { average: r?.avg ? Number(r.avg) : null, count: r?.cnt ?? 0 },
        cancellationPolicy: policyOf(o),
      };
    })
    .sort((a, b) => a.priceCents - b.priceCents);

  return { options, distanceMeters: trip.distanceMeters, durationSeconds: trip.durationSeconds };
}

// ---------------------------------------------------------------------------
// Boeken
// ---------------------------------------------------------------------------
export interface CreateRideInput extends TripRequest {
  mode: 'chosen_operator' | 'open_dispatch';
  operatorId?: string;
  source: BookingSource;
  /** De prijs (chosen) of maximumprijs (open) die de klant gezien en aanvaard heeft. */
  acceptedPriceCents: number;
  notes?: string;
  idempotencyKey: string;
}

export async function createRide(ctx: Ctx, customerId: string, input: CreateRideInput): Promise<RideRow> {
  const existing = await maybeOne<RideRow>(ctx.db, 'select * from rides where customer_id = $1 and idempotency_key = $2', [
    customerId,
    input.idempotencyKey,
  ]);
  if (existing) return existing;

  if (input.source === 'operator_channel' && input.mode !== 'chosen_operator') {
    throw badRequest('invalid_source', 'Eigen kanaal van een vervoerder kan enkel met die vervoerder boeken');
  }

  const { options, distanceMeters, durationSeconds } = await searchOperators(ctx, input);
  let offers: OperatorOption[];
  let maxPrice: number;

  if (input.mode === 'chosen_operator') {
    if (!input.operatorId) throw badRequest('operator_required', 'Kies een vervoerder');
    const opt = options.find((o) => o.operatorId === input.operatorId);
    if (!opt) throw conflict('operator_unavailable', 'Deze vervoerder is niet beschikbaar voor deze rit');
    if (opt.priceCents !== input.acceptedPriceCents) {
      throw conflict('price_changed', `Prijs gewijzigd naar ${opt.priceCents} cent, bevestig opnieuw`);
    }
    offers = [opt];
    maxPrice = opt.priceCents;
  } else {
    if (options.length === 0) throw conflict('no_operators', 'Geen vervoerder beschikbaar voor deze rit');
    // Enkel vervoerders binnen de aanvaarde maximumprijs, goedkoopste eerst.
    offers = options.filter((o) => o.priceCents <= input.acceptedPriceCents);
    if (offers.length === 0) throw conflict('price_changed', 'Geen vervoerder binnen de aanvaarde maximumprijs');
    maxPrice = input.acceptedPriceCents;
  }

  const first = offers[0]!;
  const policy = input.mode === 'chosen_operator' ? first.cancellationPolicy : strictestPolicy(offers);

  // 1) Betaling autoriseren vóór de rit bestaat. Mislukt de DB-stap, dan vrijgeven.
  let auth: { ref: string };
  try {
    auth = await ctx.payments.authorize({ amountCents: maxPrice, rideId: 'pending', customerId });
  } catch (e) {
    if (e instanceof PaymentError) throw paymentRequired(e.message);
    throw e;
  }

  try {
    return await withTx(ctx.db, async (tx) => {
      const ride = await one<RideRow>(
        tx,
        `insert into rides (customer_id, operator_id, booking_mode, source, category,
            pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng,
            pickup_at, passengers, luggage_items, notes, distance_m, duration_s, max_price_cents,
            cancellation_policy, idempotency_key, created_at, updated_at)
         values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
         returning *`,
        [
          customerId,
          input.mode,
          input.source,
          input.category,
          input.pickup.address,
          input.pickup.lat,
          input.pickup.lng,
          input.dropoff.address,
          input.dropoff.lat,
          input.dropoff.lng,
          input.pickupAt,
          input.passengers,
          input.luggageItems,
          input.notes ?? null,
          distanceMeters,
          durationSeconds,
          maxPrice,
          JSON.stringify(policy),
          input.idempotencyKey,
          ctx.now(),
        ],
      );
      await tx.query(
        `insert into payments (ride_id, provider, provider_ref, authorized_cents, status) values ($1, $2, $3, $4, 'authorized')`,
        [ride.id, ctx.payments.name, auth.ref, maxPrice],
      );
      for (const [i, o] of offers.entries()) {
        await tx.query(
          `insert into ride_offers (ride_id, operator_id, sequence, price_cents, quote_lines, status)
           values ($1, $2, $3, $4, $5, 'queued')`,
          [ride.id, o.operatorId, i + 1, o.priceCents, JSON.stringify(o.quote.lines)],
        );
      }
      await tx.query(
        `insert into ride_events (ride_id, from_status, to_status, actor_type, actor_id, at) values ($1, null, 'requested', 'customer', $2, $3)`,
        [ride.id, customerId, ctx.now()],
      );
      await offerNext(ctx, tx, ride);
      return ride;
    });
  } catch (e) {
    await ctx.payments.void(auth.ref).catch(() => undefined);
    throw e;
  }
}

/** Bij open aanvragen geldt de strengste annuleringsregel, zodat de klant nooit meer betaalt dan getoond. */
function strictestPolicy(opts: OperatorOption[]): CancellationPolicy {
  return opts.reduce<CancellationPolicy>(
    (acc, o) => ({
      freeUntilMinutesBefore: Math.max(acc.freeUntilMinutesBefore, o.cancellationPolicy.freeUntilMinutesBefore),
      lateCancelBps: Math.max(acc.lateCancelBps, o.cancellationPolicy.lateCancelBps),
      noShowBps: Math.max(acc.noShowBps, o.cancellationPolicy.noShowBps),
      noShowWaitMinutes: Math.max(acc.noShowWaitMinutes, o.cancellationPolicy.noShowWaitMinutes),
    }),
    { freeUntilMinutesBefore: 0, lateCancelBps: 0, noShowBps: 0, noShowWaitMinutes: 0 },
  );
}

/**
 * Activeer het volgende aanbod in de wachtrij. Geeft false terug als er geen
 * vervoerders meer over zijn.
 */
async function offerNext(ctx: Ctx, tx: Tx, ride: RideRow): Promise<boolean> {
  const next = await maybeOne<{ id: string; operator_id: string; price_cents: number; accept_timeout_sec: number }>(
    tx,
    `select ro.id, ro.operator_id, ro.price_cents, o.accept_timeout_sec
       from ride_offers ro join operators o on o.id = ro.operator_id
      where ro.ride_id = $1 and ro.status = 'queued' and o.status = 'active'
      order by ro.sequence limit 1`,
    [ride.id],
  );
  if (!next) return false;
  const now = ctx.now();
  const byTimeout = now.getTime() + next.accept_timeout_sec * 1000;
  const expiresAt = new Date(Math.min(byTimeout, new Date(ride.pickup_at).getTime()));
  await tx.query(`update ride_offers set status = 'pending', offered_at = $2, expires_at = $3 where id = $1`, [next.id, now, expiresAt]);
  await notifyOperator(ctx, tx, next.operator_id, 'ride_request', {
    rideId: ride.id,
    pickupAt: ride.pickup_at,
    priceCents: next.price_cents,
    expiresAt,
  });
  // Chauffeurs die namens de vervoerder mogen aanvaarden.
  const drivers = await many<{ user_id: string }>(
    tx,
    `select user_id from drivers where operator_id = $1 and status = 'active' and can_accept_requests`,
    [next.operator_id],
  );
  for (const d of drivers) await ctx.notifier.send(tx, d.user_id, 'ride_request', { rideId: ride.id, expiresAt });
  return true;
}

async function releasePayment(ctx: Ctx, tx: Tx, rideId: string) {
  const p = await one<{ id: string; provider_ref: string; status: string }>(tx, 'select * from payments where ride_id = $1 for update', [rideId]);
  if (p.status !== 'authorized') return;
  await ctx.payments.void(p.provider_ref);
  await tx.query(`update payments set status = 'voided', updated_at = $2 where id = $1`, [p.id, ctx.now()]);
}

/** Capture `amount` en boek de verdeling in het grootboek. */
async function chargeAndSettle(ctx: Ctx, tx: Tx, ride: RideRow, amount: number) {
  const p = await one<{ id: string; provider_ref: string; status: string; authorized_cents: number }>(
    tx,
    'select * from payments where ride_id = $1 for update',
    [ride.id],
  );
  if (p.status !== 'authorized') throw conflict('payment_state', `Betaling heeft status ${p.status}`);
  if (amount === 0) {
    await releasePayment(ctx, tx, ride.id);
    return;
  }
  if (amount > p.authorized_cents) throw conflict('payment_amount', 'Bedrag hoger dan geautoriseerd');
  if (!ride.operator_id || !ride.commission_terms) throw conflict('no_operator', 'Rit heeft geen vervoerder');

  await ctx.payments.capture(p.provider_ref, amount);
  await tx.query(`update payments set status = 'captured', captured_cents = $2, updated_at = $3 where id = $1`, [p.id, amount, ctx.now()]);

  const s = settle(amount, ride.source, ride.commission_terms, ctx.commissionVatBps);
  const entries: [string, number][] = [
    ['customer_charge', s.customerCharge],
    ['platform_commission', s.platformCommission],
    ['commission_vat', s.commissionVat],
    ['operator_payable', s.operatorPayout],
  ];
  for (const [type, cents] of entries) {
    await tx.query(
      'insert into ledger_entries (ride_id, operator_id, entry_type, amount_cents, created_at) values ($1, $2, $3, $4, $5)',
      [ride.id, ride.operator_id, type, cents, ctx.now()],
    );
  }
}

// ---------------------------------------------------------------------------
// Vervoerder: aanvragen aanvaarden / weigeren
// ---------------------------------------------------------------------------
export interface OperatorActor {
  operatorId: string;
  userId: string;
  /** Gezet wanneer een chauffeur namens de vervoerder aanvaardt. */
  actingDriverId?: string;
}

export function operatorActorFrom(user: AuthUser): OperatorActor {
  if (user.role === 'operator_admin' && user.operatorId) return { operatorId: user.operatorId, userId: user.sub };
  if (user.role === 'driver' && user.driverId && user.operatorId) {
    return { operatorId: user.operatorId, userId: user.sub, actingDriverId: user.driverId };
  }
  throw forbidden();
}

export async function acceptRide(
  ctx: Ctx,
  actor: OperatorActor,
  rideId: string,
  assign?: { driverId: string; vehicleId?: string },
): Promise<RideRow> {
  return withTx(ctx.db, async (tx) => {
    if (actor.actingDriverId) {
      const d = await one<{ can_accept_requests: boolean; status: string }>(tx, 'select * from drivers where id = $1', [actor.actingDriverId]);
      if (!d.can_accept_requests || d.status !== 'active') throw forbidden('Chauffeur mag geen aanvragen aanvaarden');
      assign = { driverId: actor.actingDriverId, vehicleId: assign?.vehicleId };
    }
    const ride = await lockRide(tx, rideId);
    const offer = await maybeOne<{ id: string; price_cents: number; quote_lines: unknown; expires_at: Date }>(
      tx,
      `select * from ride_offers where ride_id = $1 and operator_id = $2 and status = 'pending' for update`,
      [rideId, actor.operatorId],
    );
    if (!offer) throw notFound('Geen openstaande aanvraag voor deze rit');
    if (new Date(offer.expires_at) <= ctx.now()) throw conflict('offer_expired', 'Aanvraag is verlopen');

    const op = await one<OperatorRow>(tx, 'select * from operators where id = $1', [actor.operatorId]);
    if (op.status !== 'active') throw forbidden('Vervoerder is niet actief');

    await tx.query(`update ride_offers set status = 'accepted', responded_at = $2 where id = $1`, [offer.id, ctx.now()]);
    await tx.query(`update ride_offers set status = 'superseded' where ride_id = $1 and status = 'queued'`, [rideId]);

    let updated = await transition(ctx, tx, ride, 'accepted', 'operator', actor.userId, {
      operator_id: actor.operatorId,
      price_cents: offer.price_cents,
      quote_lines: JSON.stringify(offer.quote_lines),
      commission_terms: JSON.stringify({
        platformSourceBps: op.commission_platform_bps,
        operatorChannelBps: op.commission_own_channel_bps,
      }),
      accepted_at: ctx.now(),
    });

    await ctx.notifier.send(tx, ride.customer_id, 'ride_confirmed', {
      rideId,
      operator: op.trade_name,
      priceCents: offer.price_cents,
      pickupAt: ride.pickup_at,
    });

    if (assign) updated = await doAssign(ctx, tx, updated, actor, assign.driverId, assign.vehicleId);
    return updated;
  });
}

export async function declineRide(ctx: Ctx, actor: OperatorActor, rideId: string, reason?: string): Promise<RideRow> {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    const offer = await maybeOne<{ id: string }>(
      tx,
      `select id from ride_offers where ride_id = $1 and operator_id = $2 and status = 'pending' for update`,
      [rideId, actor.operatorId],
    );
    if (!offer) throw notFound('Geen openstaande aanvraag voor deze rit');
    await tx.query(`update ride_offers set status = 'declined', responded_at = $2 where id = $1`, [offer.id, ctx.now()]);
    return afterOfferEnded(ctx, tx, ride, 'declined', actor.userId, reason);
  });
}

async function afterOfferEnded(
  ctx: Ctx,
  tx: Tx,
  ride: RideRow,
  outcome: 'declined' | 'expired',
  actorId: string | null,
  reason?: string,
): Promise<RideRow> {
  if (ride.booking_mode === 'open_dispatch') {
    if (await offerNext(ctx, tx, ride)) return ride;
    const r = await transition(ctx, tx, ride, 'unfulfilled', 'system', null, { ended_at: ctx.now() });
    await releasePayment(ctx, tx, ride.id);
    await ctx.notifier.send(tx, ride.customer_id, 'ride_unfulfilled', { rideId: ride.id });
    return r;
  }
  const actor: Actor = outcome === 'declined' ? 'operator' : 'system';
  const r = await transition(ctx, tx, ride, outcome, actor, actorId, { ended_at: ctx.now() }, reason ? { reason } : undefined);
  await releasePayment(ctx, tx, ride.id);
  // De klant krijgt alternatieven; we vervangen de gekozen vervoerder niet stilzwijgend.
  await ctx.notifier.send(tx, ride.customer_id, outcome === 'declined' ? 'ride_declined' : 'ride_expired', {
    rideId: ride.id,
    showAlternatives: true,
  });
  return r;
}

/** Achtergrondjob: verlopen aanbiedingen afhandelen. Idempotent. */
export async function processExpiries(ctx: Ctx): Promise<number> {
  const due = await many<{ id: string; ride_id: string }>(
    ctx.db,
    `select id, ride_id from ride_offers where status = 'pending' and expires_at <= $1 order by expires_at limit 200`,
    [ctx.now()],
  );
  let handled = 0;
  for (const o of due) {
    await withTx(ctx.db, async (tx) => {
      const ride = await lockRide(tx, o.ride_id);
      const still = await maybeOne(tx, `select 1 from ride_offers where id = $1 and status = 'pending' and expires_at <= $2 for update`, [
        o.id,
        ctx.now(),
      ]);
      if (!still || ride.status !== 'requested') return;
      await tx.query(`update ride_offers set status = 'expired' where id = $1`, [o.id]);
      await afterOfferEnded(ctx, tx, ride, 'expired', null);
      handled++;
    });
  }
  return handled;
}

// ---------------------------------------------------------------------------
// Chauffeur toewijzen
// ---------------------------------------------------------------------------
async function doAssign(ctx: Ctx, tx: Tx, ride: RideRow, actor: OperatorActor, driverId: string, vehicleId?: string): Promise<RideRow> {
  const driver = await maybeOne<{ id: string; operator_id: string; status: string; current_vehicle_id: string | null }>(
    tx,
    'select * from drivers where id = $1',
    [driverId],
  );
  if (!driver || driver.operator_id !== actor.operatorId) throw notFound('Chauffeur niet gevonden');
  if (driver.status !== 'active') throw conflict('driver_inactive', 'Chauffeur is niet actief');
  const vid = vehicleId ?? driver.current_vehicle_id;
  if (!vid) throw badRequest('vehicle_required', 'Kies een voertuig');
  const vehicle = await maybeOne<{ operator_id: string; category: string; seats: number; is_active: boolean }>(
    tx,
    'select * from vehicles where id = $1',
    [vid],
  );
  if (!vehicle || vehicle.operator_id !== actor.operatorId || !vehicle.is_active) throw notFound('Voertuig niet gevonden');
  if (vehicle.category !== ride.category) throw conflict('vehicle_category', 'Voertuig past niet bij de geboekte categorie');
  if (vehicle.seats < ride.passengers) throw conflict('vehicle_seats', 'Te weinig zitplaatsen');

  let current = ride;
  if (current.status === 'driver_assigned') {
    current = await transition(ctx, tx, current, 'accepted', 'operator', actor.userId, { driver_id: null, vehicle_id: null }, { unassigned: ride.driver_id });
  }
  const updated = await transition(ctx, tx, current, 'driver_assigned', 'operator', actor.userId, { driver_id: driverId, vehicle_id: vid });
  await ctx.notifier.send(tx, await driverUserId(tx, driverId), 'ride_assigned', { rideId: ride.id, pickupAt: ride.pickup_at });
  await ctx.notifier.send(tx, ride.customer_id, 'driver_assigned', { rideId: ride.id });
  return updated;
}

export async function assignDriver(ctx: Ctx, actor: OperatorActor, rideId: string, driverId: string, vehicleId?: string) {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.operator_id !== actor.operatorId) throw notFound('Rit niet gevonden');
    return doAssign(ctx, tx, ride, actor, driverId, vehicleId);
  });
}

// ---------------------------------------------------------------------------
// Chauffeur: ritstatus
// ---------------------------------------------------------------------------
export type DriverStep = 'driver_en_route' | 'driver_arrived' | 'in_progress' | 'completed' | 'no_show';

export async function driverStep(ctx: Ctx, driverId: string, driverUser: string, rideId: string, to: DriverStep): Promise<RideRow> {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.driver_id !== driverId) throw notFound('Rit niet gevonden');
    const now = ctx.now();

    if (to === 'no_show') {
      if (!ride.arrived_at || !noShowAllowed(new Date(ride.arrived_at), now, ride.cancellation_policy)) {
        throw conflict('no_show_too_early', `No-show kan pas na ${ride.cancellation_policy.noShowWaitMinutes} min wachten`);
      }
      const outcome = noShow(ride.price_cents ?? 0, ride.cancellation_policy);
      const r = await transition(ctx, tx, ride, 'no_show', 'driver', driverUser, {
        ended_at: now,
        fee_cents: outcome.fee,
        refund_cents: outcome.refund,
      });
      await chargeAndSettle(ctx, tx, r, outcome.fee);
      await ctx.notifier.send(tx, ride.customer_id, 'ride_no_show', { rideId, feeCents: outcome.fee });
      return r;
    }

    const stamps: Record<string, unknown> = {};
    if (to === 'driver_arrived') stamps.arrived_at = now;
    if (to === 'in_progress') stamps.started_at = now;
    if (to === 'completed') {
      stamps.completed_at = now;
      stamps.ended_at = now;
    }
    const r = await transition(ctx, tx, ride, to, 'driver', driverUser, stamps);
    if (to === 'completed') {
      await chargeAndSettle(ctx, tx, r, r.price_cents ?? 0);
      await ctx.notifier.send(tx, ride.customer_id, 'ride_completed', { rideId, priceCents: r.price_cents });
    } else {
      await ctx.notifier.send(tx, ride.customer_id, to, { rideId });
    }
    return r;
  });
}

// ---------------------------------------------------------------------------
// Annuleren
// ---------------------------------------------------------------------------
export async function cancelByCustomer(ctx: Ctx, customerId: string, rideId: string) {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.customer_id !== customerId) throw notFound('Rit niet gevonden');
    const price = ride.price_cents ?? ride.max_price_cents;
    const outcome = customerCancellation(price, ride.status, new Date(ride.pickup_at), ctx.now(), ride.cancellation_policy);
    const r = await transition(ctx, tx, ride, 'cancelled_by_customer', 'customer', customerId, {
      ended_at: ctx.now(),
      fee_cents: outcome.fee,
      refund_cents: outcome.refund,
    });
    await tx.query(`update ride_offers set status = 'superseded' where ride_id = $1 and status in ('queued','pending')`, [rideId]);
    await chargeAndSettle(ctx, tx, r, outcome.fee);
    if (ride.operator_id) await notifyOperator(ctx, tx, ride.operator_id, 'ride_cancelled', { rideId, by: 'customer' });
    if (ride.driver_id) await ctx.notifier.send(tx, await driverUserId(tx, ride.driver_id), 'ride_cancelled', { rideId });
    return { ride: r, outcome };
  });
}

export async function cancelByOperator(ctx: Ctx, actor: OperatorActor, rideId: string, reason: string) {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.operator_id !== actor.operatorId) throw notFound('Rit niet gevonden');
    const r = await transition(ctx, tx, ride, 'cancelled_by_operator', 'operator', actor.userId, { ended_at: ctx.now(), refund_cents: ride.price_cents ?? 0 }, { reason });
    await releasePayment(ctx, tx, rideId);
    await ctx.notifier.send(tx, ride.customer_id, 'ride_cancelled_by_operator', { rideId, showAlternatives: true });
    if (ride.driver_id) await ctx.notifier.send(tx, await driverUserId(tx, ride.driver_id), 'ride_cancelled', { rideId });
    return r;
  });
}

export async function cancelByPlatform(ctx: Ctx, adminId: string, rideId: string, reason: string) {
  return withTx(ctx.db, async (tx) => {
    const ride = await lockRide(tx, rideId);
    const r = await transition(ctx, tx, ride, 'cancelled_by_platform', 'platform', adminId, { ended_at: ctx.now(), refund_cents: ride.price_cents ?? ride.max_price_cents }, { reason });
    await tx.query(`update ride_offers set status = 'superseded' where ride_id = $1 and status in ('queued','pending')`, [rideId]);
    await releasePayment(ctx, tx, rideId);
    await ctx.notifier.send(tx, ride.customer_id, 'ride_cancelled_by_platform', { rideId });
    if (ride.operator_id) await notifyOperator(ctx, tx, ride.operator_id, 'ride_cancelled', { rideId, by: 'platform' });
    return r;
  });
}

// ---------------------------------------------------------------------------
// Weergave
// ---------------------------------------------------------------------------
export async function rideView(ctx: Ctx, ride: RideRow, locale: 'nl' | 'fr' | 'en' = 'nl') {
  const operator = ride.operator_id
    ? await one<{ trade_name: string; phone: string | null; slug: string }>(ctx.db, 'select trade_name, phone, slug from operators where id = $1', [ride.operator_id])
    : null;
  const driver = ride.driver_id
    ? await one<{ first_name: string; phone: string | null }>(
        ctx.db,
        `select split_part(u.full_name, ' ', 1) as first_name, u.phone from drivers d join users u on u.id = d.user_id where d.id = $1`,
        [ride.driver_id],
      )
    : null;
  const vehicle = ride.vehicle_id
    ? await one<{ plate: string; make: string | null; model: string | null }>(ctx.db, 'select plate, make, model from vehicles where id = $1', [ride.vehicle_id])
    : null;
  const events = await many<{ to_status: string; at: Date }>(ctx.db, 'select to_status, at from ride_events where ride_id = $1 order by id', [ride.id]);
  return {
    id: ride.id,
    status: ride.status,
    statusLabel: STATUS_LABELS[ride.status][locale],
    confirmed: isConfirmed(ride.status),
    bookingMode: ride.booking_mode,
    category: ride.category,
    pickup: { address: ride.pickup_address, lat: ride.pickup_lat, lng: ride.pickup_lng },
    dropoff: { address: ride.dropoff_address, lat: ride.dropoff_lat, lng: ride.dropoff_lng },
    pickupAt: ride.pickup_at,
    passengers: ride.passengers,
    luggageItems: ride.luggage_items,
    priceCents: ride.price_cents,
    maxPriceCents: ride.max_price_cents,
    quoteLines: ride.quote_lines,
    cancellationPolicy: ride.cancellation_policy,
    feeCents: ride.fee_cents,
    refundCents: ride.refund_cents,
    operator,
    driver,
    vehicle,
    timeline: events,
  };
}

export async function getRide(ctx: Ctx, rideId: string): Promise<RideRow> {
  const r = await maybeOne<RideRow>(ctx.db, 'select * from rides where id = $1', [rideId]);
  if (!r) throw notFound('Rit niet gevonden');
  return r;
}
