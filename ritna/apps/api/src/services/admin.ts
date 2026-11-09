import type { Ctx } from '../context.js';
import { many, maybeOne, one, withTx } from '../db.js';
import { conflict, notFound } from '../errors.js';

/** Documenttypes die een vervoerder goedgekeurd en geldig moet hebben vóór activering. */
export const REQUIRED_OPERATOR_DOCS = ['exploitation_license', 'insurance'] as const;

export async function reviewDocument(ctx: Ctx, adminId: string, documentId: string, decision: 'approved' | 'rejected') {
  const doc = await maybeOne(ctx.db, 'select id from documents where id = $1', [documentId]);
  if (!doc) throw notFound('Document niet gevonden');
  return one(ctx.db, `update documents set status = $2, reviewed_by = $3, reviewed_at = $4 where id = $1 returning *`, [
    documentId,
    decision,
    adminId,
    ctx.now(),
  ]);
}

async function missingOperatorDocs(ctx: Ctx, operatorId: string): Promise<string[]> {
  const ok = await many<{ doc_type: string }>(
    ctx.db,
    `select distinct doc_type from documents
      where owner_type = 'operator' and owner_id = $1 and status = 'approved'
        and (expires_on is null or expires_on >= $2::date)`,
    [operatorId, ctx.now()],
  );
  const have = new Set(ok.map((d) => d.doc_type));
  return REQUIRED_OPERATOR_DOCS.filter((d) => !have.has(d));
}

export async function activateOperator(ctx: Ctx, adminId: string, operatorId: string) {
  const missing = await missingOperatorDocs(ctx, operatorId);
  if (missing.length) throw conflict('documents_missing', `Ontbrekende of verlopen documenten: ${missing.join(', ')}`);
  const r = await maybeOne(ctx.db, `update operators set status = 'active', verified_at = $2, verified_by = $3 where id = $1 returning id, status`, [
    operatorId,
    ctx.now(),
    adminId,
  ]);
  if (!r) throw notFound('Vervoerder niet gevonden');
  return r;
}

export async function suspendOperator(ctx: Ctx, operatorId: string) {
  const r = await maybeOne(ctx.db, `update operators set status = 'suspended' where id = $1 returning id, status`, [operatorId]);
  if (!r) throw notFound('Vervoerder niet gevonden');
  return r;
}

export async function activateDriver(ctx: Ctx, driverId: string) {
  const missing = await many<{ t: string }>(
    ctx.db,
    `select t from unnest(array['driver_permit']) t
      where not exists (select 1 from documents d where d.owner_type = 'driver' and d.owner_id = $1
                          and d.doc_type = t and d.status = 'approved'
                          and (d.expires_on is null or d.expires_on >= $2::date))`,
    [driverId, ctx.now()],
  );
  if (missing.length) throw conflict('documents_missing', `Ontbrekende of verlopen documenten: ${missing.map((m) => m.t).join(', ')}`);
  const r = await maybeOne(ctx.db, `update drivers set status = 'active' where id = $1 returning id, status`, [driverId]);
  if (!r) throw notFound('Chauffeur niet gevonden');
  return r;
}

/** Wat vandaag aandacht vraagt. */
export async function attention(ctx: Ctx) {
  const now = ctx.now();
  const soon = new Date(now.getTime() + 60 * 60_000);
  const expiringOffers = await many(
    ctx.db,
    `select ro.ride_id, ro.operator_id, ro.expires_at from ride_offers ro
      where ro.status = 'pending' and ro.expires_at <= $1 order by ro.expires_at`,
    [new Date(now.getTime() + 10 * 60_000)],
  );
  const noDriver = await many(
    ctx.db,
    `select id, operator_id, pickup_at from rides where status = 'accepted' and pickup_at <= $1 order by pickup_at`,
    [soon],
  );
  const lateStart = await many(
    ctx.db,
    `select id, operator_id, driver_id, pickup_at, status from rides
      where status in ('driver_assigned') and pickup_at <= $1 order by pickup_at`,
    [new Date(now.getTime() + 10 * 60_000)],
  );
  const incidents = await many(ctx.db, `select * from incidents where status <> 'resolved' order by created_at`);
  const expiringDocs = await many(
    ctx.db,
    `select id, owner_type, owner_id, doc_type, expires_on from documents
      where status = 'approved' and expires_on is not null and expires_on <= ($1::date + 30) order by expires_on`,
    [now],
  );
  const pendingOperators = await many(ctx.db, `select id, trade_name, created_at from operators where status = 'pending' order by created_at`);
  return { expiringOffers, acceptedWithoutDriver: noDriver, notStartedNearPickup: lateStart, incidents, expiringDocs, pendingOperators };
}

