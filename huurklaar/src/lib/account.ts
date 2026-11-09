import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export interface Account {
  userId: string;
  email: string | null;
  dossierPaid: boolean;
  zoekpasActive: boolean;
  zoekpasStatus: string | null;
  zoekpasPeriodEnd: string | null;
  zoekpasCancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  checksUsed: number;
  bonusChecks: number;
}

const ACTIVE = new Set(["active", "trialing"]);

/** Huidige gebruiker en rechten, of null als niemand is ingelogd. */
export async function getAccount(): Promise<Account | null> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: p }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("listing_checks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const periodEnd = p?.zoekpas_period_end ?? null;
  const zoekpasActive =
    !!p?.zoekpas_status && ACTIVE.has(p.zoekpas_status) && (!periodEnd || new Date(periodEnd).getTime() > Date.now());

  return {
    userId: user.id,
    email: user.email ?? null,
    dossierPaid: !!p?.dossier_paid_at || !!p?.dossier_comp,
    zoekpasActive,
    zoekpasStatus: p?.zoekpas_status ?? null,
    zoekpasPeriodEnd: periodEnd,
    zoekpasCancelAtPeriodEnd: !!p?.zoekpas_cancel_at_period_end,
    stripeCustomerId: p?.stripe_customer_id ?? null,
    checksUsed: count ?? 0,
    bonusChecks: p?.bonus_checks ?? 0,
  };
}

/** Mag deze gebruiker de dossier-PDF maken? */
export function canExportPdf(a: Account | null): boolean {
  return !!a && (a.dossierPaid || a.zoekpasActive);
}
