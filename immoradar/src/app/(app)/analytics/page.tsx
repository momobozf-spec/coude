import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { getAnalytics } from "@/repositories/analytics";
import { humanize } from "@/lib/format";
import { PageHeader, Section, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = { FSBO: "FSBO", LEADREVIVE: "LeadRevive", STALE: "Stale", PRICE_DROP: "Price Drop", RELIST: "Relist", CRM_MARKET_MATCH: "CRM + Market Match" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const days = [30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 90;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const a = await getAnalytics(db, ctx, { from, to });
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const row = (r: { detected: number; contacted: number; valuationsBooked: number; mandatesProposed: number; mandatesWon: number; conversionRate: number }) => (
    <>
      <td className="tabular-nums">{r.detected}</td>
      <td className="tabular-nums">{r.contacted}</td>
      <td className="tabular-nums">{r.valuationsBooked}</td>
      <td className="tabular-nums">{r.mandatesProposed}</td>
      <td className="tabular-nums">{r.mandatesWon}</td>
      <td className="tabular-nums">{pct(r.conversionRate)}</td>
    </>
  );
  return (
    <>
      <PageHeader
        title="Management Analytics"
        subtitle="Funnel based strictly on the recorded opportunity lifecycle. Conversion = mandates won / opportunities detected in the period."
        actions={
          <div className="flex gap-1 rounded-md border border-ink-300 p-0.5 text-sm">
            {[30, 90, 365].map((d) => (
              <a key={d} href={`/analytics?days=${d}`} className={`rounded px-3 py-1 ${days === d ? "bg-ink-900 text-white" : "text-ink-700"}`}>{d}d</a>
            ))}
          </div>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Detected" value={a.totals.detected} />
        <Stat label="Contacted" value={a.totals.contacted} />
        <Stat label="Valuations booked" value={a.totals.valuationsBooked} />
        <Stat label="Mandates proposed" value={a.totals.mandatesProposed} />
        <Stat label="Mandates won" value={a.totals.mandatesWon} />
        <Stat label="Conversion rate" value={pct(a.totals.conversionRate)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="By opportunity source">
          <table className="table">
            <thead><tr><th>Category</th><th>Detected</th><th>Contacted</th><th>Valuations</th><th>Proposed</th><th>Won</th><th>Conv.</th></tr></thead>
            <tbody>
              {a.byCategory.map((c) => (
                <tr key={c.category}><td className="font-medium">{CATEGORY_LABELS[c.category] ?? humanize(c.category)}</td>{row(c)}</tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="By agent">
          <table className="table">
            <thead><tr><th>Agent</th><th>Detected</th><th>Contacted</th><th>Valuations</th><th>Proposed</th><th>Won</th><th>Conv.</th></tr></thead>
            <tbody>
              {a.byAgent.map((u) => (
                <tr key={u.userId}><td className="font-medium">{u.name}</td>{row(u)}</tr>
              ))}
              {!a.byAgent.length ? <tr><td colSpan={7} className="text-center text-ink-500">No assigned opportunities in this period.</td></tr> : null}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}
