import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAndAwardBadges } from "@/lib/badge-engine";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const trigger = await req.json();
    const result = await checkAndAwardBadges(session.user.id, trigger);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Achievement check error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
