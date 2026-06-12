import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return user?.role === "ADMIN";
}

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, slug, description, image } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: { name, slug, description, image },
    });

    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
