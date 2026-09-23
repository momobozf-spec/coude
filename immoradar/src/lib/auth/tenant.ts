import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, type AuthUser } from "./session";
import { tenantContextFor, type TenantContext } from "./permissions";

export const AGENCY_COOKIE = "immoradar_agency";

/** Resolve the authenticated user or redirect to the login page. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolve the tenant context for the current request. Platform admins act on
 * the agency selected via cookie (defaulting to the first agency); everyone
 * else is bound to their own agency.
 */
export async function requireTenant(): Promise<{ user: AuthUser; ctx: TenantContext; agencyName: string }> {
  const user = await requireUser();
  if (user.role === "PLATFORM_ADMIN") {
    const store = await cookies();
    const requested = store.get(AGENCY_COOKIE)?.value ?? null;
    const agency = (requested ? await db.agency.findUnique({ where: { id: requested } }) : null) ?? (await db.agency.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }));
    if (!agency) redirect("/admin/agencies");
    return { user, ctx: tenantContextFor(user, agency.id), agencyName: agency.name };
  }
  return { user, ctx: tenantContextFor(user), agencyName: user.agencyName ?? "" };
}
