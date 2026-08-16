import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "PLATFORM_ADMIN" | "AGENCY_ADMIN" | "AGENT";
  agencyId: string | null;
  agencyName: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { agency: { select: { name: true } } },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    agencyId: user.agencyId,
    agencyName: user.agency?.name ?? null,
  };
}

/** Redirects to /login when unauthenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Agency-scoped pages: platform admins without an agency are sent to the
 * admin area; everyone else must belong to an agency.
 */
export async function requireAgencyUser(): Promise<CurrentUser & { agencyId: string }> {
  const user = await requireUser();
  if (!user.agencyId) {
    if (user.role === "PLATFORM_ADMIN") redirect("/admin");
    redirect("/login");
  }
  return user as CurrentUser & { agencyId: string };
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "PLATFORM_ADMIN") redirect("/");
  return user;
}
