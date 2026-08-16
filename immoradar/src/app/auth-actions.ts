"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export interface LoginState {
  error: string | null;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email address and password." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  // Uniform error: never reveal whether the account exists
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    logger.warn("auth.login_failed", { emailDomain: parsed.data.email.split("@")[1] });
    return { error: "Invalid email or password." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  await prisma.auditLog.create({
    data: { agencyId: user.agencyId, userId: user.id, action: "LOGIN" },
  });

  redirect(user.agencyId ? "/" : "/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
