import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { courseId, rating, comment } = await req.json();
    if (!courseId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "courseId and rating (1-5) required" }, { status: 400 });
    }

    // Must be enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
    });
    if (!enrollment) return NextResponse.json({ error: "Must be enrolled to review" }, { status: 403 });

    await prisma.courseReview.upsert({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      update: { rating, comment: comment || null },
      create: { userId: session.user.id, courseId, rating, comment: comment || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
