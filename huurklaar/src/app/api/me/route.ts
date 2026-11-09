import { NextResponse } from "next/server";
import { canExportPdf, getAccount } from "@/lib/account";
import { intEnv } from "@/lib/env";
import { clientIp, limit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = await limit(`me:${clientIp(req)}`, 600, 3600);
  if (limited) return limited;
  const a = await getAccount();
  const free = intEnv("FREE_CHECKS", 3) + (a?.bonusChecks ?? 0);
  return NextResponse.json({
    loggedIn: !!a,
    canExportPdf: canExportPdf(a),
    zoekpas: !!a?.zoekpasActive,
    freeChecks: free,
    checksLeft: a ? (a.zoekpasActive ? null : Math.max(0, free - a.checksUsed)) : free,
  });
}
