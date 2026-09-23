import type { Db } from "@/lib/db";
import type { OpportunityEngine, OpportunityStatus, OpportunityType, Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/lib/auth/permissions";
import { assertSameTenant } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { OPEN_STATUSES, LEADREVIVE_OPPORTUNITY_TYPES } from "@/domain/opportunity/types";

export interface OpportunityListFilter {
  now?: Date;
  engine?: OpportunityEngine;
  statuses?: OpportunityStatus[];
  types?: OpportunityType[];
  assignedUserId?: string | null;
  includeSnoozed?: boolean;
  minScore?: number;
  search?: string;
  take?: number;
}

const listInclude = {
  property: { select: { id: true, addressLine: true, municipality: true, city: true, postalCode: true, propertyType: true } },
  listing: { select: { id: true, currentPrice: true, sellerType: true, sellerConfidence: true, firstSeenAt: true, priceDropCount: true, status: true } },
  contact: { select: { id: true, firstName: true, lastName: true, contactType: true, status: true, lastContactAt: true, city: true, relationships: { select: { relationshipType: true, year: true } } } },
  assignedUser: { select: { id: true, name: true } },
} satisfies Prisma.OpportunityInclude;

export type OpportunityListItem = Prisma.OpportunityGetPayload<{ include: typeof listInclude }>;

/** Tenant-scoped opportunity list; always filters by ctx.agencyId. */
export async function listOpportunities(db: Db, ctx: TenantContext, filter: OpportunityListFilter = {}): Promise<OpportunityListItem[]> {
  const now = filter.now ?? new Date();
  const where: Prisma.OpportunityWhereInput = {
    agencyId: ctx.agencyId,
    ...(filter.engine ? { engine: filter.engine } : {}),
    ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    ...(filter.types ? { type: { in: filter.types } } : {}),
    ...(filter.assignedUserId !== undefined ? { assignedUserId: filter.assignedUserId } : {}),
    ...(filter.minScore !== undefined ? { score: { gte: filter.minScore } } : {}),
    ...(filter.includeSnoozed ? {} : { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }),
    ...(filter.search
      ? {
          AND: [{ OR: [{ headline: { contains: filter.search, mode: "insensitive" } }, { property: { addressLine: { contains: filter.search, mode: "insensitive" } } }, { property: { municipality: { contains: filter.search, mode: "insensitive" } } }, { contact: { lastName: { contains: filter.search, mode: "insensitive" } } }] }],
        }
      : {}),
  };
  return db.opportunity.findMany({ where, include: listInclude, orderBy: [{ score: "desc" }, { detectedAt: "desc" }], take: filter.take ?? 200 });
}

/** The main product screen: open opportunities that need action, best first. */
export async function getTodaysOpportunities(db: Db, ctx: TenantContext, opts: { now?: Date; assignedUserId?: string | null; take?: number } = {}): Promise<OpportunityListItem[]> {
  return listOpportunities(db, ctx, { now: opts.now, statuses: OPEN_STATUSES.filter((s) => !["INTERESTED", "VALUATION_BOOKED", "MANDATE_PROPOSED"].includes(s)), assignedUserId: opts.assignedUserId, take: opts.take ?? 100 });
}

export async function getLeadReviveOpportunities(db: Db, ctx: TenantContext, opts: { now?: Date } = {}): Promise<OpportunityListItem[]> {
  return listOpportunities(db, ctx, { now: opts.now, engine: "LEADREVIVE", statuses: OPEN_STATUSES, types: LEADREVIVE_OPPORTUNITY_TYPES, includeSnoozed: false, take: 500 });
}

const detailInclude = {
  property: { include: { listings: { include: { source: { select: { name: true, key: true } }, snapshots: { orderBy: { capturedAt: "asc" } }, events: { orderBy: { occurredAt: "asc" } } }, orderBy: { firstSeenAt: "asc" } } } },
  listing: { include: { source: { select: { name: true, key: true } }, sellerIdentity: true } },
  contact: { include: { relationships: { include: { property: { select: { addressLine: true } } } }, interactions: { orderBy: { occurredAt: "desc" }, take: 20 }, assignedUser: { select: { id: true, name: true } } } },
  assignedUser: { select: { id: true, name: true } },
  signals: { orderBy: { occurredAt: "asc" } },
  scores: { orderBy: { computedAt: "desc" }, take: 5 },
  activities: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
  alerts: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OpportunityInclude;

export type OpportunityDetail = Prisma.OpportunityGetPayload<{ include: typeof detailInclude }>;

export async function getOpportunityDetail(db: Db, ctx: TenantContext, id: string): Promise<OpportunityDetail> {
  const opp = await db.opportunity.findUnique({ where: { id }, include: detailInclude });
  if (!opp) throw new NotFoundError("Opportunity");
  assertSameTenant(ctx, opp);
  // Defensive: the contact relation must belong to the same tenant (it always does by construction).
  if (opp.contact && opp.contact.agencyId !== ctx.agencyId) throw new NotFoundError("Opportunity");
  return opp;
}

export async function getPipelineBoard(db: Db, ctx: TenantContext): Promise<Record<OpportunityStatus, OpportunityListItem[]>> {
  const all = await listOpportunities(db, ctx, { includeSnoozed: true, take: 1000 });
  const board = Object.fromEntries((["NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "INTERESTED", "VALUATION_BOOKED", "MANDATE_PROPOSED", "MANDATE_WON", "LOST", "DISMISSED"] as OpportunityStatus[]).map((s) => [s, [] as OpportunityListItem[]])) as Record<OpportunityStatus, OpportunityListItem[]>;
  for (const o of all) board[o.status].push(o);
  return board;
}
