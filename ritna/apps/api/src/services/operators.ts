import type { Ctx } from '../context.js';
import { many, maybeOne, one, withTx } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { createUser, type UserRow } from './accounts.js';

export interface OperatorSignup {
  legalName: string;
  tradeName: string;
  enterpriseNumber: string;
  exploitationLicenseRef?: string;
  phone: string;
  email: string;
  serviceArea: { lat: number; lng: number; radiusMeters: number };
  admin: { fullName: string; email: string; password: string; phone?: string };
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** KBO-nummer: 10 cijfers, controle modulo 97. */
export function normalizeEnterpriseNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) throw badRequest('invalid_kbo', 'KBO-nummer moet 10 cijfers hebben');
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8));
  if (97 - (base % 97) !== check) throw badRequest('invalid_kbo', 'KBO-nummer is ongeldig');
  return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
}

export async function registerOperator(ctx: Ctx, input: OperatorSignup) {
  const kbo = normalizeEnterpriseNumber(input.enterpriseNumber);
  return withTx(ctx.db, async (tx) => {
    if (await maybeOne(tx, 'select 1 from operators where enterprise_number = $1', [kbo])) {
      throw conflict('operator_exists', 'Dit bedrijf is al geregistreerd');
    }
    let slug = slugify(input.tradeName);
    if (await maybeOne(tx, 'select 1 from operators where slug = $1', [slug])) slug = `${slug}-${kbo.slice(-3)}`;
    const op = await one<{ id: string }>(
      tx,
      `insert into operators (legal_name, trade_name, slug, enterprise_number, exploitation_license_ref, phone, email,
         service_center_lat, service_center_lng, service_radius_m)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        input.legalName,
        input.tradeName,
        slug,
        kbo,
        input.exploitationLicenseRef ?? null,
        input.phone,
        input.email,
        input.serviceArea.lat,
        input.serviceArea.lng,
        input.serviceArea.radiusMeters,
      ],
    );
    const admin = await createUser(tx, { role: 'operator_admin', ...input.admin });
    await tx.query('insert into operator_users (operator_id, user_id) values ($1, $2)', [op.id, admin.id]);
    return { operatorId: op.id, slug, adminUserId: admin.id };
  });
}

export async function getOperator(ctx: Ctx, operatorId: string) {
  const op = await maybeOne<Record<string, unknown>>(ctx.db, 'select * from operators where id = $1', [operatorId]);
  if (!op) throw notFound('Vervoerder niet gevonden');
  return op;
}

const PROFILE_FIELDS = {
  description: 'description',
  phone: 'phone',
  email: 'email',
  acceptTimeoutSec: 'accept_timeout_sec',
  minLeadTimeMin: 'min_lead_time_min',
  cancelFreeUntilMin: 'cancel_free_until_min',
  cancelLateBps: 'cancel_late_bps',
  noShowBps: 'no_show_bps',
  noShowWaitMin: 'no_show_wait_min',
} as const;

export async function updateOperatorProfile(ctx: Ctx, operatorId: string, patch: Partial<Record<keyof typeof PROFILE_FIELDS, unknown>>) {
  const sets: string[] = [];
  const params: unknown[] = [operatorId];
  for (const [k, col] of Object.entries(PROFILE_FIELDS)) {
    const v = patch[k as keyof typeof PROFILE_FIELDS];
    if (v !== undefined) {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return getOperator(ctx, operatorId);
  return one(ctx.db, `update operators set ${sets.join(', ')} where id = $1 returning *`, params);
}

export interface TariffInput {
  category: string;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  nightSurcharge: number;
  luggageSurchargePerItem: number;
  freeLuggageItems: number;
  isActive: boolean;
}

export async function upsertTariff(ctx: Ctx, operatorId: string, t: TariffInput) {
  return one(
    ctx.db,
    `insert into operator_tariffs (operator_id, category, base_fare, per_km, per_minute, minimum_fare,
        night_surcharge, luggage_surcharge_item, free_luggage_items, is_active, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (operator_id, category) do update set
        base_fare = excluded.base_fare, per_km = excluded.per_km, per_minute = excluded.per_minute,
        minimum_fare = excluded.minimum_fare, night_surcharge = excluded.night_surcharge,
        luggage_surcharge_item = excluded.luggage_surcharge_item, free_luggage_items = excluded.free_luggage_items,
        is_active = excluded.is_active, updated_at = excluded.updated_at
     returning *`,
    [
      operatorId,
      t.category,
      t.baseFare,
      t.perKm,
      t.perMinute,
      t.minimumFare,
      t.nightSurcharge,
      t.luggageSurchargePerItem,
      t.freeLuggageItems,
      t.isActive,
      ctx.now(),
    ],
  );
}

export async function addVehicle(
  ctx: Ctx,
  operatorId: string,
  v: { plate: string; make?: string; model?: string; category: string; seats: number; luggageCapacity: number },
) {
  const plate = v.plate.toUpperCase().replace(/\s+/g, '');
  if (await maybeOne(ctx.db, 'select 1 from vehicles where operator_id = $1 and plate = $2', [operatorId, plate])) {
    throw conflict('vehicle_exists', 'Voertuig met deze nummerplaat bestaat al');
  }
  return one(
    ctx.db,
    `insert into vehicles (operator_id, plate, make, model, category, seats, luggage_capacity) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [operatorId, plate, v.make ?? null, v.model ?? null, v.category, v.seats, v.luggageCapacity],
  );
}

export async function addDriver(
  ctx: Ctx,
  operatorId: string,
  d: { fullName: string; email: string; password: string; phone: string; canAcceptRequests: boolean },
) {
  return withTx(ctx.db, async (tx) => {
    const user: UserRow = await createUser(tx, { role: 'driver', email: d.email, password: d.password, fullName: d.fullName, phone: d.phone });
    return one(tx, `insert into drivers (operator_id, user_id, can_accept_requests) values ($1, $2, $3) returning *`, [
      operatorId,
      user.id,
      d.canAcceptRequests,
    ]);
  });
}

export async function listDrivers(ctx: Ctx, operatorId: string) {
  return many(
    ctx.db,
    `select d.id, d.status, d.is_available, d.current_vehicle_id, d.can_accept_requests, u.full_name, u.phone, u.email
       from drivers d join users u on u.id = d.user_id where d.operator_id = $1 order by u.full_name`,
    [operatorId],
  );
}

export async function listVehicles(ctx: Ctx, operatorId: string) {
  return many(ctx.db, 'select * from vehicles where operator_id = $1 order by plate', [operatorId]);
}

export async function addDocument(
  ctx: Ctx,
  operatorId: string,
  doc: { ownerType: 'operator' | 'driver' | 'vehicle'; ownerId: string; docType: string; expiresOn?: string; fileRef?: string },
) {
  // Eigendom controleren: een vervoerder kan enkel eigen documenten indienen.
  const table = { operator: 'operators', driver: 'drivers', vehicle: 'vehicles' }[doc.ownerType];
  const ownerCol = doc.ownerType === 'operator' ? 'id' : 'operator_id';
  const owned = await maybeOne(ctx.db, `select 1 from ${table} where id = $1 and ${ownerCol} = $2`, [doc.ownerId, operatorId]);
  if (!owned) throw notFound('Eigenaar van document niet gevonden');
  return one(
    ctx.db,
    `insert into documents (owner_type, owner_id, doc_type, expires_on, file_ref) values ($1,$2,$3,$4,$5) returning *`,
    [doc.ownerType, doc.ownerId, doc.docType, doc.expiresOn ?? null, doc.fileRef ?? null],
  );
}

/** Ritten van de vervoerder in een periode + openstaande aanvragen. */
export async function operatorRides(ctx: Ctx, operatorId: string, from: Date, to: Date) {
  const rides = await many(
    ctx.db,
    `select r.id, r.status, r.pickup_at, r.pickup_address, r.dropoff_address, r.category, r.passengers,
            r.luggage_items, r.price_cents, r.driver_id, r.vehicle_id, r.source, r.notes
       from rides r where r.operator_id = $1 and r.pickup_at between $2 and $3 order by r.pickup_at`,
    [operatorId, from, to],
  );
  const pending = await many(
    ctx.db,
    `select ro.ride_id, ro.price_cents, ro.expires_at, r.pickup_at, r.pickup_address, r.dropoff_address,
            r.category, r.passengers, r.luggage_items, r.notes
       from ride_offers ro join rides r on r.id = ro.ride_id
      where ro.operator_id = $1 and ro.status = 'pending' and ro.expires_at > $2
      order by ro.expires_at`,
    [operatorId, ctx.now()],
  );
  return { rides, pendingRequests: pending };
}

/** Financieel overzicht op basis van het grootboek (enkel echte boekingen). */
export async function operatorEarnings(ctx: Ctx, operatorId: string, from: Date, to: Date) {
  const rows = await many<{ entry_type: string; total: number }>(
    ctx.db,
    `select entry_type, coalesce(sum(amount_cents), 0)::int as total
       from ledger_entries where operator_id = $1 and created_at between $2 and $3 group by entry_type`,
    [operatorId, from, to],
  );
  const get = (t: string) => rows.find((r) => r.entry_type === t)?.total ?? 0;
  const unpaid = await one<{ total: number }>(
    ctx.db,
    `select coalesce(sum(amount_cents), 0)::int as total from ledger_entries
      where operator_id = $1 and entry_type = 'operator_payable' and payout_id is null`,
    [operatorId],
  );
  const payouts = await many(ctx.db, 'select id, amount_cents, status, created_at, paid_at from payouts where operator_id = $1 order by created_at desc limit 20', [
    operatorId,
  ]);
  return {
    period: { from, to },
    customerCharges: get('customer_charge'),
    platformCommission: get('platform_commission'),
    commissionVat: get('commission_vat'),
    operatorPayable: get('operator_payable'),
    unpaidBalance: unpaid.total,
    payouts,
  };
}
