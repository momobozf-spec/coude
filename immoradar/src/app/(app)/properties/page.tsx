import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { Badge, Card, EmptyState, PageHeader, fmtCity, fmtEur, timeAgo, typeLabel } from "../ui";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const user = await requireAgencyUser();
  const territories = await tenantDb(user.agencyId).territories();
  const territoryDefs = territories.map((t) => ({ kind: t.kind, value: t.value }));
  const postalCodes = territories.filter((t) => t.kind === "POSTAL_CODE").map((t) => t.value);

  const properties = await prisma.property.findMany({
    where: postalCodes.length > 0 ? { postalCode: { in: postalCodes } } : {},
    include: {
      listings: {
        orderBy: { lastSeenAt: "desc" },
        take: 1,
        select: { currentPrice: true, sellerType: true, status: true, lastSeenAt: true },
      },
      _count: { select: { listings: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const inTerritory = properties
    .filter((p) =>
      matchTerritory({ postalCode: p.postalCode, city: p.city, province: p.province }, territoryDefs).matched,
    )
    .slice(0, 120);

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={`${inTerritory.length} tracked physical properties inside your territories`}
      />
      {inTerritory.length === 0 ? (
        <EmptyState title="No tracked properties in your territories yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Municipality</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Latest price</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Listing status</th>
                <th className="px-4 py-3">Listings</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {inTerritory.map((p) => {
                const latest = p.listings[0];
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/properties/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                        {p.address ?? "Address unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{fmtCity(p.city)} {p.postalCode ? `(${p.postalCode})` : ""}</td>
                    <td className="px-4 py-2.5 text-slate-500">{typeLabel(p.propertyType)}</td>
                    <td className="px-4 py-2.5 font-medium">{fmtEur(latest?.currentPrice)}</td>
                    <td className="px-4 py-2.5">
                      {latest ? (
                        <Badge tone={latest.sellerType === "PRIVATE" ? "red" : "slate"}>{latest.sellerType}</Badge>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {latest ? (
                        <Badge tone={latest.status === "ACTIVE" ? "green" : "slate"}>{latest.status.replaceAll("_", " ")}</Badge>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{p._count.listings}</td>
                    <td className="px-4 py-2.5 text-slate-500">{latest ? timeAgo(latest.lastSeenAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
