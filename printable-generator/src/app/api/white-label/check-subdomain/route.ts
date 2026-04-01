import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RESERVED = ["www", "api", "admin", "app", "mail", "blog", "help", "support", "noor", "test", "demo", "staging"];

export async function GET(req: NextRequest) {
  const subdomain = req.nextUrl.searchParams.get("subdomain")?.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!subdomain || subdomain.length < 3) {
    return NextResponse.json({ available: false, error: "Subdomain must be at least 3 characters" });
  }

  if (RESERVED.includes(subdomain)) {
    return NextResponse.json({ available: false, error: "This subdomain is reserved" });
  }

  const existing = await prisma.whiteLabelAccount.findUnique({ where: { subdomain } });

  const suggestions = existing ? [
    `${subdomain}-school`, `${subdomain}-edu`, `${subdomain}-academy`,
  ] : [];

  return NextResponse.json({ available: !existing, suggestions });
}
