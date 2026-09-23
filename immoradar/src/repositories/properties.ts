import type { Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";

/**
 * Market/property data is shared platform data. Tenant-specific overlays
 * (opportunities, CRM relationships) are always filtered by ctx.agencyId.
 */
export async function listProperties(db: Db, ctx: TenantContext, opts: { search?: string; sellerType?: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN"; take?: number; inTerritory?: boolean } = {}) {
  const territories = await db.territory.findMany({ where: { agencyId: ctx.agencyId } });
  const postal = territories.filter((t) => t.type === "POSTAL_CODE").map((t) => t.normalizedValue);
  const municipalities = territories.filter((t) => t.type === "MUNICIPALITY").map((t) => t.value);
  const provinces = territories.filter((t) => t.type === "PROVINCE").map((t) => t.value);
  const territoryWhere: Prisma.PropertyWhereInput | undefined =
    opts.inTerritory && territories.length
      ? { OR: [...(postal.length ? [{ postalCode: { in: postal } }] : []), ...(municipalities.length ? [{ municipality: { in: municipalities, mode: "insensitive" as const } }] : []), ...(provinces.length ? [{ province: { in: provinces, mode: "insensitive" as const } }] : [])] }
      : undefined;
  const where: Prisma.PropertyWhereInput = {
    ...(territoryWhere ?? {}),
    ...(opts.search ? { AND: [{ OR: [{ addressLine: { contains: opts.search, mode: "insensitive" } }, { municipality: { contains: opts.search, mode: "insensitive" } }, { postalCode: { startsWith: opts.search } }] }] } : {}),
    ...(opts.sellerType ? { listings: { some: { sellerType: opts.sellerType } } } : {}),
  };
  return db.property.findMany({
    where,
    take: opts.take ?? 200,
    orderBy: { updatedAt: "desc" },
    include: {
      listings: { orderBy: { lastSeenAt: "desc" }, include: { source: { select: { name: true } } } },
      opportunities: { where: { agencyId: ctx.agencyId }, select: { id: true, score: true, status: true } },
      relationships: { where: { agencyId: ctx.agencyId }, select: { id: true } },
    },
  });
}

export async function getPropertyDetail(db: Db, ctx: TenantContext, id: string) {
  const p = await db.property.findUnique({
    where: { id },
    include: {
      listings: { orderBy: { firstSeenAt: "asc" }, include: { source: { select: { name: true, key: true } }, snapshots: { orderBy: { capturedAt: "asc" } }, events: { orderBy: { occurredAt: "asc" } } } },
      events: { orderBy: { occurredAt: "asc" } },
      opportunities: { where: { agencyId: ctx.agencyId }, include: { assignedUser: { select: { name: true } } } },
      relationships: { where: { agencyId: ctx.agencyId }, include: { contact: { select: { id: true, firstName: true, lastName: true, contactType: true } } } },
    },
  });
  if (!p) throw new NotFoundError("Property");
  return p;
}

export async function listMarketRadar(db: Db, ctx: TenantContext, opts: { take?: number } = {}) {
  return db.listingEvent.findMany({
    where: { type: { in: ["FSBO_DETECTED", "PRICE_DROP", "RELISTED", "AGENCY_TO_PRIVATE", "STALE_30", "STALE_60", "STALE_90", "LISTING_REMOVED"] } },
    orderBy: { occurredAt: "desc" },
    take: opts.take ?? 100,
    include: { listing: { include: { property: true, source: { select: { name: true } }, opportunities: { where: { agencyId: ctx.agencyId }, select: { id: true, score: true } } } } },
  });
}
