import { requirePlatformAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Badge, Card, PageHeader, timeAgo } from "../../ui";

export const dynamic = "force-dynamic";

export default async function CollectorHealthPage() {
  await requirePlatformAdmin();
  const runs = await prisma.collectorRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { source: { select: { name: true, code: true } } },
  });

  const bySource = new Map<string, { total: number; failed: number }>();
  for (const run of runs) {
    const entry = bySource.get(run.source.code) ?? { total: 0, failed: 0 };
    entry.total++;
    if (run.status === "FAILED") entry.failed++;
    bySource.set(run.source.code, entry);
  }

  return (
    <>
      <PageHeader title="Collector Health" subtitle="Recent collector runs across all sources" />
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...bySource.entries()].map(([code, stats]) => (
          <Card key={code} className="text-center">
            <div className="text-sm font-semibold text-slate-700">{code}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {Math.round(((stats.total - stats.failed) / stats.total) * 100)}%
            </div>
            <div className="text-xs text-slate-400">success over last {stats.total} runs</div>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Found</th>
              <th className="px-4 py-3 text-right">New</th>
              <th className="px-4 py-3 text-right">Updated</th>
              <th className="px-4 py-3 text-right">Errors</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-700">{run.source.name}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={run.status === "SUCCESS" ? "green" : run.status === "FAILED" ? "red" : run.status === "PARTIAL" ? "amber" : "slate"}>
                    {run.status}
                  </Badge>
                  {run.errorMessage ? <div className="mt-0.5 text-xs text-red-500">{run.errorMessage}</div> : null}
                </td>
                <td className="px-4 py-2.5 text-right">{run.listingsFound}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600">{run.listingsNew}</td>
                <td className="px-4 py-2.5 text-right">{run.listingsUpdated}</td>
                <td className="px-4 py-2.5 text-right text-red-600">{run.errorCount}</td>
                <td className="px-4 py-2.5 text-right text-slate-500">{run.durationMs ? `${run.durationMs} ms` : "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{timeAgo(run.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
