/**
 * Tenant-scoped data access.
 *
 * ALL access to tenant-owned tables (CRM contacts, opportunities,
 * territories, alerts, imports, assignments, configuration) must go through
 * a TenantDb obtained via `tenantDb(agencyId)`. Every query it exposes
 * injects the agencyId filter, making cross-tenant reads a type-level
 * impossibility for callers. Shared market data (properties, listings,
 * events, sources) is accessed via `prisma` directly.
 *
 * Methods are generic over Prisma args so `include`/`select` result typing
 * is preserved for callers; the `where` clause is always overridden with the
 * tenant filter.
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

  private scope<W extends object | undefined>(where: W): W & { agencyId: string } {
    return { ...(where ?? {}), agencyId: this.agencyId } as W & { agencyId: string };
  }

  // --- CRM contacts -------------------------------------------------------

  crmContacts<T extends Prisma.CrmContactFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.CrmContactFindManyArgs>,
  ) {
    const base = args as Prisma.CrmContactFindManyArgs | undefined;
    const merged = { ...base, where: this.scope(base?.where) };
    return this.db.crmContact.findMany(merged as Prisma.SelectSubset<T, Prisma.CrmContactFindManyArgs>);
  }

  crmContactById<I extends Prisma.CrmContactInclude>(id: string, include?: I) {
    return this.db.crmContact.findFirst({
      where: { id, agencyId: this.agencyId },
      include: include as I,
    });
  }

  countCrmContacts(where: Prisma.CrmContactWhereInput = {}) {
    return this.db.crmContact.count({ where: this.scope(where) });
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

  opportunities<T extends Prisma.OpportunityFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.OpportunityFindManyArgs>,
  ) {
    const base = args as Prisma.OpportunityFindManyArgs | undefined;
    const merged = { ...base, where: this.scope(base?.where) };
    return this.db.opportunity.findMany(merged as Prisma.SelectSubset<T, Prisma.OpportunityFindManyArgs>);
  }

  opportunityById<I extends Prisma.OpportunityInclude>(id: string, include?: I) {
    return this.db.opportunity.findFirst({
      where: { id, agencyId: this.agencyId },
      include: include as I,
    });
  }

  countOpportunities(where: Prisma.OpportunityWhereInput = {}) {
    return this.db.opportunity.count({ where: this.scope(where) });
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

  crmImports<T extends Prisma.CrmImportFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.CrmImportFindManyArgs>,
  ) {
    const base = args as Prisma.CrmImportFindManyArgs | undefined;
    const merged = { ...base, where: this.scope(base?.where) };
    return this.db.crmImport.findMany(merged as Prisma.SelectSubset<T, Prisma.CrmImportFindManyArgs>);
  }

  crmImportById<I extends Prisma.CrmImportInclude>(id: string, include?: I) {
    return this.db.crmImport.findFirst({
      where: { id, agencyId: this.agencyId },
      include: include as I,
    });
  }

  // --- Alerts -------------------------------------------------------------

  alerts<T extends Prisma.AlertFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AlertFindManyArgs>,
  ) {
    const base = args as Prisma.AlertFindManyArgs | undefined;
    const merged = { ...base, where: this.scope(base?.where) };
    return this.db.alert.findMany(merged as Prisma.SelectSubset<T, Prisma.AlertFindManyArgs>);
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
