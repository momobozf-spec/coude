import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const REFERRAL_BONUS = 5; // bonus generations per successful referral

export function generateReferralCode(seed: string): string {
  // Short, memorable code: 4 chars derived from the seed + 4 random chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = seed.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  for (let i = 0; i < 4; i++) code += chars[randomInt(chars.length)];
  return code;
}

export type ReferralResult =
  | { status: "applied"; referrer: { id: string; email: string; name: string; bonusGenerations: number } }
  | { status: "already_referred" }
  | { status: "invalid_code" }
  | { status: "self_referral" }
  | { status: "user_not_found" };

/**
 * Links `userId` to the owner of `referralCode` and credits the referrer — at most once
 * per user. Idempotent and race-safe: the referred user's `referredBy` is set with a
 * conditional update (only while it is still NULL) inside the same transaction as the
 * bonus, so parallel or repeated calls can never credit twice.
 */
export async function applyReferral(userId: string, referralCode: string): Promise<ReferralResult> {
  const code = referralCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return { status: "invalid_code" };

  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true, email: true, name: true, bonusGenerations: true },
  });
  if (!referrer) return { status: "invalid_code" };
  if (referrer.id === userId) return { status: "self_referral" };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { status: "user_not_found" } as const;

    const claimed = await tx.user.updateMany({
      where: { id: userId, referredBy: null },
      data: { referredBy: code },
    });
    if (claimed.count === 0) return { status: "already_referred" } as const;

    await tx.user.update({
      where: { id: referrer.id },
      data: { referralCount: { increment: 1 }, bonusGenerations: { increment: REFERRAL_BONUS } },
    });
    return { status: "applied", referrer } as const;
  });
}
