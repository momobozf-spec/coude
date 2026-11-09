import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { membership, organization } from "@/db/schema";

/**
 * Data Access Layer: alle toegangscontroles gebeuren server-side via deze functies.
 */
export const getSessionUser = cache(async () => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { platformRole?: string };
  return { id: u.id, email: u.email, name: u.name, platformRole: (u.platformRole ?? "client") as "admin" | "client" };
});

export async function requireUser() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.platformRole !== "admin") notFound();
  return u;
}

/** Klantcontext: de (enige) organisatie waarvan de gebruiker lid is. */
export const requireClient = cache(async () => {
  const u = await requireUser();
  if (u.platformRole === "admin") redirect("/admin");
  const m = await db
    .select({ organizationId: membership.organizationId, role: membership.role, orgName: organization.name, isDemo: organization.isDemo })
    .from(membership)
    .innerJoin(organization, eq(organization.id, membership.organizationId))
    .where(eq(membership.userId, u.id))
    .limit(1);
  if (!m[0]) redirect("/login?error=geen-organisatie");
  return { user: u, ...m[0] };
});

/** Controle voor API-routes en server actions die een organisatie-id ontvangen. */
export async function assertOrgAccess(userId: string, platformRole: string, organizationId: string) {
  if (platformRole === "admin") return;
  const m = await db.query.membership.findFirst({
    where: and(eq(membership.userId, userId), eq(membership.organizationId, organizationId)),
  });
  if (!m) throw new Error("Geen toegang tot deze organisatie.");
}
