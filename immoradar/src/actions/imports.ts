"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { assertPermission } from "@/lib/auth/permissions";
import { toSafeErrorMessage } from "@/lib/errors";
import { importCsv } from "@/services/leadrevive-import";
import { detectDormantOpportunities } from "@/services/leadrevive-engine";

const MAX_BYTES = 10 * 1024 * 1024;

function isRedirect(err: unknown): boolean {
  return !!err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function importCsvAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  assertPermission(ctx, "crm:import");
  const file = formData.get("file");
  try {
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file to import");
    if (file.size > MAX_BYTES) throw new Error("File is larger than 10 MB");
    if (!/\.(csv|txt)$/i.test(file.name)) throw new Error("Only .csv files are supported");
    const text = await file.text();
    const summary = await importCsv(db, ctx, text, file.name);
    await detectDormantOpportunities(db, ctx.agencyId);
    redirect(`/imports/${summary.importId}?ok=${encodeURIComponent(`Imported ${summary.created} new, ${summary.updated} enriched, ${summary.duplicates} duplicates, ${summary.conflicts} conflicts, ${summary.invalid} invalid`)}`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`/imports?error=${encodeURIComponent(toSafeErrorMessage(err))}`);
  }
}
