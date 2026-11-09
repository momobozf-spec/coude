"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { firstIssueKey, loginSchema, registerSchema } from "@/lib/validators";
import { toLocale } from "@/lib/locales";
import { RATE_LIMITS, clientIp, consume, peek, reset } from "@/lib/rate-limit";
import { describeError, hashed, logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/verification";
import { track } from "@/lib/track";
import type { ActionResult } from "@/actions/types";

/**
 * Note on control flow: `redirect()` works by throwing a special error that
 * Next.js catches. It therefore lives *outside* every try/catch in this file —
 * swallowing it would leave the user staring at a submitted form.
 */

export async function registerAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));

  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    locale,
  });

  if (!parsed.success) {
    return { error: firstIssueKey(parsed.error) };
  }

  const { name, email, password } = parsed.data;
  const log = logger("auth.register");

  const ip = await clientIp();
  const allowed = await consume(RATE_LIMITS.registerIp, ip);
  if (!allowed.allowed) {
    log.warn("rate limited", { ip: hashed(ip) });
    return { error: "errors.tooManyAttemptsHour" };
  }

  try {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) return { error: "errors.emailTaken" };

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, passwordHash, locale },
      select: { id: true, name: true, email: true },
    });

    log.info("registered", { user: hashed(user.id) });
    track("registered", { userId: user.id, locale });

    // Best effort: a mail that does not go out must not block the signup.
    await sendVerificationEmail(user, locale);
  } catch (error) {
    log.error("register failed", describeError(error));
    return { error: "errors.generic" };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // The account exists now, so send them to the login form rather than
      // pretending the signup failed.
      return { error: "errors.invalidCredentials" };
    }
    throw error;
  }

  redirect(`/${locale}/kinderen`);
}

export async function loginAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = toLocale(String(formData.get("locale") ?? ""));
  const rawNext = String(formData.get("next") ?? "");
  // Only accept same-site relative paths; anything else is an open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: firstIssueKey(parsed.error) };
  }

  const { email, password } = parsed.data;
  const log = logger("auth.login");
  const ip = await clientIp();

  // Per address *and* per IP: the first stops one account being ground down,
  // the second stops one attacker spraying many accounts.
  const [byEmail, byIp] = await Promise.all([
    peek(RATE_LIMITS.loginEmail, email),
    peek(RATE_LIMITS.loginIp, ip),
  ]);

  if (!byEmail.allowed || !byIp.allowed) {
    log.warn("rate limited", {
      email: hashed(email),
      ip: hashed(ip),
      byEmail: byEmail.allowed,
      byIp: byIp.allowed,
    });
    return { error: "errors.tooManyAttempts" };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // Only failures count, so the right password never eats into the budget.
      await Promise.all([
        consume(RATE_LIMITS.loginEmail, email),
        consume(RATE_LIMITS.loginIp, ip),
      ]);
      log.info("invalid credentials", { email: hashed(email) });
      return { error: "errors.invalidCredentials" };
    }
    throw error;
  }

  // A real sign-in clears the counters, so a forgetful parent is not locked out
  // for a quarter of an hour after finally getting it right.
  await Promise.all([
    reset(RATE_LIMITS.loginEmail, email),
    reset(RATE_LIMITS.loginIp, ip),
  ]);

  redirect(next ?? `/${locale}/kinderen`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = toLocale(String(formData.get("locale") ?? ""));
  await signOut({ redirectTo: `/${locale}` });
}
