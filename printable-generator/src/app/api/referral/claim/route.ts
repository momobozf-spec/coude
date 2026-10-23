import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { applyReferral, REFERRAL_BONUS } from "@/lib/referral";
import { sendReferralBonusEmail } from "@/lib/emails";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ referralCode: z.string().min(4).max(16) });

// Lets a logged-in user enter a referral code after registration.
// The user id ALWAYS comes from the session (never from the request body) and a user
// can be referred only once (idempotent — see applyReferral).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user.ok) return user.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid referralCode" }, { status: 400 });
  }

  try {
    const result = await applyReferral(user.userId, parsed.data.referralCode);
    switch (result.status) {
      case "invalid_code":
        return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
      case "self_referral":
        return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
      case "user_not_found":
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      case "already_referred":
        return NextResponse.json({ error: "Already used a referral code" }, { status: 409 });
      case "applied": {
        const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
        sendReferralBonusEmail(
          result.referrer.email,
          result.referrer.name,
          me?.name || "",
          REFERRAL_BONUS,
          result.referrer.bonusGenerations + REFERRAL_BONUS
        ).catch(() => {});
        return NextResponse.json({ success: true, bonusAwarded: REFERRAL_BONUS });
      }
    }
  } catch (error) {
    console.error("Referral claim error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Failed to process referral" }, { status: 500 });
  }
}
