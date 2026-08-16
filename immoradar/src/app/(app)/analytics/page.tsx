import { requireAgencyUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AnalyticsService, type FunnelMetrics } from "@/services/analytics-service";
import { Card, PageHeader, typeLabel } from "../ui";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireAgencyUser();
  const analytics = new AnalyticsService(prisma);
  const funnel = await analytics.agencyFunnel(user.agencyId);

  const stages = [
    { key: "detected", label: "Detected" },
    { key: "contacted", label: "Contacted" },
    { key: "valuationsBooked", label: "Valuations booked" },
    { key: "mandatesProposed", label: "Mandates proposed" },
    { key: "mandatesWon", label: "Mandates won" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Acquisition funnel — conversion is measured only from recorded lifecycle transitions"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {stages.map((stage) => (
          <Card key={stage.key} className="text-center">
            <div className="text-2xl font-bold text-slate-900">{funnel.overall[stage.key]}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{stage.label}</div>
          </Card>
        ))}
        <Card className="text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {funnel.overall.conversionRate !== null ? `${funnel.overall.conversionRate}%` : "—"}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">Won / contacted</div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">By opportunity source</div>
          <FunnelTable
            rows={funnel.byType.map((r) => ({ label: typeLabel(r.type), metrics: r.metrics }))}
          />
        </Card>
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">By agent</div>
          {funnel.byAgent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No assigned opportunities yet.</p>
          ) : (
            <FunnelTable rows={funnel.byAgent.map((r) => ({ label: r.agentName, metrics: r.metrics }))} />
          )}
        </Card>
      </div>
    </>
  );
}

function FunnelTable({ rows }: { rows: { label: string; metrics: FunnelMetrics }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="px-4 py-2"> </th>
          <th className="px-2 py-2 text-right">Detected</th>
          <th className="px-2 py-2 text-right">Contacted</th>
          <th className="px-2 py-2 text-right">Valuations</th>
          <th className="px-2 py-2 text-right">Proposed</th>
          <th className="px-2 py-2 text-right">Won</th>
          <th className="px-4 py-2 text-right">Conv.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="px-4 py-2 font-medium text-slate-700">{row.label}</td>
            <td className="px-2 py-2 text-right">{row.metrics.detected}</td>
            <td className="px-2 py-2 text-right">{row.metrics.contacted}</td>
            <td className="px-2 py-2 text-right">{row.metrics.valuationsBooked}</td>
            <td className="px-2 py-2 text-right">{row.metrics.mandatesProposed}</td>
            <td className="px-2 py-2 text-right font-semibold text-emerald-600">{row.metrics.mandatesWon}</td>
            <td className="px-4 py-2 text-right text-slate-500">
              {row.metrics.conversionRate !== null ? `${row.metrics.conversionRate}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
