import type { Db } from "@/lib/db";
import type { OpportunityStatus } from "@/generated/prisma/enums";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, assertSameTenant, type TenantContext } from "@/lib/auth/permissions";
import { audit } from "./audit";

export const STATUS_ORDER: OpportunityStatus[] = ["NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "INTERESTED", "VALUATION_BOOKED", "MANDATE_PROPOSED", "MANDATE_WON", "LOST", "DISMISSED"];

const TERMINAL: OpportunityStatus[] = ["MANDATE_WON", "LOST", "DISMISSED"];

/** Allowed transitions. Terminal states can be reopened to CONTACTED by an admin. */
export function canTransition(from: OpportunityStatus, to: OpportunityStatus, role: TenantContext["role"]): boolean {
  if (from === to) return false;
  if (TERMINAL.includes(from)) return role !== "AGENT" && !TERMINAL.includes(to);
  return true;
}

async function loadForTenant(db: Db, ctx: TenantContext, opportunityId: string) {
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opp) throw new NotFoundError("Opportunity");
  assertSameTenant(ctx, opp);
  return opp;
}

export async function assignOpportunity(db: Db, ctx: TenantContext, opportunityId: string, userId: string | null): Promise<void> {
  assertPermission(ctx, userId === ctx.userId || userId === null ? "opportunity:write" : "opportunity:assign");
  const opp = await loadForTenant(db, ctx, opportunityId);
  if (userId) {
    const user = await db.user.findFirst({ where: { id: userId, agencyId: ctx.agencyId, isActive: true } });
    if (!user) throw new ForbiddenError("Assignee must be an active member of your agency");
  }
  const nextStatus: OpportunityStatus = userId && opp.status === "NEW" ? "ASSIGNED" : opp.status;
  await db.$transaction(async (tx) => {
    await tx.opportunityAssignment.updateMany({ where: { opportunityId, unassignedAt: null }, data: { unassignedAt: new Date() } });
    if (userId) await tx.opportunityAssignment.create({ data: { opportunityId, agencyId: ctx.agencyId, userId, assignedById: ctx.userId } });
    await tx.opportunity.update({ where: { id: opportunityId }, data: { assignedUserId: userId, status: nextStatus } });
    await tx.opportunityActivity.create({ data: { opportunityId, agencyId: ctx.agencyId, userId: ctx.userId, type: userId ? "ASSIGNED" : "UNASSIGNED", fromStatus: opp.status, toStatus: nextStatus, payload: { assigneeId: userId } } });
  });
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "opportunity.assign", entityType: "Opportunity", entityId: opportunityId, metadata: { assigneeId: userId } });
}

export async function updateOpportunityStatus(db: Db, ctx: TenantContext, opportunityId: string, to: OpportunityStatus, note?: string | null): Promise<void> {
  assertPermission(ctx, "opportunity:write");
  const opp = await loadForTenant(db, ctx, opportunityId);
  if (!canTransition(opp.status, to, ctx.role)) throw new ValidationError(`Cannot move opportunity from ${opp.status} to ${to}`);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: to,
        contactedAt: to === "CONTACTED" && !opp.contactedAt ? now : opp.contactedAt,
        closedAt: TERMINAL.includes(to) ? now : null,
        snoozedUntil: null,
        assignedUserId: opp.assignedUserId ?? (to !== "NEW" && to !== "DISMISSED" ? ctx.userId : null),
      },
    });
    await tx.opportunityActivity.create({ data: { opportunityId, agencyId: ctx.agencyId, userId: ctx.userId, type: to === "CONTACTED" ? "CONTACTED" : to === "DISMISSED" ? "DISMISSED" : "STATUS_CHANGED", fromStatus: opp.status, toStatus: to, note: note ?? null } });
  });
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "opportunity.status", entityType: "Opportunity", entityId: opportunityId, metadata: { from: opp.status, to } });
}

export async function markContacted(db: Db, ctx: TenantContext, opportunityId: string, note?: string | null): Promise<void> {
  return updateOpportunityStatus(db, ctx, opportunityId, "CONTACTED", note);
}

export async function dismissOpportunity(db: Db, ctx: TenantContext, opportunityId: string, reason?: string | null): Promise<void> {
  return updateOpportunityStatus(db, ctx, opportunityId, "DISMISSED", reason);
}

export async function snoozeOpportunity(db: Db, ctx: TenantContext, opportunityId: string, until: Date): Promise<void> {
  assertPermission(ctx, "opportunity:write");
  const opp = await loadForTenant(db, ctx, opportunityId);
  if (until.getTime() <= Date.now()) throw new ValidationError("Snooze date must be in the future");
  await db.$transaction([
    db.opportunity.update({ where: { id: opportunityId }, data: { snoozedUntil: until } }),
    db.opportunityActivity.create({ data: { opportunityId, agencyId: ctx.agencyId, userId: ctx.userId, type: "SNOOZED", fromStatus: opp.status, toStatus: opp.status, payload: { until: until.toISOString() } } }),
  ]);
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "opportunity.snooze", entityType: "Opportunity", entityId: opportunityId, metadata: { until: until.toISOString() } });
}

export async function addOpportunityNote(db: Db, ctx: TenantContext, opportunityId: string, note: string): Promise<void> {
  assertPermission(ctx, "opportunity:write");
  const opp = await loadForTenant(db, ctx, opportunityId);
  const trimmed = note.trim();
  if (!trimmed) throw new ValidationError("Note cannot be empty");
  await db.opportunityActivity.create({ data: { opportunityId, agencyId: ctx.agencyId, userId: ctx.userId, type: "NOTE", fromStatus: opp.status, toStatus: opp.status, note: trimmed.slice(0, 2000) } });
}