/** Kerncijfers uit echte data. Geen schattingen. */
export async function platformStats(ctx: Ctx, from: Date, to: Date) {
  const byStatus = await many<{ status: string; n: number }>(
    ctx.db,
    'select status, count(*)::int as n from rides where created_at between $1 and $2 group by status order by status',
    [from, to],
  );
  const money = await many<{ entry_type: string; total: number }>(
    ctx.db,
    'select entry_type, coalesce(sum(amount_cents),0)::int as total from ledger_entries where created_at between $1 and $2 group by entry_type',
    [from, to],
  );
  const repeat = await one<{ customers: number; repeat_customers: number }>(
    ctx.db,
    `select count(*)::int as customers, count(*) filter (where n > 1)::int as repeat_customers
       from (select customer_id, count(*) n from rides where status = 'completed' and completed_at between $1 and $2 group by customer_id) x`,
    [from, to],
  );
  const bySource = await many(
    ctx.db,
    `select source, count(*)::int as rides from rides where status = 'completed' and completed_at between $1 and $2 group by source`,
    [from, to],
  );
  return { period: { from, to }, ridesByStatus: byStatus, money, customers: repeat, completedBySource: bySource };
}

/** Maakt uitbetalingen voor alle openstaande saldi en voert ze uit via de provider. */
export async function runPayouts(ctx: Ctx) {
  const balances = await many<{ operator_id: string; total: number; payout_account_ref: string | null }>(
    ctx.db,
    `select l.operator_id, sum(l.amount_cents)::int as total, o.payout_account_ref
       from ledger_entries l join operators o on o.id = l.operator_id
      where l.entry_type = 'operator_payable' and l.payout_id is null
      group by l.operator_id, o.payout_account_ref having sum(l.amount_cents) > 0`,
  );
  const results: { operatorId: string; amountCents: number; status: string; reason?: string }[] = [];
  for (const b of balances) {
    if (!b.payout_account_ref) {
      results.push({ operatorId: b.operator_id, amountCents: b.total, status: 'skipped', reason: 'geen uitbetalingsaccount' });
      continue;
    }
    try {
      await withTx(ctx.db, async (tx) => {
        const payout = await one<{ id: string }>(tx, `insert into payouts (operator_id, amount_cents, created_at) values ($1, $2, $3) returning id`, [
          b.operator_id,
          b.total,
          ctx.now(),
        ]);
        const marked = await tx.query(
          `update ledger_entries set payout_id = $1 where operator_id = $2 and entry_type = 'operator_payable' and payout_id is null`,
          [payout.id, b.operator_id],
        );
        const sum = await one<{ s: number }>(tx, 'select coalesce(sum(amount_cents),0)::int s from ledger_entries where payout_id = $1', [payout.id]);
        if (sum.s !== b.total || !marked.rowCount) throw conflict('payout_mismatch', 'Saldo wijzigde tijdens uitbetaling');
        const res = await ctx.payments.payout({ operatorAccountRef: b.payout_account_ref!, amountCents: b.total, payoutId: payout.id });
        await tx.query(`update payouts set status = 'paid', provider_ref = $2, paid_at = $3 where id = $1`, [payout.id, res.ref, ctx.now()]);
      });
      results.push({ operatorId: b.operator_id, amountCents: b.total, status: 'paid' });
    } catch (e) {
      // Niets geboekt (rollback); volgende run probeert opnieuw.
      results.push({ operatorId: b.operator_id, amountCents: b.total, status: 'failed', reason: (e as Error).message });
    }
  }
  return results;
}

export async function resolveIncident(ctx: Ctx, incidentId: string, resolution: string) {
  const r = await maybeOne(ctx.db, `update incidents set status = 'resolved', resolution = $2, resolved_at = $3 where id = $1 returning *`, [
    incidentId,
    resolution,
    ctx.now(),
  ]);
  if (!r) throw notFound('Incident niet gevonden');
  return r;
}
