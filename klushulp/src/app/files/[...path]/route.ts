import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobPhoto, jobRequest, provider, providerVerification, requestMatch } from "@/db/schema";
import { readUpload } from "@/lib/uploads";
import { getCurrentUser } from "@/lib/session";

/**
 * Bestanden staan buiten public/ en worden enkel na autorisatie geserveerd:
 * - profielfoto van een dienstverlener: publiek;
 * - klusfoto: klant met toegangstoken (?t=), gematchte dienstverlener, of beheer;
 * - verificatiedocument: eigenaar of beheer.
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = path.join("/");
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  let allowed = isAdmin;
  if (!allowed) {
    const [pp] = await db.select({ id: provider.id }).from(provider).where(eq(provider.photoPath, rel)).limit(1);
    if (pp) allowed = true;
  }
  if (!allowed && rel.startsWith("photos/")) {
    const [ph] = await db.select({ requestId: jobPhoto.requestId }).from(jobPhoto).where(eq(jobPhoto.path, rel)).limit(1);
    if (ph) {
      const token = new URL(req.url).searchParams.get("t");
      if (token) {
        const [r] = await db.select({ id: jobRequest.id }).from(jobRequest).where(and(eq(jobRequest.id, ph.requestId), eq(jobRequest.accessToken, token))).limit(1);
        if (r) allowed = true;
      }
      if (!allowed && user?.role === "provider") {
        const [p] = await db.select({ id: provider.id }).from(provider).where(eq(provider.userId, user.id)).limit(1);
        if (p) {
          const [m] = await db.select().from(requestMatch).where(and(eq(requestMatch.requestId, ph.requestId), eq(requestMatch.providerId, p.id))).limit(1);
          if (m) allowed = true;
        }
      }
    }
  }
  if (!allowed && rel.startsWith("documents/") && user?.role === "provider") {
    const [p] = await db.select({ id: provider.id }).from(provider).where(eq(provider.userId, user.id)).limit(1);
    if (p) {
      const [v] = await db.select().from(providerVerification).where(and(eq(providerVerification.providerId, p.id), eq(providerVerification.documentPath, rel))).limit(1);
      if (v) allowed = true;
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });
  const file = await readUpload(rel);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.buf), { headers: { "content-type": file.mimeType, "cache-control": "private, max-age=3600", "content-disposition": "inline" } });
}
