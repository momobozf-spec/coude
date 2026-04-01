import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, freeCoursesRedeemed: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.plan !== "pro" && user.plan !== "school") {
      return NextResponse.json({ error: "Pro or School plan required" }, { status: 403 });
    }
    if (user.freeCoursesRedeemed >= 1) {
      return NextResponse.json({ error: "Free course already redeemed" }, { status: 409 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
    });
    if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

    await prisma.$transaction([
      prisma.enrollment.create({
        data: { userId: session.user.id, courseId, pricePaid: 0 },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { freeCoursesRedeemed: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true, courseSlug: course.slug });
  } catch (error) {
    console.error("Redeem error:", error);
    return NextResponse.json({ error: "Failed to redeem" }, { status: 500 });
  }
}
