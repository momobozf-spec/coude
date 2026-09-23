"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, createSession, getRequestMeta, getSessionToken, revokeSession, setSessionCookie } from "@/lib/auth/session";
import { audit } from "@/services/audit";
import { createLogger } from "@/lib/logger";

const log = createLogger({ component: "auth" });

const loginSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and password." };
  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, include: { agency: { select: { isActive: true } } } });
  // Always run the hash comparison to keep timing uniform.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid");
  if (!user || !ok || !user.isActive || (user.agency && !user.agency.isActive)) {
    log.warn("login failed", { userId: user?.id ?? null });
    return { error: "Invalid credentials." };
  }
  const meta = await getRequestMeta();
  const { token, expiresAt } = await createSession(db, user.id, meta);
  await setSessionCookie(token, expiresAt);
  await audit(db, { agencyId: user.agencyId, userId: user.id, action: "auth.login", ip: meta.ip });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) await revokeSession(db, token);
  await clearSessionCookie();
  redirect("/login");
}
