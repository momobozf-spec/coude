import { requirePlatformAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Card, PageHeader, fmtDate } from "../../ui";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage() {
  await requirePlatformAdmin();
  const agencies = await prisma.agency.findMany({
    include: {
      _count: {
        select: { users: true, territories: true, crmContacts: true, opportunities: true, alerts: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Agencies" subtitle="All tenants on this platform — tenant data itself is never shown here" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Agency</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3 text-right">Territories</th>
              <th className="px-4 py-3 text-right">CRM contacts</th>
              <th className="px-4 py-3 text-right">Opportunities</th>
              <th className="px-4 py-3 text-right">Alerts</th>
              <th className="px-4 py-3 text-right">Min alert score</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((agency) => (
              <tr key={agency.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{agency.name}</div>
                  <div className="text-xs text-slate-400">{agency.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-right">{agency._count.users}</td>
                <td className="px-4 py-2.5 text-right">{agency._count.territories}</td>
                <td className="px-4 py-2.5 text-right">{agency._count.crmContacts}</td>
                <td className="px-4 py-2.5 text-right">{agency._count.opportunities}</td>
                <td className="px-4 py-2.5 text-right">{agency._count.alerts}</td>
                <td className="px-4 py-2.5 text-right">{agency.minAlertScore}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmtDate(agency.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
