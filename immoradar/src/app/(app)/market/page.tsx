import Link from "next/link";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { describeEvent } from "@/services/opportunity-service";
import { Badge, Card, EmptyState, PageHeader, fmtCity, fmtEur, timeAgo } from "../ui";

export const dynamic = "force-dynamic";

export default async function MarketRadarPage() {
  const user = await requireAgencyUser();
  const territories = await tenantDb(user.agencyId).territories();
  const territoryDefs = territories.map((t) => ({ kind: t.kind, value: t.value }));

  // Recent market events on active listings, filtered to agency territory
  const events = await prisma.listingEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: 400,
    include: {
      listing: {
        select: {
          id: true,
          currentPrice: true,
          sellerType: true,
          status: true,
          title: true,
          property: { select: { id: true, city: true, postalCode: true, province: true, address: true } },
        },
      },
    },
  });

  const inTerritory = events.filter((e) => {
    const p = e.listing.property;
    if (!p) return false;
    return matchTerritory({ postalCode: p.postalCode, city: p.city, province: p.province }, territoryDefs).matched;
  }).slice(0, 60);

  return (
    <>
      <PageHeader
        title="Market Radar"
        subtitle="Live market signals inside your territories, newest first"
      />
      {territories.length === 0 ? (
        <EmptyState title="No territories configured" hint="Add territories to start receiving market signals." />
      ) : inTerritory.length === 0 ? (
        <EmptyState title="No market signals in your territories yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {inTerritory.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        e.type === "FSBO_DETECTED" || e.type === "AGENCY_TO_PRIVATE"
                          ? "red"
                          : e.type === "PRICE_DROP" || e.type === "RELISTED"
                            ? "indigo"
                            : "slate"
                      }
                    >
                      {e.type.replaceAll("_", " ")}
                    </Badge>
                    <div className="mt-0.5 text-xs text-slate-500">{describeEvent(e.type, e.payload)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {e.listing.property ? (
                      <Link href={`/properties/${e.listing.property.id}`} className="text-indigo-600 hover:underline">
                        {e.listing.property.address ?? "—"}
                      </Link>
                    ) : "—"}
                    <div className="text-xs text-slate-400">{fmtCity(e.listing.property?.city)}</div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{fmtEur(e.listing.currentPrice)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={e.listing.sellerType === "PRIVATE" ? "red" : "slate"}>{e.listing.sellerType}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{timeAgo(e.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
