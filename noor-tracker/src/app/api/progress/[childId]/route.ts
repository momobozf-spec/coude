import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deserializeHabits } from "@/lib/habits-db";

export async function GET(
  _request: Request,
  { params }: { params: { childId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const child = await prisma.child.findFirst({
    where: { id: params.childId, userId: session.user.id },
  });

  if (!child) {
    return NextResponse.json({ error: "Kind niet gevonden" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  // Free plan: last 7 days. Pro: all logs
  const dateLimit = new Date();
  const isPro = user?.plan === "pro";

  if (!isPro) {
    dateLimit.setDate(dateLimit.getDate() - 7);
  } else {
    dateLimit.setDate(dateLimit.getDate() - 90);
  }

  const dateLimitStr = dateLimit.toISOString().split("T")[0];

  const logs = await prisma.habitLog.findMany({
    where: {
      childId: params.childId,
      date: { gte: dateLimitStr },
    },
    orderBy: { date: "desc" },
  });

  const parsedLogs = logs.map((log) => ({
    ...log,
    habits: deserializeHabits(log.habits),
  }));

  return NextResponse.json({
    logs: parsedLogs,
    isPro,
    child: { name: child.name, avatar: child.avatar },
  });
}
