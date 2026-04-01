import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLevelName, getXpForNextLevel } from "@/lib/badge-engine";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let progress = await prisma.userProgress.findUnique({ where: { userId: session.user.id } });
    if (!progress) {
      progress = await prisma.userProgress.create({ data: { userId: session.user.id } });
    }

    const badgeCount = await prisma.userBadge.count({ where: { userId: session.user.id } });
    const totalBadges = await prisma.badge.count({ where: { isActive: true } });
    const certificates = await prisma.certificate.findMany({
      where: { userId: session.user.id },
      orderBy: { issuedAt: "desc" },
      take: 5,
      select: { id: true, title: true, childName: true, publicToken: true, issuedAt: true },
    });

    return NextResponse.json({
      progress: {
        totalXp: progress.totalXp,
        level: progress.level,
        levelName: getLevelName(progress.level),
        xpForNextLevel: getXpForNextLevel(progress.level),
        worksheetsCompleted: progress.worksheetsCompleted,
        coursesCompleted: progress.coursesCompleted,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        badgeCount,
        totalBadges,
      },
      certificates,
    });
  } catch (error) {
    console.error("Progress error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
