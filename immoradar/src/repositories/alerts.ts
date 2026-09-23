import type { Db } from "@/lib/db";
import type { TenantContext } from "@/lib/auth/permissions";

export async function listAlerts(db: Db, ctx: TenantContext, take = 100) {
  return db.alert.findMany({ where: { agencyId: ctx.agencyId }, orderBy: { createdAt: "desc" }, take, include: { opportunity: { select: { id: true, headline: true, score: true } }, user: { select: { name: true } } } });
}

export async function listAlertRules(db: Db, ctx: TenantContext) {
  return db.alertRule.findMany({ where: { agencyId: ctx.agencyId }, orderBy: { type: "asc" } });
}
