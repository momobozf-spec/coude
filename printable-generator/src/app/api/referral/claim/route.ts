import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REFERRAL_BONUS } from "@/lib/referral";
import { sendReferralBonusEmail } from "@/lib/emails";

// Called during registration when a referral code is present.
// Can also be called post-registration if user enters a code later.
export async function POST(req: NextRequest) {
  try {
    const { userId, referralCode } = await req.json();

    if (!userId || !referralCode) {
      return NextResponse.json({ error: "Missing userId or referralCode" }, { status: 400 });
    }

    // Find the referrer
    const referrer = await prisma.user.findFirst({
      where: { referralCode },
      select: { id: true, email: true, name: true, bonusGenerations: true },
    });

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    if (referrer.id === userId) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Check if this user was already referred
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredBy: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.referredBy) {
      return NextResponse.json({ error: "Already used a referral code" }, { status: 409 });
    }

    // Apply referral
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { referredBy: referralCode },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: {
          referralCount: { increment: 1 },
          bonusGenerations: { increment: REFERRAL_BONUS },
        },
      }),
    ]);

    // Notify referrer
    sendReferralBonusEmail(
      referrer.email,
      referrer.name,
      user.name,
      REFERRAL_BONUS,
      referrer.bonusGenerations + REFERRAL_BONUS
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      bonusAwarded: REFERRAL_BONUS,
    });
  } catch (error) {
    console.error("Referral claim error:", error);
    return NextResponse.json({ error: "Failed to process referral" }, { status: 500 });
  }
}
