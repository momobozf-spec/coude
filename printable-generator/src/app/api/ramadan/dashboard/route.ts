import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDayUnlocked, getCurrentChallengeDay } from "@/lib/ramadan";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const enrollment = await prisma.challengeEnrollment.findFirst({
      where: { userId: session.user.id },
      include: {
        challenge: { include: { days: { orderBy: { dayNumber: "asc" } } } },
        completions: { select: { dayId: true, completedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 404 });

    const completedDayIds = new Set(enrollment.completions.map(c => c.dayId));
    const currentDay = getCurrentChallengeDay(enrollment.challenge.startDate);

    const days = enrollment.challenge.days.map(d => ({
      id: d.id,
      dayNumber: d.dayNumber,
      title: d.title,
      titleAr: d.titleAr,
      theme: d.theme,
      activityType: d.activityType,
      duaOfDay: d.duaOfDay,
      hadithOfDay: d.hadithOfDay,
      unlocked: isDayUnlocked(d.dayNumber, enrollment.challenge.startDate),
      completed: completedDayIds.has(d.id),
      isToday: d.dayNumber === currentDay,
    }));

    return NextResponse.json({
      enrollment: {
        id: enrollment.id,
        childName: enrollment.childName,
        childAge: enrollment.childAge,
        badgesEarned: enrollment.badgesEarned ? enrollment.badgesEarned.split(",").filter(Boolean) : [],
        streakDays: enrollment.streakDays,
        shareCount: enrollment.shareCount,
      },
      challenge: {
        year: enrollment.challenge.year,
        title: enrollment.challenge.title,
        startDate: enrollment.challenge.startDate,
      },
      currentDay,
      totalCompleted: enrollment.completions.length,
      days,
    });
  } catch (error) {
    console.error("Ramadan dashboard error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
