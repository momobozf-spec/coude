import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { lessonId, watchedSeconds, completed } = await req.json();
    if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

    // Verify enrollment
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true },
    });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: lesson.courseId } },
    });
    if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

    // Upsert progress
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      update: {
        watchedSeconds: watchedSeconds ?? undefined,
        completed: completed ?? undefined,
        completedAt: completed ? new Date() : undefined,
      },
      create: {
        userId: session.user.id,
        lessonId,
        watchedSeconds: watchedSeconds ?? 0,
        completed: completed ?? false,
        completedAt: completed ? new Date() : null,
      },
    });

    // Check if all lessons in course are completed
    if (completed) {
      const allLessons = await prisma.lesson.findMany({
        where: { courseId: lesson.courseId },
        select: { id: true },
      });
      const completedLessons = await prisma.lessonProgress.count({
        where: {
          userId: session.user.id,
          lessonId: { in: allLessons.map((l) => l.id) },
          completed: true,
        },
      });

      if (completedLessons >= allLessons.length && !enrollment.completedAt) {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { completedAt: new Date() },
        });
        return NextResponse.json({ saved: true, courseCompleted: true });
      }
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Progress save error:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
