import Link from "next/link";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { Shell } from "@/components/admin/Shell";
import { eur, int, pct } from "@/lib/format";
import { overview } from "@/lib/metrics";
import { can } from "@/lib/roles";
import { requirePage } from "@/lib/staff";

export const dynamic = "force-dynamic";
const PERIODS = [7, 30, 90] as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ dagen?: string; "geen-toegang"?: string }> }) {
  const staff = await requirePage("dashboard.view");
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.dagen) ?? 30;
  const o = await overview(days);
  const fin = can(staff.role, "finance.view");
  const m = o.money;

  return (
    <Shell staff={staff}>
      <div className="admin-head">
        <h1>Over<em>zicht</em></h1>
        <nav className="segmented" aria-label="Periode">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin?dagen=${p}`} aria-current={p === days ? "true" : undefined}>{p} dagen</Link>
          ))}
        </nav>
      </div>
      {sp["geen-toegang"] && <p className="notice">Je rol heeft geen toegang tot die pagina.</p>}
      {o.truncated && <p className="notice">Er zijn meer dan 20.000 rijen in deze periode; de cijfers zijn afgekapt. Tijd voor een zwaardere rapportering.</p>}

      {fin && (
        <section className="kpis" aria-label="Financiën">
          <div className="kpi dark">
            <span className="eyebrow">Omzet excl. btw</span>
            <b>{eur(m.revenueExVatEur)}</b>
            <span className="small">{int(m.payments)} betalingen · btw {eur(m.vatEur)}</span>
          </div>
          <div className="kpi">
            <span className="eyebrow">Kosten</span>
            <b>{eur(m.costs)}</b>
            <span className="small">Stripe {eur(m.stripeFeesEur)} · AI {eur(m.aiEur)} · vast {eur(m.fixedEur)}</span>
          </div>
          <div className="kpi">
            <span className="eyebrow">Marge</span>
            <b style={{ color: m.margin < 0 ? "var(--bad)" : undefined }}>{eur(m.margin)}</b>
            <span className="small">{m.revenueExVatEur > 0 ? `${pct(m.margin, m.revenueExVatEur)} van de omzet` : "Nog geen omzet"}</span>
          </div>
          <div className="kpi">
            <span className="eyebrow">Terugbetaald</span>
            <b>{eur(m.refundedEur)}</b>
            <span className="small">incl. btw</span>
          </div>
        </section>
      )}
      {fin && (m.aiUnpriced > 0 || m.feesUnknown > 0) && (
        <p className="notice">
          Onvolledig:{" "}
          {m.aiUnpriced > 0 && <>{int(m.aiUnpriced)} AI-aanroepen zonder ingesteld tarief (zet <code>AI_PRICES_USD</code> en <code>USD_TO_EUR</code>). </>}
          {m.feesUnknown > 0 && <>{int(m.feesUnknown)} betalingen waarvan Stripe de kosten nog niet doorgaf.</>}
        </p>
      )}

      <section className="kpis" aria-label="Gebruikers">
        <div className="kpi"><span className="eyebrow">Nieuwe accounts</span><b>{int(o.users.new)}</b><span className="small">{int(o.users.total)} in totaal</span></div>
        <div className="kpi"><span className="eyebrow">Actieve Zoekpassen</span><b>{int(o.users.zoekpasActive)}</b><span className="small">nu</span></div>
        <div className="kpi"><span className="eyebrow">Dossier Klaar</span><b>{int(o.users.dossierOwners)}</b><span className="small">accounts met toegang</span></div>
        <div className="kpi"><span className="eyebrow">Advertentie-checks</span><b>{int(o.activity.checks)}</b><span className="small">{int(o.activity.inbound)} meldingsmails verwerkt</span></div>
      </section>

      <div className="grid-2">
        {fin && (
          <section className="panel">
            <h2>Omzet en kosten per dag</h2>
            <RevenueChart series={o.series} />
          </section>
        )}
        <section className="panel">
          <h2>Trechter</h2>
          <p className="small">Unieke accounts in de laatste {days} dagen.</p>
          <div className="funnel">
            {[
              ["Nieuw account", o.funnel.signups],
              ["Advertentie gecheckt", o.funnel.checked],
              ["Betaald", o.funnel.paid],
            ].map(([label, n]) => (
              <div className="funnel-row" key={label as string}>
                <span>{label}</span>
                <span className="bar"><i style={{ width: o.funnel.signups ? `${Math.min(100, ((n as number) / o.funnel.signups) * 100)}%` : "0%" }} /></span>
                <span className="r num">{int(n as number)}</span>
              </div>
            ))}
          </div>
          <p className="small">Conversie account → betaald: {pct(o.funnel.paid, o.funnel.signups)}. Betalers kunnen ook van vóór deze periode zijn.</p>
          {fin && (
            <div className="kv">
              <div><span>Omzet Dossier Klaar</span><b>{eur(m.byProduct.dossier ?? 0)}</b></div>
              <div><span>Omzet Zoekpas</span><b>{eur(m.byProduct.zoekpas ?? 0)}</b></div>
              {(m.byProduct.onbekend ?? 0) > 0 && <div><span>Niet toe te wijzen</span><b>{eur(m.byProduct.onbekend)}</b></div>}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
