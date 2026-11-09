import { NextResponse } from "next/server";
import { findMunicipalities } from "@/lib/catalog";

/** Gemeente-opzoeking voor de wizard (postcode of naam). Publiek, alleen-lezen. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);
  const rows = await findMunicipalities(q, 8);
  return NextResponse.json(rows.map((r) => ({ postcode: r.postcode, nameNl: r.nameNl, nameFr: r.nameFr, active: r.regionActive, regionNl: r.regionNameNl, regionFr: r.regionNameFr })));
}
