import { and, eq, gte, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { importRun, lot, notice, procedure } from "@/db/schema";
import { isPotentiallyRelevant } from "@/lib/domain/catalog";
import { effectiveLifecycle } from "@/lib/domain/lifecycle";

/**
 * Steekproefrapport op basis van WERKELIJK geïmporteerde TED-gegevens. Zonder geslaagde import: geen aantallen.
 */
export async function sampleReport(database: DB, days = 90, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const runs = await database
    .select()
    .from(importRun)
    .where(and(eq(importRun.sourceId, "ted"), gte(importRun.startedAt, since)));
  const successful = runs.filter((r) => r.status === "success" || r.status === "partial");
  const notices = await database
    .select({ procedureId: notice.procedureId })
    .from(notice)
    .where(and(eq(notice.sourceId, "ted"), gte(notice.publicationDate, since)));
  const procIds = Array.from(new Set(notices.map((n) => n.procedureId)));
  if (procIds.length === 0) {
    return {
      available: false as const,
      since,
      runs,
      message: successful.length
        ? "Import geslaagd maar geen aankondigingen in de periode."
        : "Geen geslaagde TED-import in deze periode: er worden bewust GEEN aantallen gerapporteerd.",
    };
  }
  const procs = await database.select().from(procedure).where(inArray(procedure.id, procIds));
  const lots = await database.select().from(lot).where(inArray(lot.procedureId, procIds));
  const relevant = procs.filter((p) => isPotentiallyRelevant({ cpvCodes: p.cpvCodes, text: [p.title, p.description].filter(Boolean).join(" ") }).relevant);
  const relIds = new Set(relevant.map((p) => p.id));
  const byLifecycle: Record<string, number> = {};
  for (const p of relevant) byLifecycle[effectiveLifecycle(p)] = (byLifecycle[effectiveLifecycle(p)] ?? 0) + 1;
  return {
    available: true as const,
    since,
    runs,
    totalProcedures: procs.length,
    relevantProcedures: relevant.length,
    relevantLots: lots.filter((l) => relIds.has(l.procedureId)).length,
    relevantWithoutLots: relevant.filter((p) => !lots.some((l) => l.procedureId === p.id)).length,
    byLifecycle,
  };
}
