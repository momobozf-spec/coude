import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkNewBadges } from "@/lib/ramadan";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const enrollment = await prisma.challengeEnrollment.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 404 });

    const newShareCount = enrollment.shareCount + 1;
    const completions = await prisma.dayCompletion.count({ where: { enrollmentId: enrollment.id } });
    const existingBadges = enrollment.badgesEarned ? enrollment.badgesEarned.split(",").filter(Boolean) : [];
    const newBadges = checkNewBadges(completions, enrollment.streakDays, newShareCount, existingBadges);
    const allBadges = [...existingBadges, ...newBadges];

    await prisma.challengeEnrollment.update({
      where: { id: enrollment.id },
      data: { shareCount: newShareCount, badgesEarned: allBadges.join(",") },
    });

    return NextResponse.json({ shareCount: newShareCount, newBadges, allBadges });
  } catch (error) {
    console.error("Share error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
