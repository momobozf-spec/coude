import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessment, document, membership } from "@/db/schema";
import { getSessionUser } from "@/lib/dal";
import { readDocumentFile } from "@/lib/services/documents";

/** Beschermde download: beheerder, of lid van een organisatie met een gepubliceerde beoordeling voor deze opdracht. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u) return new Response("Niet aangemeld", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Niet gevonden", { status: 404 });
  const doc = await db.query.document.findFirst({ where: eq(document.id, id) });
  if (!doc) return new Response("Niet gevonden", { status: 404 });
  if (u.platformRole !== "admin") {
    const allowed = await db
      .select({ id: assessment.id })
      .from(assessment)
      .innerJoin(membership, eq(membership.organizationId, assessment.organizationId))
      .where(and(eq(membership.userId, u.id), eq(assessment.procedureId, doc.procedureId), eq(assessment.status, "published")))
      .limit(1);
    if (!allowed.length) return new Response("Niet gevonden", { status: 404 });
  }
  const buf = await readDocumentFile(doc);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${doc.filename.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
