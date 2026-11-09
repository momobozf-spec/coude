import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/AdminAction";
import { Shell } from "@/components/admin/Shell";
import { dt, eur, int } from "@/lib/format";
import { can, ROLE_LABEL, isRole } from "@/lib/roles";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage("users.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabaseAdmin();

  const [{ data: p }, { data: authUser }, checks, apps, matches, { data: pays }, { data: role }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.auth.admin.getUserById(id),
    db.from("listing_checks").select("id", { count: "exact", head: true }).eq("user_id", id),
    db.from("applications").select("id", { count: "exact", head: true }).eq("user_id", id),
    db.from("matches").select("id", { count: "exact", head: true }).eq("user_id", id),
    can(staff.role, "finance.view")
      ? db.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
    db.from("staff_roles").select("role").eq("user_id", id).maybeSingle(),
  ]);
  if (!p) notFound();

  const u = authUser?.user;
  const banned = !!u?.banned_until && new Date(u.banned_until) > new Date();
  const zoek = ["active", "trialing"].includes(p.zoekpas_status ?? "");
  const api = `/api/admin/users/${id}`;
  const isSelf = id === staff.userId;

  return (
    <Shell staff={staff}>
      <Link href="/admin/gebruikers" className="small">← Alle gebruikers</Link>
      <div className="admin-head">
        <h1 style={{ overflowWrap: "anywhere" }}>{p.email ?? id}</h1>
        <div className="btns">
          {banned && <span className="pill bad">Geblokkeerd</span>}
          {role && isRole(role.role) && <span className="pill accent">Team: {ROLE_LABEL[role.role]}</span>}
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Account</h2>
          <div className="kv">
            <div><span>Aangemaakt</span><b>{dt(p.created_at)}</b></div>
            <div><span>Laatst ingelogd</span><b>{dt(u?.last_sign_in_at)}</b></div>
            <div><span>Dossier Klaar</span><b>{p.dossier_paid_at ? `betaald ${dt(p.dossier_paid_at)}` : p.dossier_comp ? "gratis toegekend" : "nee"}</b></div>
            <div><span>Zoekpas</span><b>{p.zoekpas_status ?? "nooit"}{zoek && p.zoekpas_period_end ? ` tot ${dt(p.zoekpas_period_end)}` : ""}</b></div>
            {p.zoekpas_cancel_at_period_end && <div><span /><span className="pill warn">Opgezegd, loopt af</span></div>}
            <div><span>Advertentie-checks</span><b>{int(checks.count ?? 0)}</b></div>
            <div><span>Bonuschecks</span><b>{int(p.bonus_checks)}</b></div>
            <div><span>Matches / kandidaturen</span><b>{int(matches.count ?? 0)} / {int(apps.count ?? 0)}</b></div>
            {can(staff.role, "finance.view") && <div><span>Stripe-klant</span><b>{p.stripe_customer_id ?? "—"}</b></div>}
          </div>
          <p className="small">Dossiergegevens en bijlagen staan alleen op het toestel van de klant. Die kan niemand van het team zien.</p>
        </section>

        <section className="panel">
          <h2>Acties</h2>
          {can(staff.role, "users.support") && (
            <>
              <div className="btns">
                <AdminAction url={api} body={{ action: "bonus", amount: 3 }} label="+3 bonuschecks" done="3 bonuschecks toegekend." />
                <AdminAction url={api} body={{ action: "bonus", amount: 10 }} label="+10 bonuschecks" done="10 bonuschecks toegekend." />
              </div>
              {p.dossier_comp
                ? <AdminAction url={api} body={{ action: "revoke_dossier" }} label="Gratis dossier intrekken" confirmText="De gratis toegang tot de dossier-PDF wordt ingetrokken." done="Ingetrokken." />
                : !p.dossier_paid_at && <AdminAction url={api} body={{ action: "comp_dossier" }} label="Dossier Klaar gratis geven" done="Toegekend." />}
            </>
          )}
          {can(staff.role, "users.block") && !isSelf && (
            banned
              ? <AdminAction url={api} body={{ action: "unblock" }} label="Deblokkeren" done="Gedeblokkeerd." />
              : <AdminAction url={api} body={{ action: "block" }} label="Account blokkeren" variant="danger"
                  confirmText="De gebruiker kan niet meer inloggen tot je deblokkeert. Lopende abonnementen blijven doorlopen; zeg die apart op in Stripe." done="Geblokkeerd." />
          )}
          {can(staff.role, "users.delete") && !isSelf && (
            <AdminAction url={api} method="DELETE" label="Account definitief wissen" variant="danger" typeToConfirm={p.email ?? id}
              confirmText="Wist het account, matches, kandidaturen en tellers. Een lopende Zoekpas wordt meteen opgezegd. Betalingen blijven bewaard voor de boekhouding (zonder koppeling). Dit kan niet ongedaan gemaakt worden."
              done="Account gewist." />
          )}
          {!can(staff.role, "users.support") && <p className="small">Je rol kan hier niets wijzigen.</p>}
        </section>
      </div>

      {pays && (
        <section className="panel">
          <h2>Betalingen</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Datum</th><th>Product</th><th className="r">Bedrag</th><th className="r">Terugbetaald</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pays.map((x) => (
                  <tr key={x.charge_id}>
                    <td>{dt(x.created_at)}</td>
                    <td>{x.product}</td>
                    <td className="r">{eur(x.amount_cents / 100)}</td>
                    <td className="r">{x.refunded_cents ? eur(x.refunded_cents / 100) : "—"}</td>
                    <td><span className={`pill ${x.status === "succeeded" ? "ok" : "warn"}`}>{x.status}</span></td>
                    <td>
                      {can(staff.role, "payments.refund") && x.refunded_cents < x.amount_cents && (
                        <AdminAction url={`/api/admin/payments/${x.charge_id}/refund`} label="Terugbetalen" variant="danger"
                          confirmText={`${eur((x.amount_cents - x.refunded_cents) / 100)} terugbetalen via Stripe en de toegang intrekken.`} done="Terugbetaling aangevraagd." />
                      )}
                    </td>
                  </tr>
                ))}
                {!pays.length && <tr><td colSpan={6} className="muted">Geen betalingen.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}
