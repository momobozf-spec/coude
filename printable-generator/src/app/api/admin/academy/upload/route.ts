import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVideo, uploadVideo, getEmbedUrl, getThumbnailUrl, isBunnyConfigured } from "@/lib/bunny";

export async function POST(req: NextRequest) {
  // Admin auth
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBunnyConfigured()) {
    return NextResponse.json({ error: "Bunny.net not configured. Set BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY in .env.local" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;
    const title = formData.get("title") as string;
    const courseId = formData.get("courseId") as string;
    const lessonOrder = parseInt(formData.get("order") as string || "1");
    const isFree = formData.get("isFree") === "true";
    const description = formData.get("description") as string || "";

    if (!file || !title || !courseId) {
      return NextResponse.json({ error: "video, title, and courseId are required" }, { status: 400 });
    }

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Step 1: Create video entry on Bunny
    const { videoId } = await createVideo(`${course.title} — ${title}`);

    // Step 2: Upload file binary
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadVideo(videoId, buffer);

    // Step 3: Create lesson record in DB
    const embedUrl = getEmbedUrl(videoId);
    const thumbnailUrl = getThumbnailUrl(videoId);

    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        title,
        description,
        videoUrl: embedUrl,
        duration: 0, // Will be updated when Bunny finishes processing
        order: lessonOrder,
        isFree,
      },
    });

    // Step 4: Update course lesson count
    const lessonCount = await prisma.lesson.count({ where: { courseId } });
    await prisma.course.update({
      where: { id: courseId },
      data: { totalLessons: lessonCount },
    });

    return NextResponse.json({
      success: true,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        videoId,
        embedUrl,
        thumbnailUrl,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
