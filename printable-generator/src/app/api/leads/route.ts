import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const leadSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await prisma.lead.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: {
        email: parsed.data.email,
        source: parsed.data.source || "landing",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
