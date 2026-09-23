import type { Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/lib/auth/permissions";
import { assertSameTenant } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";

export async function listContacts(db: Db, ctx: TenantContext, opts: { search?: string; take?: number } = {}) {
  const where: Prisma.CrmContactWhereInput = {
    agencyId: ctx.agencyId,
    deletedAt: null,
    ...(opts.search ? { OR: [{ firstName: { contains: opts.search, mode: "insensitive" } }, { lastName: { contains: opts.search, mode: "insensitive" } }, { email: { contains: opts.search, mode: "insensitive" } }, { city: { contains: opts.search, mode: "insensitive" } }] } : {}),
  };
  return db.crmContact.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: opts.take ?? 500, include: { assignedUser: { select: { name: true } }, relationships: true, _count: { select: { opportunities: true } } } });
}

export async function getContact(db: Db, ctx: TenantContext, id: string) {
  const c = await db.crmContact.findUnique({ where: { id }, include: { assignedUser: { select: { id: true, name: true } }, relationships: { include: { property: true } }, interactions: { orderBy: { occurredAt: "desc" } }, opportunities: { orderBy: { detectedAt: "desc" }, include: { property: true } } } });
  if (!c || c.deletedAt) throw new NotFoundError("Contact");
  assertSameTenant(ctx, c);
  return c;
}

export async function countContacts(db: Db, ctx: TenantContext): Promise<number> {
  return db.crmContact.count({ where: { agencyId: ctx.agencyId, deletedAt: null } });
}

export async function listImports(db: Db, ctx: TenantContext) {
  return db.crmImport.findMany({ where: { agencyId: ctx.agencyId }, orderBy: { startedAt: "desc" }, include: { user: { select: { name: true } } }, take: 50 });
}

export async function getImport(db: Db, ctx: TenantContext, id: string) {
  const imp = await db.crmImport.findUnique({ where: { id }, include: { user: { select: { name: true } }, rows: { orderBy: { rowNumber: "asc" }, take: 500 } } });
  if (!imp) throw new NotFoundError("Import");
  assertSameTenant(ctx, imp);
  return imp;
}
