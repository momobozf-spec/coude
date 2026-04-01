import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolFromSubdomain } from "@/lib/white-label";

// GET: fetch branding for a subdomain (public, used by middleware)
export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get("subdomain");
  if (!subdomain) return NextResponse.json({ error: "subdomain required" }, { status: 400 });

  const branding = await getSchoolFromSubdomain(subdomain);
  if (!branding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ branding });
}

// PUT: update branding (school admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { whiteLabelId: true, whiteLabelRole: true },
    });

    if (!user?.whiteLabelId || user.whiteLabelRole !== "admin") {
      return NextResponse.json({ error: "Not a school admin" }, { status: 403 });
    }

    const body = await req.json();
    const { logoUrl, primaryColor, secondaryColor, schoolName, schoolNameAr, welcomeMessage, footerText } = body;

    await prisma.whiteLabelAccount.update({
      where: { id: user.whiteLabelId },
      data: {
        ...(logoUrl !== undefined && { logoUrl }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
        ...(schoolName && { schoolName }),
        ...(schoolNameAr !== undefined && { schoolNameAr }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(footerText !== undefined && { footerText }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Branding update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
