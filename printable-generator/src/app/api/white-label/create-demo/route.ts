import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDemoToken } from "@/lib/white-label";

export async function POST(req: NextRequest) {
  // Admin only
  const adminPwd = req.headers.get("x-admin-password");
  if (adminPwd !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { schoolName, contactEmail } = await req.json();
    if (!schoolName || !contactEmail) {
      return NextResponse.json({ error: "schoolName and contactEmail required" }, { status: 400 });
    }

    const token = generateDemoToken();
    await prisma.whiteLabelDemo.create({
      data: { schoolName, contactEmail, token },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com";
    const demoUrl = `${appUrl}/white-label?demo=${token}`;

    return NextResponse.json({ success: true, token, demoUrl });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
