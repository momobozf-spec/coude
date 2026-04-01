import { NextRequest, NextResponse } from "next/server";
import { listVideos, getVideoStats, deleteVideo, isBunnyConfigured } from "@/lib/bunny";

export async function GET(req: NextRequest) {
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

    await deleteVideo(videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
