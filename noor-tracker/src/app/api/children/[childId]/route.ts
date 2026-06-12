import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { childSchema } from "@/lib/validations";

export async function PUT(
  request: Request,
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

  const body = await request.json();
  const result = childSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Ongeldige invoer." },
      { status: 400 }
    );
  }

  const updated = await prisma.child.update({
    where: { id: params.childId },
    data: {
      name: result.data.name,
      age: result.data.age,
      avatar: result.data.avatar,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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

  await prisma.child.delete({ where: { id: params.childId } });

  return NextResponse.json({ success: true });
}
