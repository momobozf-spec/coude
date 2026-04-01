import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      include: {
        reviews: { select: { rating: true } },
        enrollments: userId ? { where: { userId }, select: { id: true, completedAt: true } } : false,
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });

    const result = courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      titleAr: c.titleAr,
      description: c.description,
      thumbnail: c.thumbnail,
      price: c.price,
      currency: c.currency,
      languages: c.languages.split(","),
      ageRange: c.ageRange,
      category: c.category,
      totalLessons: c.totalLessons,
      totalMinutes: c.totalMinutes,
      isFeatured: c.isFeatured,
      trailerUrl: c.trailerUrl,
      avgRating: c.reviews.length > 0 ? c.reviews.reduce((s, r) => s + r.rating, 0) / c.reviews.length : null,
      reviewCount: c.reviews.length,
      enrollmentCount: c._count.enrollments,
      enrolled: userId ? c.enrollments.length > 0 : false,
      completed: userId ? c.enrollments.some((e) => !!e.completedAt) : false,
    }));

    return NextResponse.json({ courses: result });
  } catch (error) {
    console.error("Courses list error:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
