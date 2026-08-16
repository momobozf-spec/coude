import { requirePlatformAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Card, PageHeader, timeAgo } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  await requirePlatformAdmin();

  const [properties, listings, snapshots, events, opportunities, alerts, contacts, lastEvent, recentAudit] =
    await Promise.all([
      prisma.property.count(),
      prisma.listing.count(),
      prisma.listingSnapshot.count(),
      prisma.listingEvent.count(),
      prisma.opportunity.count(),
      prisma.alert.count(),
      prisma.crmContact.count(),
      prisma.listingEvent.findFirst({ orderBy: { occurredAt: "desc" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

  const stats = [
    { label: "Properties", value: properties },
    { label: "Listings", value: listings },
    { label: "Snapshots", value: snapshots },
    { label: "Market events", value: events },
    { label: "Opportunities", value: opportunities },
    { label: "Alerts", value: alerts },
    { label: "CRM contacts (all tenants)", value: contacts },
  ];

  return (
    <>
      <PageHeader title="System Health" subtitle="Platform-wide data volumes and audit trail" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => (
          <Card key={stat.label} className="text-center">
            <div className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString("en-GB")}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{stat.label}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <div className="text-sm text-slate-600">
          Last market event: <strong>{lastEvent ? `${lastEvent.type} ${timeAgo(lastEvent.occurredAt)}` : "none"}</strong>
        </div>
      </Card>
      <Card className="mt-5 overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Recent audit log</div>
        <table className="w-full text-sm">
          <tbody>
            {recentAudit.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-700">{entry.action}</td>
                <td className="px-4 py-2 text-slate-500">{entry.entity ?? "—"}</td>
                <td className="px-4 py-2 text-right text-slate-400">{timeAgo(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
