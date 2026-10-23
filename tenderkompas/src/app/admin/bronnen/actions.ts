"use server";
import { db } from "@/db";
import { requireAdmin } from "@/lib/dal";
import { runAction, str } from "@/lib/action-helpers";
import { runTedImport } from "@/lib/ted/importer";

export async function runTedImportAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/bronnen", async () => {
    const mode = str(fd, "mode");
    const to = new Date();
    const from = mode === "sample90" ? new Date(to.getTime() - 90 * 86_400_000) : undefined;
    const res = await runTedImport(db, { trigger: mode === "sample90" ? "sample" : "manual", actorUserId: admin.id, from, to });
    if (res.skipped) return "Deze importtaak was al geslaagd.";
    const r = res.run;
    if (r.status === "failed") throw new Error(`Import mislukt: ${r.errorMessage}. Dit betekent NIET dat er geen nieuwe kansen zijn.`);
    return `Import ${r.status}: ${r.fetchedCount} opgehaald, ${r.newProcedures} nieuwe procedures, ${r.newNotices} nieuwe publicaties, ${r.changedProcedures} gewijzigd, ${r.duplicateNotices} dubbel.${r.errorMessage ? " Let op: " + r.errorMessage : ""}`;
  });
}
