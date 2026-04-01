import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedEmbedUrl, getEmbedUrl, isBunnyConfigured } from "@/lib/bunny";

interface Props { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    const course = await prisma.course.findUnique({
      where: { slug, isPublished: true },
      include: {
        lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, description: true, duration: true, order: true, isFree: true, videoUrl: true, transcript: true } },
        reviews: { select: { rating: true, comment: true, userId: true, createdAt: true } },
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let enrollment = null;
    let lessonProgress: Record<string, { watchedSeconds: number; completed: boolean }> = {};

    if (userId) {
      enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });

      if (enrollment) {
        const progress = await prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: course.lessons.map((l) => l.id) } },
        });
        progress.forEach((p) => {
          lessonProgress[p.lessonId] = { watchedSeconds: p.watchedSeconds, completed: p.completed };
        });
      }
    }

    const isEnrolled = !!enrollment;
    const avgRating = course.reviews.length > 0
      ? course.reviews.reduce((s, r) => s + r.rating, 0) / course.reviews.length
      : null;

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        titleAr: course.titleAr,
        description: course.description,
        thumbnail: course.thumbnail,
        trailerUrl: course.trailerUrl,
        price: course.price,
        currency: course.currency,
        languages: course.languages.split(","),
        ageRange: course.ageRange,
        level: course.level,
        category: course.category,
        totalLessons: course.totalLessons,
        totalMinutes: course.totalMinutes,
        isFeatured: course.isFeatured,
        avgRating,
        reviewCount: course.reviews.length,
        enrollmentCount: course._count.enrollments,
      },
      lessons: course.lessons.map((l) => {
        let videoUrl: string | null = null;
        if (isEnrolled || l.isFree) {
          // If Bunny is configured and URL is a Bunny embed, sign it for enrolled users
          if (isBunnyConfigured() && l.videoUrl && l.videoUrl.includes("mediadelivery.net")) {
            const videoId = l.videoUrl.split("/").pop() || "";
            videoUrl = isEnrolled
              ? getSignedEmbedUrl(videoId, 14400) // 4 hours
              : getEmbedUrl(videoId); // unsigned for free previews
          } else {
            videoUrl = l.videoUrl;
          }
        }
        return {
          ...l,
          videoUrl,
          transcript: isEnrolled || l.isFree ? l.transcript : null,
          progress: lessonProgress[l.id] || null,
        };
      }),
      reviews: course.reviews,
      isEnrolled,
      completedAt: enrollment?.completedAt || null,
    });
  } catch (error) {
    console.error("Course detail error:", error);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}
