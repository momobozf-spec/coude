import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/db";
import { provider, type PlatformRole } from "@/db/schema";

export type CurrentUser = { id: string; name: string; email: string; role: PlatformRole; locale: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return null;
  const u = s.user as typeof s.user & { platformRole?: PlatformRole; locale?: string };
  return { id: u.id, name: u.name, email: u.email, role: u.platformRole ?? "customer", locale: u.locale ?? "nl" };
});

export const getCurrentProvider = cache(async () => {
  const u = await getCurrentUser();
  if (!u || u.role !== "provider") return null;
  const [p] = await db.select().from(provider).where(eq(provider.userId, u.id)).limit(1);
  return p ? { user: u, provider: p } : null;
});

export async function requireRole(role: PlatformRole): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== role) throw new AuthError(u ? "forbidden" : "unauthenticated");
  return u;
}

export class AuthError extends Error {
  constructor(public kind: "unauthenticated" | "forbidden") {
    super(kind);
  }
}
