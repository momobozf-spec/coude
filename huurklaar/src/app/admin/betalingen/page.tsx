import Link from "next/link";
import { AdminAction } from "@/components/admin/AdminAction";
import { Shell } from "@/components/admin/Shell";
import { exVat } from "@/lib/costs";
import { dt, eur } from "@/lib/format";
import { settings } from "@/lib/metrics";
import { can } from "@/lib/roles";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function Payments({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const staff = await requirePage("finance.view");
  const page = Math.max(0, parseInt((await searchParams).p ?? "0", 10) || 0);
  const db = supabaseAdmin();
  const { data, count } = await db.from("payments").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const showPeople = can(staff.role, "users.view");
  const { data: people } = showPeople && ids.length
    ? await db.from("profiles").select("id, email").in("id", ids)
    : { data: [] as { id: string; email: string | null }[] };
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));
  const { vat } = settings();

  return (
    <Shell staff={staff}>
      <div className="admin-head">
        <h1>Betalin<em>gen</em></h1>
        <span className="pill">{count ?? 0} in totaal</span>
      </div>
      <p className="small">Bedragen incl. btw zoals betaald, plus het deel zonder btw ({vat}%) en de Stripe-kosten. Facturen en uitbetalingen vind je in het Stripe-dashboard.</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Datum</th>{showPeople && <th>Klant</th>}<th>Product</th><th className="r">Bruto</th><th className="r">Excl. btw</th><th className="r">Stripe</th><th className="r">Terug</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const net = x.amount_cents - x.refunded_cents;
              return (
                <tr key={x.charge_id}>
                  <td>{dt(x.created_at)}</td>
                  {showPeople && <td>{x.user_id ? <Link href={`/admin/gebruikers/${x.user_id}`}>{emailOf.get(x.user_id) ?? "account"}</Link> : <span className="muted">gewist</span>}</td>}
                  <td>{x.product}</td>
                  <td className="r">{eur(x.amount_cents / 100)}</td>
                  <td className="r">{eur(exVat(net, vat) / 100)}</td>
                  <td className="r">{x.fee_cents == null ? <span className="muted">nog onbekend</span> : eur(x.fee_cents / 100)}</td>
                  <td className="r">{x.refunded_cents ? eur(x.refunded_cents / 100) : "—"}</td>
                  <td><span className={`pill ${x.status === "succeeded" ? "ok" : "warn"}`}>{x.status}</span></td>
                  <td>
                    {can(staff.role, "payments.refund") && net > 0 && (
                      <AdminAction url={`/api/admin/payments/${x.charge_id}/refund`} label="Terugbetalen" variant="danger"
                        confirmText={`${eur(net / 100)} terugbetalen via Stripe en de bijhorende toegang intrekken.`} done="Terugbetaling aangevraagd." />
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={9} className="muted">Nog geen betalingen. Ze verschijnen hier zodra de Stripe-webhook ze doorstuurt.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="btns">
        {page > 0 && <Link className="btn btn-ghost btn-sm" href={`/admin/betalingen?p=${page - 1}`}>← Vorige</Link>}
        {(page + 1) * PAGE < (count ?? 0) && <Link className="btn btn-ghost btn-sm" href={`/admin/betalingen?p=${page + 1}`}>Volgende →</Link>}
      </div>
    </Shell>
  );
}
