import { requireAdmin } from "@/lib/authz";
import { NextRequest, NextResponse } from "next/server";
import { listVideos, getVideoStats, deleteVideo, isBunnyConfigured } from "@/lib/bunny";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  if (!isBunnyConfigured()) {
    return NextResponse.json({ error: "Bunny.net not configured" }, { status: 503 });
  }

  try {
    const data = await listVideos();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const { videoId } = await req.json();
    if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

    await deleteVideo(videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
