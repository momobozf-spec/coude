import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { habitLogSchema } from "@/lib/validations";
import { countStars } from "@/lib/habits";
import { serializeHabits, deserializeHabits } from "@/lib/habits-db";

export async function GET(
  _request: Request,
  { params }: { params: { childId: string; date: string } }
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

  const log = await prisma.habitLog.findUnique({
    where: {
      childId_date: {
        childId: params.childId,
        date: params.date,
      },
    },
  });

  if (!log) {
    return NextResponse.json({ habits: {}, stars: 0 });
  }

  return NextResponse.json({
    ...log,
    habits: deserializeHabits(log.habits),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { childId: string; date: string } }
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

  const body = await request.json();
  const result = habitLogSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Ongeldige invoer." },
      { status: 400 }
    );
  }

  const stars = countStars(result.data.habits);
  const habitsStr = serializeHabits(result.data.habits);

  const log = await prisma.habitLog.upsert({
    where: {
      childId_date: {
        childId: params.childId,
        date: params.date,
      },
    },
    create: {
      childId: params.childId,
      date: params.date,
      habits: habitsStr,
      stars,
    },
    update: {
      habits: habitsStr,
      stars,
    },
  });

  return NextResponse.json({
    ...log,
    habits: deserializeHabits(log.habits),
  });
}
