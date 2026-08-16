/**
 * Opportunity workflow: assignments, status transitions and the activity
 * trail behind the acquisition pipeline. All operations are tenant-scoped
 * and audit-logged.
 */

import type { OpportunityStatus, Prisma, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";

/** Allowed transitions of the lightweight acquisition pipeline. */
const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  NEW: ["ASSIGNED", "TO_CONTACT", "CONTACTED", "SNOOZED", "DISMISSED"],
  ASSIGNED: ["TO_CONTACT", "CONTACTED", "SNOOZED", "DISMISSED"],
  TO_CONTACT: ["CONTACTED", "SNOOZED", "DISMISSED"],
  CONTACTED: ["INTERESTED", "LOST", "SNOOZED", "DISMISSED"],
  INTERESTED: ["VALUATION_BOOKED", "LOST", "DISMISSED"],
  VALUATION_BOOKED: ["MANDATE_PROPOSED", "LOST"],
  MANDATE_PROPOSED: ["MANDATE_WON", "LOST"],
  MANDATE_WON: [],
  LOST: [],
  DISMISSED: [],
  SNOOZED: ["NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "DISMISSED"],
};

export class WorkflowService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async assign(
    agencyId: string,
    opportunityId: string,
    assignedToId: string,
    assignedById: string,
  ): Promise<void> {
    const tenant = tenantDb(agencyId, this.db);
    const opportunity = await tenant.opportunityById(opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");

    // Assignee must belong to the same agency
    const assignee = await this.db.user.findFirst({
      where: { id: assignedToId, agencyId, isActive: true },
    });
    if (!assignee) throw new Error("Assignee is not an active member of this agency");

    await this.db.$transaction([
      this.db.opportunityAssignment.updateMany({
        where: { opportunityId, active: true },
        data: { active: false },
      }),
      this.db.opportunityAssignment.create({
        data: { opportunityId, assignedToId, assignedById, active: true },
      }),
      this.db.opportunity.update({
        where: { id: opportunityId },
        data: { status: opportunity.status === "NEW" ? "ASSIGNED" : opportunity.status },
      }),
      this.db.opportunityActivity.create({
        data: {
          opportunityId,
          userId: assignedById,
          kind: "ASSIGNED",
          fromStatus: opportunity.status,
          toStatus: opportunity.status === "NEW" ? "ASSIGNED" : opportunity.status,
          note: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
        },
      }),
    ]);
  }

  async changeStatus(
    agencyId: string,
    opportunityId: string,
    toStatus: OpportunityStatus,
    userId: string,
    note?: string,
    snoozedUntil?: Date,
  ): Promise<void> {
    const tenant = tenantDb(agencyId, this.db);
    const opportunity = await tenant.opportunityById(opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");

    const allowed = TRANSITIONS[opportunity.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Cannot move opportunity from ${opportunity.status} to ${toStatus}`);
    }

    const data: Prisma.OpportunityUncheckedUpdateInput = { status: toStatus };
    if (toStatus === "SNOOZED") {
      data.snoozedUntil = snoozedUntil ?? new Date(Date.now() + 7 * 86_400_000);
    }

    await this.db.$transaction([
      this.db.opportunity.update({ where: { id: opportunityId }, data }),
      this.db.opportunityActivity.create({
        data: {
          opportunityId,
          userId,
          kind: "STATUS_CHANGE",
          fromStatus: opportunity.status,
          toStatus,
          note: note ?? null,
        },
      }),
      this.db.auditLog.create({
        data: {
          agencyId,
          userId,
          action: "OPPORTUNITY_STATUS",
          entity: "Opportunity",
          entityId: opportunityId,
          metadata: { from: opportunity.status, to: toStatus } as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  async addNote(agencyId: string, opportunityId: string, userId: string, note: string): Promise<void> {
    const tenant = tenantDb(agencyId, this.db);
    const opportunity = await tenant.opportunityById(opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    await this.db.opportunityActivity.create({
      data: { opportunityId, userId, kind: "NOTE", note },
    });
  }
}

export function allowedTransitions(status: OpportunityStatus): OpportunityStatus[] {
  return TRANSITIONS[status] ?? [];
}
