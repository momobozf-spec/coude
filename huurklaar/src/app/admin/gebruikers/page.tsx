import Link from "next/link";
import { Shell } from "@/components/admin/Shell";
import { d } from "@/lib/format";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PAGE = 50;

const FILTERS = {
  alle: "Alle",
  zoekpas: "Zoekpas",
  dossier: "Dossier Klaar",
  gratis: "Gratis",
} as const;
type Filter = keyof typeof FILTERS;

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string }> }) {
  const staff = await requirePage("users.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const f: Filter = (sp.f && sp.f in FILTERS ? sp.f : "alle") as Filter;
  const page = Math.max(0, parseInt(sp.p ?? "0", 10) || 0);

  let query = supabaseAdmin()
    .from("profiles")
    .select("id, email, created_at, dossier_paid_at, dossier_comp, zoekpas_status, zoekpas_period_end, bonus_checks", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (f === "zoekpas") query = query.in("zoekpas_status", ["active", "trialing"]);
  if (f === "dossier") query = query.or("dossier_paid_at.not.is.null,dossier_comp.eq.true");
  if (f === "gratis") query = query.is("dossier_paid_at", null).eq("dossier_comp", false).or("zoekpas_status.is.null,zoekpas_status.not.in.(active,trialing)");
  const { data, count } = await query;
  const rows = data ?? [];
  const total = count ?? 0;
  const link = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), f, p: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/admin/gebruikers?${p}`;
  };

  return (
    <Shell staff={staff}>
      <div className="admin-head">
        <h1>Gebrui<em>kers</em></h1>
        <span className="pill">{total} gevonden</span>
      </div>
      <form className="searchbar" role="search" action="/admin/gebruikers">
        <label htmlFor="q" className="skip">Zoek op e-mail</label>
        <input id="q" name="q" defaultValue={q} placeholder="Zoek op e-mailadres…" autoComplete="off" />
        <input type="hidden" name="f" value={f} />
        <button className="btn btn-primary btn-sm" type="submit">Zoek</button>
      </form>
      <nav className="segmented" aria-label="Filter" style={{ justifySelf: "start" }}>
        {(Object.keys(FILTERS) as Filter[]).map((k) => (
          <Link key={k} href={link({ f: k, p: 0 })} aria-current={k === f ? "true" : undefined}>{FILTERS[k]}</Link>
        ))}
      </nav>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>E-mail</th><th>Plan</th><th>Account sinds</th><th className="r">Bonuschecks</th></tr></thead>
          <tbody>
            {rows.map((u) => {
              const zoek = ["active", "trialing"].includes(u.zoekpas_status ?? "") && (!u.zoekpas_period_end || new Date(u.zoekpas_period_end) > new Date());
              return (
                <tr key={u.id}>
                  <td><Link href={`/admin/gebruikers/${u.id}`}>{u.email ?? u.id}</Link></td>
                  <td>
                    {zoek ? <span className="pill ok">Zoekpas</span>
                      : u.dossier_paid_at ? <span className="pill accent">Dossier Klaar</span>
                      : u.dossier_comp ? <span className="pill warn">Dossier (gratis)</span>
                      : <span className="pill">Gratis</span>}
                  </td>
                  <td>{d(u.created_at)}</td>
                  <td className="r num">{u.bonus_checks}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={4} className="muted">Geen gebruikers gevonden.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="btns">
        {page > 0 && <Link className="btn btn-ghost btn-sm" href={link({ p: page - 1 })}>← Vorige</Link>}
        {(page + 1) * PAGE < total && <Link className="btn btn-ghost btn-sm" href={link({ p: page + 1 })}>Volgende →</Link>}
      </div>
    </Shell>
  );
}
