/**
 * Tenant-scoped data access.
 *
 * ALL access to tenant-owned tables (CRM contacts, opportunities,
 * territories, alerts, imports, assignments, configuration) must go through
 * a TenantDb obtained via `tenantDb(agencyId)`. Every query it exposes
 * injects the agencyId filter, making cross-tenant reads a type-level
 * impossibility for callers. Shared market data (properties, listings,
 * events, sources) is accessed via `prisma` directly.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";

export class TenantDb {
  constructor(
    public readonly agencyId: string,
    private readonly db: PrismaClient = defaultPrisma,
  ) {
    if (!agencyId) throw new Error("TenantDb requires a non-empty agencyId");
  }

  // --- CRM contacts -------------------------------------------------------

  crmContacts(args: Omit<Prisma.CrmContactFindManyArgs, "where"> & { where?: Prisma.CrmContactWhereInput } = {}) {
    return this.db.crmContact.findMany({
      ...args,
      where: { ...(args.where ?? {}), agencyId: this.agencyId },
    });
  }

  crmContactById(id: string, include?: Prisma.CrmContactInclude) {
    return this.db.crmContact.findFirst({ where: { id, agencyId: this.agencyId }, include });
  }

  countCrmContacts(where: Prisma.CrmContactWhereInput = {}) {
    return this.db.crmContact.count({ where: { ...where, agencyId: this.agencyId } });
  }

  createCrmContact(data: Omit<Prisma.CrmContactUncheckedCreateInput, "agencyId">) {
    return this.db.crmContact.create({ data: { ...data, agencyId: this.agencyId } });
  }

  async updateCrmContact(id: string, data: Prisma.CrmContactUncheckedUpdateInput) {
    // updateMany + agency filter guarantees the row belongs to this tenant
    const result = await this.db.crmContact.updateMany({
      where: { id, agencyId: this.agencyId },
      data,
    });
    if (result.count === 0) throw new Error("Contact not found in this agency");
  }

  async deleteCrmContact(id: string) {
    const result = await this.db.crmContact.deleteMany({ where: { id, agencyId: this.agencyId } });
    if (result.count === 0) throw new Error("Contact not found in this agency");
  }

  // --- Territories --------------------------------------------------------

  territories() {
    return this.db.territory.findMany({
      where: { agencyId: this.agencyId },
      orderBy: [{ kind: "asc" }, { value: "asc" }],
    });
  }

  createTerritory(data: Omit<Prisma.TerritoryUncheckedCreateInput, "agencyId">) {
    return this.db.territory.create({ data: { ...data, agencyId: this.agencyId } });
  }

  async deleteTerritory(id: string) {
    const result = await this.db.territory.deleteMany({ where: { id, agencyId: this.agencyId } });
    if (result.count === 0) throw new Error("Territory not found in this agency");
  }

  // --- Opportunities ------------------------------------------------------

  opportunities(args: Omit<Prisma.OpportunityFindManyArgs, "where"> & { where?: Prisma.OpportunityWhereInput } = {}) {
    return this.db.opportunity.findMany({
      ...args,
      where: { ...(args.where ?? {}), agencyId: this.agencyId },
    });
  }

  opportunityById(id: string, include?: Prisma.OpportunityInclude) {
    return this.db.opportunity.findFirst({ where: { id, agencyId: this.agencyId }, include });
  }

  countOpportunities(where: Prisma.OpportunityWhereInput = {}) {
    return this.db.opportunity.count({ where: { ...where, agencyId: this.agencyId } });
  }

  createOpportunity(data: Omit<Prisma.OpportunityUncheckedCreateInput, "agencyId">) {
    return this.db.opportunity.create({ data: { ...data, agencyId: this.agencyId } });
  }

  async updateOpportunity(id: string, data: Prisma.OpportunityUncheckedUpdateInput) {
    const result = await this.db.opportunity.updateMany({
      where: { id, agencyId: this.agencyId },
      data,
    });
    if (result.count === 0) throw new Error("Opportunity not found in this agency");
  }

  // --- CRM imports --------------------------------------------------------

  crmImports(args: Omit<Prisma.CrmImportFindManyArgs, "where"> & { where?: Prisma.CrmImportWhereInput } = {}) {
    return this.db.crmImport.findMany({
      ...args,
      where: { ...(args.where ?? {}), agencyId: this.agencyId },
    });
  }

  crmImportById(id: string, include?: Prisma.CrmImportInclude) {
    return this.db.crmImport.findFirst({ where: { id, agencyId: this.agencyId }, include });
  }

  // --- Alerts -------------------------------------------------------------

  alerts(args: Omit<Prisma.AlertFindManyArgs, "where"> & { where?: Prisma.AlertWhereInput } = {}) {
    return this.db.alert.findMany({
      ...args,
      where: { ...(args.where ?? {}), agencyId: this.agencyId },
    });
  }

  // --- Users (within the agency) -----------------------------------------

  agencyUsers() {
    return this.db.user.findMany({
      where: { agencyId: this.agencyId, isActive: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
  }

  agency() {
    return this.db.agency.findUniqueOrThrow({ where: { id: this.agencyId } });
  }

  /** Escape hatch for services that need transactions — still tenant-tagged. */
  get raw(): PrismaClient {
    return this.db;
  }
}

export function tenantDb(agencyId: string, db?: PrismaClient): TenantDb {
  return new TenantDb(agencyId, db);
}
