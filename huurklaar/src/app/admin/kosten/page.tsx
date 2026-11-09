import Link from "next/link";
import { AdminAction } from "@/components/admin/AdminAction";
import { FixedCostForm } from "@/components/admin/FixedCostForm";
import { Shell } from "@/components/admin/Shell";
import { d, eur, int } from "@/lib/format";
import { overview, settings } from "@/lib/metrics";
import { can } from "@/lib/roles";
import { requirePage } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PERIODS = [7, 30, 90] as const;
const KIND: Record<string, string> = { listing_check: "Advertentie-check", inbound_extract: "Meldingen uitlezen" };

export default async function Costs({ searchParams }: { searchParams: Promise<{ dagen?: string }> }) {
  const staff = await requirePage("finance.view");
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.dagen) ?? 30;
  const [o, { data: fixed }] = await Promise.all([
    overview(days),
    supabaseAdmin().from("fixed_costs").select("*").order("starts_on", { ascending: false }),
  ]);
  const s = settings();
  const m = o.money;
  const edit = can(staff.role, "costs.edit");
  const today = new Date().toISOString().slice(0, 10);
  const activeMonthly = (fixed ?? []).filter((f) => f.starts_on <= today && (!f.ends_on || f.ends_on >= today)).reduce((a, f) => a + Number(f.monthly_eur), 0);
  const perCheck = o.ai.byKind.listing_check && o.ai.byKind.listing_check.calls > o.ai.byKind.listing_check.unpriced
    ? o.ai.byKind.listing_check.eur / (o.ai.byKind.listing_check.calls - o.ai.byKind.listing_check.unpriced) : null;

  return (
    <Shell staff={staff}>
      <div className="admin-head">
        <h1>Kos<em>ten</em></h1>
        <nav className="segmented" aria-label="Periode">
          {PERIODS.map((p) => <Link key={p} href={`/admin/kosten?dagen=${p}`} aria-current={p === days ? "true" : undefined}>{p} dagen</Link>)}
        </nav>
      </div>

      <section className="kpis">
        <div className="kpi dark"><span className="eyebrow">Totale kosten</span><b>{eur(m.costs)}</b><span className="small">laatste {days} dagen</span></div>
        <div className="kpi"><span className="eyebrow">AI (Anthropic)</span><b>{eur(m.aiEur)}</b><span className="small">{int(o.ai.calls)} aanroepen{perCheck != null ? ` · ${eur(perCheck, 4)} per check` : ""}</span></div>
        <div className="kpi"><span className="eyebrow">Stripe</span><b>{eur(m.stripeFeesEur)}</b><span className="small">{m.feesUnknown ? `${m.feesUnknown} nog onbekend` : "transactiekosten"}</span></div>
        <div className="kpi"><span className="eyebrow">Vaste kosten</span><b>{eur(m.fixedEur)}</b><span className="small">nu {eur(activeMonthly)} per maand</span></div>
      </section>

      {!o.pricesConfigured && (
        <p className="notice">
          AI-tarieven zijn niet ingesteld, dus AI-kosten tellen nog als € 0. Zet in je omgeving
          <code> AI_PRICES_USD</code> (bv. <code>model-naam=input:output</code> in dollar per miljoen tokens, van anthropic.com/pricing) en
          <code> USD_TO_EUR</code>. Het tokengebruik wordt wel al bijgehouden.
        </p>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2>AI per functie</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Functie</th><th className="r">Aanroepen</th><th className="r">Tokens in / uit</th><th className="r">Kost</th></tr></thead>
              <tbody>
                {Object.entries(o.ai.byKind).map(([k, v]) => (
                  <tr key={k}>
                    <td>{KIND[k] ?? k}</td>
                    <td className="r">{int(v.calls)}</td>
                    <td className="r num">{int(v.input)} / {int(v.output)}</td>
                    <td className="r">{v.unpriced === v.calls ? <span className="muted">geen tarief</span> : eur(v.eur, 2)}</td>
                  </tr>
                ))}
                {!Object.keys(o.ai.byKind).length && <tr><td colSpan={4} className="muted">Nog geen AI-gebruik in deze periode.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>AI per model</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Model</th><th className="r">Aanroepen</th><th className="r">Kost</th><th>Tarief (USD/MTok)</th></tr></thead>
              <tbody>
                {Object.entries(o.ai.byModel).map(([k, v]) => (
                  <tr key={k}>
                    <td><code>{k}</code></td>
                    <td className="r">{int(v.calls)}</td>
                    <td className="r">{v.eur == null ? <span className="muted">—</span> : eur(v.eur)}</td>
                    <td className="num">{s.prices[k] ? `${s.prices[k].inputPerMTok} / ${s.prices[k].outputPerMTok}` : <span className="pill warn">niet ingesteld</span>}</td>
                  </tr>
                ))}
                {!Object.keys(o.ai.byModel).length && <tr><td colSpan={4} className="muted">Nog geen AI-gebruik.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Vaste kosten</h2>
        <p className="small">Abonnementen en vaste uitgaven per maand. Ze worden per dag verdeeld over de gekozen periode.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Naam</th><th>Categorie</th><th className="r">Per maand</th><th>Vanaf</th><th>Tot</th><th /></tr></thead>
            <tbody>
              {(fixed ?? []).map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.category}</td>
                  <td className="r">{eur(Number(f.monthly_eur))}</td>
                  <td>{d(f.starts_on)}</td>
                  <td>{f.ends_on ? d(f.ends_on) : <span className="pill ok">loopt</span>}</td>
                  <td>
                    {edit && !f.ends_on && <AdminAction url={`/api/admin/costs/${f.id}`} method="PATCH" body={{ ends_on: today }} label="Stopzetten" done="Gestopt vanaf vandaag." />}
                    {edit && <AdminAction url={`/api/admin/costs/${f.id}`} method="DELETE" label="Verwijder" variant="danger" confirmText={`"${f.name}" verwijderen? Gebruik liever Stopzetten om de historiek te bewaren.`} done="Verwijderd." />}
                  </td>
                </tr>
              ))}
              {!(fixed ?? []).length && <tr><td colSpan={6} className="muted">Nog geen vaste kosten ingevoerd.</td></tr>}
            </tbody>
          </table>
        </div>
        {edit && <FixedCostForm />}
      </section>
    </Shell>
  );
}
