import { requirePlatformAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Badge, Card, PageHeader, fmtDate } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  await requirePlatformAdmin();
  const sources = await prisma.source.findMany({
    include: {
      _count: { select: { listings: true } },
      collectorRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Only sources with a permitted integration method are implemented — see docs/adding-data-source.md"
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Listings</th>
              <th className="px-4 py-3 text-right">Poll interval</th>
              <th className="px-4 py-3 text-right">Rate limit</th>
              <th className="px-4 py-3">Last run</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const lastRun = source.collectorRuns[0];
              return (
                <tr key={source.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{source.name}</div>
                    <div className="text-xs text-slate-400">{source.code}</div>
                  </td>
                  <td className="px-4 py-2.5"><Badge>{source.kind}</Badge></td>
                  <td className="px-4 py-2.5">
                    <Badge tone={source.status === "ACTIVE" ? "green" : source.status === "ERROR" ? "red" : "slate"}>
                      {source.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">{source._count.listings}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{source.pollIntervalMinutes} min</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{source.rateLimitPerMinute}/min</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {lastRun ? `${fmtDate(lastRun.startedAt)} (${lastRun.status})` : "never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
