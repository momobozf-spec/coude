import { cache } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/locales";

/** Locale of the current request, so redirects never drop the visitor's language. */
async function currentLocale(): Promise<string> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect(`/${await currentLocale()}/login`);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      subStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      installHintSeen: true,
      emailVerifiedAt: true,
      trialEndsAt: true,
    },
  });
  if (!user) redirect(`/${await currentLocale()}/login`);

  const isSubscribed =
    (user.subStatus === "ACTIVE" || user.subStatus === "TRIALING") &&
    (!user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now());

  return { ...user, isSubscribed };
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

/** Gooit als de gebruiker geen toegang heeft tot een betaald pakket. */
export function assertPackAccess(
  user: { isSubscribed: boolean },
  pack: { isFree: boolean; releaseAt: Date },
) {
  if (pack.releaseAt.getTime() > Date.now()) {
    throw new Error("UNRELEASED");
  }
  if (!pack.isFree && !user.isSubscribed) {
    throw new Error("PAYWALL");
  }
}

export type PackAccess = "ok" | "paywall" | "unreleased";

/**
 * Non-throwing twin of `assertPackAccess`, for pages that want to *render* the
 * upgrade card instead of blowing up. Same rules, one source of truth.
 */
export function packAccess(
  user: { isSubscribed: boolean },
  pack: { isFree: boolean; releaseAt: Date },
): PackAccess {
  try {
    assertPackAccess(user, pack);
    return "ok";
  } catch (error) {
    return error instanceof Error && error.message === "UNRELEASED"
      ? "unreleased"
      : "paywall";
  }
}

/** Kind moet van deze gebruiker zijn. Gebruik dit in élke kind-gerelateerde query. */
export async function requireChild(childId: string) {
  const user = await requireUser();
  const child = await db.child.findFirst({
    where: { id: childId, userId: user.id },
  });
  if (!child) redirect(`/${await currentLocale()}/kinderen`);
  return { user, child };
}

/**
 * Server-action variant of `requireChild`: returns null instead of redirecting,
 * so the action can hand back `{ error }` like every other mutation.
 */
export async function findOwnedChild(childId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.child.findFirst({
    where: { id: childId, userId: session.user.id },
  });
}
