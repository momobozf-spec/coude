import { AdminAction } from "@/components/admin/AdminAction";
import { Shell } from "@/components/admin/Shell";
import { TeamForm } from "@/components/admin/TeamForm";
import { d } from "@/lib/format";
import { isRole, PERMISSIONS, ROLE_INFO, ROLE_LABEL, ROLES, can } from "@/lib/roles";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PERM_LABEL: Record<(typeof PERMISSIONS)[number], string> = {
  "dashboard.view": "Overzicht bekijken",
  "finance.view": "Financiën bekijken",
  "costs.edit": "Vaste kosten beheren",
  "users.view": "Gebruikers bekijken",
  "users.support": "Bonuschecks / gratis toegang",
  "users.block": "Accounts blokkeren",
  "payments.refund": "Terugbetalen",
  "users.delete": "Accounts wissen",
  "team.manage": "Team beheren",
  "audit.view": "Auditlog bekijken",
};

export default async function Team() {
  const staff = await requirePage("team.manage");
  const db = supabaseAdmin();
  const { data: roles } = await db.from("staff_roles").select("user_id, role, created_at").order("created_at");
  const ids = (roles ?? []).map((r) => r.user_id);
  const { data: people } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));

  return (
    <Shell staff={staff}>
      <div className="admin-head"><h1>Team en <em>rollen</em></h1></div>

      <section className="panel">
        <h2>Teamleden</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>E-mail</th><th>Rol</th><th>Sinds</th><th /></tr></thead>
            <tbody>
              {(roles ?? []).map((r) => (
                <tr key={r.user_id}>
                  <td>{emailOf.get(r.user_id) ?? r.user_id}{r.user_id === staff.userId && <span className="pill" style={{ marginLeft: 8 }}>jij</span>}</td>
                  <td><span className="pill accent">{isRole(r.role) ? ROLE_LABEL[r.role] : r.role}</span></td>
                  <td>{d(r.created_at)}</td>
                  <td>
                    {r.user_id !== staff.userId && (
                      <AdminAction url="/api/admin/team" method="DELETE" body={{ userId: r.user_id }} label="Rol intrekken" variant="danger"
                        confirmText={`${emailOf.get(r.user_id) ?? "Dit teamlid"} verliest meteen alle toegang tot het beheer.`} done="Ingetrokken." />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TeamForm />
      </section>

      <section className="panel">
        <h2>Wat mag elke rol?</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Recht</th>{ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <td>{PERM_LABEL[p]}</td>
                  {ROLES.map((r) => <td key={r} aria-label={can(r, p) ? "ja" : "nee"}>{can(r, p) ? <span className="pill ok">✓</span> : <span className="muted">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="plain">{ROLES.map((r) => <li key={r}><strong>{ROLE_LABEL[r]}:</strong> {ROLE_INFO[r]}</li>)}</ul>
      </section>
    </Shell>
  );
}
