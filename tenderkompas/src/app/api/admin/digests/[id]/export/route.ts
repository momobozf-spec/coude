import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digest } from "@/db/schema";
import { getSessionUser } from "@/lib/dal";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getSessionUser();
  if (!u || u.platformRole !== "admin") return new Response("Niet gevonden", { status: 404 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Niet gevonden", { status: 404 });
  const d = await db.query.digest.findFirst({ where: eq(digest.id, id) });
  if (!d) return new Response("Niet gevonden", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "txt" ? "txt" : "html";
  return new Response(format === "txt" ? `Onderwerp: ${d.subject}\n\n${d.textBody}` : d.html, {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="digest-${d.id.slice(0, 8)}.${format}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
