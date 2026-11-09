import { requireAdmin } from "@/lib/authz";
import { NextRequest, NextResponse } from "next/server";
import { getCommunityStats, createWeeklyQA } from "@/lib/circle";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const stats = await getCommunityStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const { title, description, startsAt, durationMinutes, zoomUrl } = await req.json();
    if (!title || !startsAt) return NextResponse.json({ error: "title and startsAt required" }, { status: 400 });

    const result = await createWeeklyQA({
      title,
      description: description || "",
      startsAt: new Date(startsAt),
      durationMinutes: durationMinutes || 45,
      zoomUrl,
    });

    return NextResponse.json({ success: true, event: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
