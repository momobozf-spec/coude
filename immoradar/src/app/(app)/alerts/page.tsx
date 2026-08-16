import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { Badge, Card, EmptyState, PageHeader, timeAgo } from "../ui";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await requireAgencyUser();
  const alerts = await tenantDb(user.agencyId).alerts({
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <>
      <PageHeader title="Alerts" subtitle="Alert history — every notification is persisted and deduplicated" />
      {alerts.length === 0 ? (
        <EmptyState title="No alerts yet" hint="High-scoring opportunities and morning digests appear here." />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone={alert.kind === "CRM_MARKET_MATCH" ? "red" : alert.kind === "MORNING_DIGEST" ? "indigo" : "amber"}>
                    {alert.kind.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-sm font-semibold text-slate-900">{alert.title}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <Badge tone={alert.status === "SENT" ? "green" : alert.status === "FAILED" ? "red" : "slate"}>
                    {alert.status.replaceAll("_", " ")}
                  </Badge>
                  <span>{timeAgo(alert.createdAt)}</span>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-sm text-slate-600">
                {alert.body}
              </pre>
              {alert.opportunityId ? (
                <Link href={`/opportunities/${alert.opportunityId}`} className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
                  Open opportunity →
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
