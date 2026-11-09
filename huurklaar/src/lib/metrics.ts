import "server-only";
import { fixedCostsInPeriod, parsePrices, sumPayments, tokenCostEur, type FixedCost } from "@/lib/costs";
import { supabaseAdmin } from "@/lib/supabase/server";

const ROW_CAP = 20_000;

export function settings() {
  const usd = Number(process.env.USD_TO_EUR ?? "");
  return {
    prices: parsePrices(process.env.AI_PRICES_USD),
    usdToEur: Number.isFinite(usd) && usd > 0 ? usd : 0,
    vat: Number(process.env.VAT_RATE_PCT ?? "21") || 21,
  };
}

export function periodFrom(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - (days - 1) * 86_400_000);
  return { from, to };
}

type AiRow = { model: string; kind: string; input_tokens: number; output_tokens: number; created_at: string; user_id: string | null };
type PayRow = { amount_cents: number; refunded_cents: number; fee_cents: number | null; product: string; created_at: string; user_id: string | null };

export async function overview(days: number) {
  const db = supabaseAdmin();
  const { from, to } = periodFrom(days);
  const since = from.toISOString();
  const s = settings();

  const [
    usersTotal, usersNew, zoekpas, dossierOwners,
    { data: pays }, { data: ai }, { data: fixed }, { data: checks }, inbound,
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("profiles").select("id", { count: "exact", head: true }).in("zoekpas_status", ["active", "trialing"]).gt("zoekpas_period_end", to.toISOString()),
    db.from("profiles").select("id", { count: "exact", head: true }).or("dossier_paid_at.not.is.null,dossier_comp.eq.true"),
    db.from("payments").select("amount_cents, refunded_cents, fee_cents, product, created_at, user_id").gte("created_at", since).limit(ROW_CAP),
    db.from("ai_usage").select("model, kind, input_tokens, output_tokens, created_at, user_id").gte("created_at", since).limit(ROW_CAP),
    db.from("fixed_costs").select("monthly_eur, starts_on, ends_on"),
    db.from("listing_checks").select("user_id, created_at").gte("created_at", since).limit(ROW_CAP),
    db.from("inbound_mails").select("id", { count: "exact", head: true }).gte("received_at", since),
  ]);

  const payRows = (pays ?? []) as PayRow[];
  const aiRows = (ai ?? []) as AiRow[];
  const fixedRows = (fixed ?? []) as FixedCost[];
  const money = sumPayments(payRows, s.vat);

  let aiEur = 0;
  let aiUnpriced = 0;
  const byKind: Record<string, { calls: number; input: number; output: number; eur: number; unpriced: number }> = {};
  const byModel: Record<string, { calls: number; input: number; output: number; eur: number | null }> = {};
  for (const r of aiRows) {
    const c = tokenCostEur(r.model, r.input_tokens, r.output_tokens, s.prices, s.usdToEur);
    const k = (byKind[r.kind] ??= { calls: 0, input: 0, output: 0, eur: 0, unpriced: 0 });
    const m = (byModel[r.model] ??= { calls: 0, input: 0, output: 0, eur: 0 });
    k.calls++; k.input += r.input_tokens; k.output += r.output_tokens;
    m.calls++; m.input += r.input_tokens; m.output += r.output_tokens;
    if (c == null) { aiUnpriced++; k.unpriced++; m.eur = null; }
    else { aiEur += c; k.eur += c; if (m.eur != null) m.eur += c; }
  }

  const fixedEur = fixedCostsInPeriod(fixedRows, from, to);
  const costs = money.stripeFeesEur + aiEur + fixedEur;
  const margin = money.revenueExVatEur - costs;

  // Funnel: unieke gebruikers per stap in de periode.
  const checkers = new Set((checks ?? []).map((c) => c.user_id));
  const payers = new Set(payRows.filter((p) => p.amount_cents > p.refunded_cents && p.user_id).map((p) => p.user_id));

  // Per dag
  const daysList: { day: string; revenue: number; costs: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    daysList.push({ day: d.toISOString().slice(0, 10), revenue: 0, costs: fixedCostsInPeriod(fixedRows, d, new Date(d.getTime() + 86_400_000)) });
  }
  const idx = (iso: string) => Math.floor((new Date(iso).getTime() - from.getTime()) / 86_400_000);
  for (const p of payRows) {
    const i = idx(p.created_at);
    if (i < 0 || i >= days) continue;
    daysList[i].revenue += (p.amount_cents - p.refunded_cents) / (1 + s.vat / 100) / 100;
    daysList[i].costs += (p.fee_cents ?? 0) / 100;
  }
  for (const r of aiRows) {
    const i = idx(r.created_at);
    const c = tokenCostEur(r.model, r.input_tokens, r.output_tokens, s.prices, s.usdToEur);
    if (i >= 0 && i < days && c != null) daysList[i].costs += c;
  }

  const byProduct = { dossier: 0, zoekpas: 0, onbekend: 0 } as Record<string, number>;
  for (const p of payRows) byProduct[p.product] = (byProduct[p.product] ?? 0) + (p.amount_cents - p.refunded_cents) / (1 + s.vat / 100) / 100;

  return {
    from, to, days,
    users: { total: usersTotal.count ?? 0, new: usersNew.count ?? 0, zoekpasActive: zoekpas.count ?? 0, dossierOwners: dossierOwners.count ?? 0 },
    money: { ...money, aiEur, aiUnpriced, fixedEur, costs, margin, byProduct, payments: payRows.length },
    ai: { byKind, byModel, calls: aiRows.length },
    activity: { checks: checks?.length ?? 0, inbound: inbound.count ?? 0 },
    funnel: { signups: usersNew.count ?? 0, checked: checkers.size, paid: payers.size },
    series: daysList,
    truncated: payRows.length >= ROW_CAP || aiRows.length >= ROW_CAP || (checks?.length ?? 0) >= ROW_CAP,
    pricesConfigured: Object.keys(s.prices).length > 0 && s.usdToEur > 0,
  };
}
export type Overview = Awaited<ReturnType<typeof overview>>;
