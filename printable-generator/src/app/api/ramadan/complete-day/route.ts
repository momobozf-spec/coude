import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkNewBadges, isDayUnlocked } from "@/lib/ramadan";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { dayId } = await req.json();
    if (!dayId) return NextResponse.json({ error: "dayId required" }, { status: 400 });

    const day = await prisma.challengeDay.findUnique({ where: { id: dayId }, include: { challenge: true } });
    if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 });

    if (!isDayUnlocked(day.dayNumber, day.challenge.startDate)) {
      return NextResponse.json({ error: "Day not yet unlocked" }, { status: 403 });
    }

    const enrollment = await prisma.challengeEnrollment.findUnique({
      where: { userId_challengeId: { userId: session.user.id, challengeId: day.challengeId } },
      include: { completions: true },
    });
    if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

    // Already completed?
    const alreadyDone = enrollment.completions.find(c => c.dayId === dayId);
    if (alreadyDone) return NextResponse.json({ alreadyCompleted: true, streakDays: enrollment.streakDays });

    // Create completion
    await prisma.dayCompletion.create({
      data: { enrollmentId: enrollment.id, dayId },
    });

    // Calculate streak: check if yesterday was completed
    const yesterday = day.dayNumber - 1;
    const allCompletedDayNumbers = enrollment.completions.map(c => c.dayId);
    // Fetch all day numbers completed
    const completedDays = await prisma.dayCompletion.findMany({
      where: { enrollmentId: enrollment.id },
      include: { day: { select: { dayNumber: true } } },
    });
    const completedNumbers = new Set(completedDays.map(c => c.day.dayNumber));
    completedNumbers.add(day.dayNumber); // include current

    // Count streak backwards from today
    let streak = 0;
    for (let d = day.dayNumber; d >= 1; d--) {
      if (completedNumbers.has(d)) streak++;
      else break;
    }

    const totalCompleted = completedNumbers.size;
    const existingBadges = enrollment.badgesEarned ? enrollment.badgesEarned.split(",").filter(Boolean) : [];
    const newBadges = checkNewBadges(totalCompleted, streak, enrollment.shareCount, existingBadges);
    const allBadges = [...existingBadges, ...newBadges];

    await prisma.challengeEnrollment.update({
      where: { id: enrollment.id },
      data: {
        streakDays: streak,
        badgesEarned: allBadges.join(","),
      },
    });

    return NextResponse.json({
      completed: true,
      streakDays: streak,
      totalCompleted,
      newBadges,
      allBadges,
      allComplete: totalCompleted >= 30,
    });
  } catch (error) {
    console.error("Complete day error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
