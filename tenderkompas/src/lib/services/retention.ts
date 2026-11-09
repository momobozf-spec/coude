import { and, isNotNull, lt } from "drizzle-orm";
import type { DB } from "@/db";
import { auditLog, leadRequest, notice } from "@/db/schema";
import { audit } from "@/lib/audit";

/** Configureerbare bewaartermijnen (dagen) via omgevingsvariabelen. Brongegevens zelf blijven (herleidbaarheid); enkel ruwe payloads worden gewist. */
export async function applyRetention(database: DB, actorUserId: string | null, now = new Date()) {
  const days = (k: string, d: number) => Number(process.env[k] ?? d);
  const cutoff = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const payloads = await database
    .update(notice)
    .set({ rawPayload: null })
    .where(and(lt(notice.fetchedAt, cutoff(days("RETENTION_RAW_PAYLOAD_DAYS", 365))), isNotNull(notice.rawPayload)))
    .returning({ id: notice.id });
  const audits = await database.delete(auditLog).where(lt(auditLog.at, cutoff(days("RETENTION_AUDIT_DAYS", 730)))).returning({ id: auditLog.id });
  const leads = await database.delete(leadRequest).where(lt(leadRequest.createdAt, cutoff(days("RETENTION_LEADS_DAYS", 180)))).returning({ id: leadRequest.id });
  const r = { payloadsCleared: payloads.length, auditDeleted: audits.length, leadsDeleted: leads.length };
  await audit(database, { actorUserId, action: "retention.applied", entityType: "system", details: r });
  return r;
}
