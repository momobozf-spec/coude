"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/tenant";
import { AGENCY_COOKIE } from "@/lib/auth/tenant";
import { assertPermission } from "@/lib/auth/permissions";
import { isProduction } from "@/lib/env";
import { audit } from "@/services/audit";
import { runCollectJob, runDigestJob, runLeadReviveJob } from "@/jobs/pipeline";

export async function switchAgencyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertPermission(user, "platform:admin");
  const agencyId = z.string().min(1).parse(formData.get("agencyId"));
  const agency = await db.agency.findUnique({ where: { id: agencyId } });
  if (!agency) redirect("/admin/agencies?error=Agency+not+found");
  const store = await cookies();
  store.set(AGENCY_COOKIE, agency.id, { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/" });
  await audit(db, { agencyId: agency.id, userId: user.id, action: "admin.switch_agency" });
  redirect("/");
}

export async function toggleSourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertPermission(user, "platform:admin");
  const sourceId = z.string().min(1).parse(formData.get("sourceId"));
  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) redirect("/admin/sources?error=Source+not+found");
  await db.source.update({ where: { id: sourceId }, data: { enabled: !source.enabled, health: source.enabled ? "DISABLED" : "HEALTHY", consecutiveFailures: 0 } });
  await audit(db, { agencyId: null, userId: user.id, action: source.enabled ? "source.disable" : "source.enable", entityType: "Source", entityId: sourceId });
  redirect("/admin/sources?ok=Source+updated");
}

export async function runJobAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertPermission(user, "platform:admin");
  const job = z.enum(["collect", "leadrevive", "digest"]).parse(formData.get("job"));
  await audit(db, { agencyId: null, userId: user.id, action: `job.${job}.manual` });
  if (job === "collect") await runCollectJob(db);
  if (job === "leadrevive") await runLeadReviveJob(db);
  if (job === "digest") await runDigestJob(db, { force: true });
  redirect(`/admin/system?ok=Job+${job}+finished`);
}
