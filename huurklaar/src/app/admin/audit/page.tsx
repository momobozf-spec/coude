import Link from "next/link";
import { Shell } from "@/components/admin/Shell";
import { dt } from "@/lib/format";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PAGE = 100;

const LABEL: Record<string, string> = {
  "user.bonus": "Bonuschecks toegekend",
  "user.comp_dossier": "Gratis dossier gegeven",
  "user.revoke_dossier": "Gratis dossier ingetrokken",
  "user.block": "Account geblokkeerd",
  "user.unblock": "Account gedeblokkeerd",
  "user.delete": "Account gewist",
  "payment.refund": "Terugbetaling",
  "cost.create": "Vaste kost toegevoegd",
  "cost.end": "Vaste kost stopgezet",
  "cost.delete": "Vaste kost verwijderd",
  "team.set_role": "Rol toegekend",
  "team.remove": "Rol ingetrokken",
};

export default async function Audit({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const staff = await requirePage("audit.view");
  const page = Math.max(0, parseInt((await searchParams).p ?? "0", 10) || 0);
  const { data, count } = await supabaseAdmin().from("audit_log").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);

  return (
    <Shell staff={staff}>
      <div className="admin-head"><h1>Audit<em>log</em></h1><span className="pill">{count ?? 0} acties</span></div>
      <p className="small">Elke beheeractie wordt hier vastgelegd. Het log kan niet gewijzigd of gewist worden, ook niet door de eigenaar.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Wanneer</th><th>Wie</th><th>Actie</th><th>Op</th><th>Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }}>{dt(a.created_at)}</td>
                <td>{a.actor_email ?? "—"}</td>
                <td>{LABEL[a.action] ?? a.action}</td>
                <td>{a.target_user_id ? <Link href={`/admin/gebruikers/${a.target_user_id}`}>{a.target_email ?? "account"}</Link> : (a.target_email ?? "—")}</td>
                <td><code style={{ fontSize: 12, overflowWrap: "anywhere" }}>{Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : ""}</code></td>
              </tr>
            ))}
            {!(data ?? []).length && <tr><td colSpan={5} className="muted">Nog geen acties.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="btns">
        {page > 0 && <Link className="btn btn-ghost btn-sm" href={`/admin/audit?p=${page - 1}`}>← Nieuwer</Link>}
        {(page + 1) * PAGE < (count ?? 0) && <Link className="btn btn-ghost btn-sm" href={`/admin/audit?p=${page + 1}`}>Ouder →</Link>}
      </div>
    </Shell>
  );
}
