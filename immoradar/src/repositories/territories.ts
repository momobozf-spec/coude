import type { Db } from "@/lib/db";
import type { TerritoryType } from "@/generated/prisma/enums";
import type { TenantContext } from "@/lib/auth/permissions";
import { assertPermission, assertSameTenant } from "@/lib/auth/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { normalizeTerritoryValue } from "@/domain/territory/territory-matcher";
import { canonicalProvince } from "@/normalization/belgium";
import { normalizePostalCode } from "@/normalization/normalizers";
import { audit } from "@/services/audit";

export async function listTerritories(db: Db, ctx: TenantContext) {
  return db.territory.findMany({ where: { agencyId: ctx.agencyId }, orderBy: [{ type: "asc" }, { value: "asc" }] });
}

export async function addTerritory(db: Db, ctx: TenantContext, type: TerritoryType, rawValue: string) {
  assertPermission(ctx, "territory:write");
  let value = rawValue.trim();
  if (type === "POSTAL_CODE") {
    const pc = normalizePostalCode(value);
    if (!pc) throw new ValidationError("Invalid Belgian postal code");
    value = pc;
  } else if (type === "PROVINCE") {
    const p = canonicalProvince(value);
    if (!p) throw new ValidationError("Unknown Belgian province");
    value = p;
  } else if (!value) throw new ValidationError("Municipality is required");
  const t = await db.territory.upsert({
    where: { agencyId_type_normalizedValue: { agencyId: ctx.agencyId, type, normalizedValue: normalizeTerritoryValue(type, value) } },
    create: { agencyId: ctx.agencyId, type, value, normalizedValue: normalizeTerritoryValue(type, value) },
    update: {},
  });
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "territory.add", entityType: "Territory", entityId: t.id, metadata: { type, value } });
  return t;
}

export async function removeTerritory(db: Db, ctx: TenantContext, id: string) {
  assertPermission(ctx, "territory:write");
  const t = await db.territory.findUnique({ where: { id } });
  if (!t) throw new NotFoundError("Territory");
  assertSameTenant(ctx, t);
  await db.territory.delete({ where: { id } });
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "territory.remove", entityType: "Territory", entityId: id });
}
