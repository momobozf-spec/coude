import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { tier: "asc" }],
    });

    let earnedIds = new Set<string>();
    if (userId) {
      const earned = await prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true } });
      earnedIds = new Set(earned.map(e => e.badgeId));
    }

    return NextResponse.json({
      badges: badges.map(b => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        nameNl: b.nameNl,
        description: b.isSecret && !earnedIds.has(b.id) ? "Secret achievement" : b.description,
        iconEmoji: b.isSecret && !earnedIds.has(b.id) ? "❓" : b.iconEmoji,
        color: b.color,
        category: b.category,
        tier: b.tier,
        xpReward: b.xpReward,
        isSecret: b.isSecret,
        earned: earnedIds.has(b.id),
      })),
    });
  } catch (error) {
    console.error("Badges error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
