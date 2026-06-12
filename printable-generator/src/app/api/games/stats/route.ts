import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let stats = await prisma.gameStats.findUnique({ where: { userId: session.user.id } });
    if (!stats) stats = await prisma.gameStats.create({ data: { userId: session.user.id } });

    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
