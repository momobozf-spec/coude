"use server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/dal";
import { runAction, str } from "@/lib/action-helpers";
import { saveScoringConfig } from "@/lib/services/assessments";
import { scoringConfigSchema } from "@/lib/domain/scoring-config";
import { applyRetention } from "@/lib/services/retention";

export async function saveScoringConfigAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/instellingen", async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(str(fd, "config"));
    } catch {
      throw new Error("Ongeldige JSON.");
    }
    const v = await saveScoringConfig(db, scoringConfigSchema.parse(parsed), str(fd, "note") || "zonder toelichting", admin.id);
    return `Versie ${v} actief. Bestaande beoordelingen behouden hun versie; herbereken waar nodig.`;
  });
}

export async function runRetentionAction() {
  const admin = await requireAdmin();
  await runAction("/admin/instellingen", async () => {
    const r = await applyRetention(db, admin.id);
    return `Bewaartermijnen toegepast: ${r.payloadsCleared} ruwe payloads gewist, ${r.auditDeleted} auditregels en ${r.leadsDeleted} aanvragen verwijderd.`;
  });
}
