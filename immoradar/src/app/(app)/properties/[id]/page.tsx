import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { Badge, Card, PageHeader, fmtCity, fmtDate, fmtEur, statusLabel, typeLabel } from "../../ui";
import { Timeline } from "../../timeline";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgencyUser();

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      listings: {
        orderBy: { firstSeenAt: "desc" },
        include: {
          source: { select: { name: true } },
          snapshots: { orderBy: { capturedAt: "asc" }, select: { capturedAt: true, price: true } },
        },
      },
    },
  });
  if (!property) notFound();

  const events = await prisma.listingEvent.findMany({
    where: { listing: { propertyId: id } },
    orderBy: { occurredAt: "asc" },
  });

  // Tenant-scoped: only THIS agency's opportunities on the property
  const opportunities = await tenantDb(user.agencyId).opportunities({
    where: { propertyId: id },
    include: { scores: { orderBy: { computedAt: "desc" }, take: 1 } },
  });

  return (
    <>
      <PageHeader
        title={property.address ?? "Property"}
        subtitle={`${fmtCity(property.city)} ${property.postalCode ?? ""} · ${typeLabel(property.propertyType)}`}
      >
        <Link href="/properties" className="text-sm text-indigo-600 hover:underline">← All properties</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5">
          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-900">Details</div>
            <dl className="space-y-1 text-sm text-slate-600">
              <div>Surface: {property.surfaceArea ? `${property.surfaceArea} m²` : "—"}</div>
              <div>Bedrooms: {property.bedrooms ?? "—"}</div>
              <div>Province: {fmtCity(property.province)}</div>
              <div>Tracked since: {fmtDate(property.createdAt)}</div>
            </dl>
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-900">Your opportunities on this property</div>
            {opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="text-indigo-600 hover:underline">
                      {typeLabel(o.type)}
                    </Link>{" "}
                    <span className="text-slate-400">· {statusLabel(o.status)} · score {o.scores[0]?.total ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-900">Listings ({property.listings.length})</div>
            <ul className="space-y-3 text-sm">
              {property.listings.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{fmtEur(l.currentPrice)}</span>
                    <Badge tone={l.status === "ACTIVE" ? "green" : "slate"}>{l.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {l.source.name} · seller {l.sellerType} · first seen {fmtDate(l.firstSeenAt)} · {l.snapshots.length} snapshots
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card>
            <div className="mb-4 text-sm font-semibold text-slate-900">Property timeline</div>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No recorded market history.</p>
            ) : (
              <Timeline events={events.map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurredAt, payload: e.payload }))} />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
