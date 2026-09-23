import type { Db } from "@/lib/db";
import type { ActorLike } from "@/lib/auth/permissions";
import { assertPermission } from "@/lib/auth/permissions";

/** Platform-admin only read models. */
export async function listSourcesWithHealth(db: Db, actor: ActorLike) {
  assertPermission(actor, "platform:admin");
  return db.source.findMany({ orderBy: { name: "asc" }, include: { runs: { orderBy: { startedAt: "desc" }, take: 10 }, _count: { select: { listings: true } } } });
}

export async function listAgencies(db: Db, actor: ActorLike) {
  assertPermission(actor, "platform:admin");
  return db.agency.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true, territories: true, crmContacts: true, opportunities: true } } } });
}

export async function systemHealth(db: Db, actor: ActorLike) {
  assertPermission(actor, "platform:admin");
  const [properties, listings, snapshots, events, unprocessedEvents, opportunities, alertsFailed, reviewMatches, lastRun] = await Promise.all([
    db.property.count(),
    db.listing.count(),
    db.listingSnapshot.count(),
    db.listingEvent.count(),
    db.listingEvent.count({ where: { processedAt: null } }),
    db.opportunity.count(),
    db.alert.count({ where: { status: "FAILED" } }),
    db.listing.count({ where: { matchDecision: "REVIEW" } }),
    db.collectorRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  return { properties, listings, snapshots, events, unprocessedEvents, opportunities, alertsFailed, reviewMatches, lastRun };
}
