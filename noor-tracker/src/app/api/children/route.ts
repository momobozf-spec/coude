import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { childSchema } from "@/lib/validations";
import { deserializeHabits } from "@/lib/habits-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const children = await prisma.child.findMany({
    where: { userId: session.user.id },
    include: {
      logs: {
        orderBy: { date: "desc" },
        take: 30,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const parsed = children.map((child) => ({
    ...child,
    logs: child.logs.map((log) => ({
      ...log,
      habits: deserializeHabits(log.habits),
    })),
  }));

  return NextResponse.json(parsed);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await request.json();
  const result = childSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Ongeldige invoer." },
      { status: 400 }
    );
  }

  // Check child limit
  const childCount = await prisma.child.count({
    where: { userId: session.user.id },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  const maxChildren = user?.plan === "pro" ? 3 : 1;

  if (childCount >= maxChildren) {
    return NextResponse.json(
      {
        error:
          user?.plan === "pro"
            ? "Je hebt het maximaal aantal kinderen bereikt (3)."
            : "Upgrade naar Pro om meer kinderen toe te voegen.",
        requiresUpgrade: user?.plan !== "pro",
      },
      { status: 403 }
    );
  }

  const child = await prisma.child.create({
    data: {
      name: result.data.name,
      age: result.data.age,
      avatar: result.data.avatar,
      userId: session.user.id,
    },
  });

  return NextResponse.json(child, { status: 201 });
}
