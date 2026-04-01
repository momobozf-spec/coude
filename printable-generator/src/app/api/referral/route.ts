import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referral";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { referralCode: true, referralCount: true, bonusGenerations: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate referral code if doesn't exist
    let code = user.referralCode;
    if (!code) {
      code = generateReferralCode(session.user.id);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { referralCode: code },
      });
    }

    return NextResponse.json({
      code,
      referralCount: user.referralCount,
      bonusGenerations: user.bonusGenerations,
    });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
