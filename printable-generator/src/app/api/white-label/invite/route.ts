import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteToken } from "@/lib/white-label";

export async function GET() {
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

    // Get all teachers in this school
    const [invites, teachers] = await Promise.all([
      prisma.whiteLabelInvite.findMany({ where: { accountId: user.whiteLabelId }, orderBy: { createdAt: "desc" } }),
      prisma.user.findMany({
        where: { whiteLabelId: user.whiteLabelId },
        select: { id: true, name: true, email: true, whiteLabelRole: true, generationsCount: true, updatedAt: true },
      }),
    ]);

    const account = await prisma.whiteLabelAccount.findUnique({
      where: { id: user.whiteLabelId },
      select: { maxSeats: true },
    });

    return NextResponse.json({ invites, teachers, maxSeats: account?.maxSeats || 10 });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const { emails, role } = await req.json();
    if (!emails || !Array.isArray(emails)) return NextResponse.json({ error: "emails required" }, { status: 400 });

    // Check seat limit
    const account = await prisma.whiteLabelAccount.findUnique({ where: { id: user.whiteLabelId }, select: { maxSeats: true } });
    const currentCount = await prisma.user.count({ where: { whiteLabelId: user.whiteLabelId } });
    const remaining = (account?.maxSeats || 10) - currentCount;

    const created: string[] = [];
    for (const email of emails.slice(0, remaining)) {
      if (email && email.includes("@")) {
        try {
          await prisma.whiteLabelInvite.create({
            data: {
              accountId: user.whiteLabelId,
              email: email.trim().toLowerCase(),
              role: role || "teacher",
              token: generateInviteToken(),
            },
          });
          created.push(email);
        } catch { /* duplicate */ }
      }
    }

    return NextResponse.json({ success: true, invited: created.length, remaining: remaining - created.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
