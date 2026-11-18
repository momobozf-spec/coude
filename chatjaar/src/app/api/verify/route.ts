import { NextResponse } from "next/server";
import { getPaidSession } from "@/lib/server-config";


export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  const session = await getPaidSession(sessionId);
  return NextResponse.json({ paid: Boolean(session) }, { headers: { "Cache-Control": "no-store" } });
}
