"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { CrmImportService } from "@/services/crm-import-service";
import { WorkflowService } from "@/services/workflow-service";
import type { OpportunityStatus } from "@/generated/prisma";

const workflow = new WorkflowService(prisma);

const STATUS_VALUES = [
  "NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "INTERESTED", "VALUATION_BOOKED",
  "MANDATE_PROPOSED", "MANDATE_WON", "LOST", "DISMISSED", "SNOOZED",
] as const;

const statusSchema = z.object({
  opportunityId: z.string().min(1),
  status: z.enum(STATUS_VALUES),
});

export async function changeOpportunityStatus(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  const parsed = statusSchema.parse({
    opportunityId: formData.get("opportunityId"),
    status: formData.get("status"),
  });
  await workflow.changeStatus(
    user.agencyId,
    parsed.opportunityId,
    parsed.status as OpportunityStatus,
    user.id,
  );
  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidatePath(`/opportunities/${parsed.opportunityId}`);
}

const assignSchema = z.object({
  opportunityId: z.string().min(1),
  assignedToId: z.string().min(1),
});

export async function assignOpportunity(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  const parsed = assignSchema.parse({
    opportunityId: formData.get("opportunityId"),
    assignedToId: formData.get("assignedToId"),
  });
  await workflow.assign(user.agencyId, parsed.opportunityId, parsed.assignedToId, user.id);
  revalidatePath("/");
  revalidatePath(`/opportunities/${parsed.opportunityId}`);
}

const noteSchema = z.object({
  opportunityId: z.string().min(1),
  note: z.string().min(1).max(2000),
});

export async function addOpportunityNote(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  const parsed = noteSchema.parse({
    opportunityId: formData.get("opportunityId"),
    note: formData.get("note"),
  });
  await workflow.addNote(user.agencyId, parsed.opportunityId, user.id, parsed.note);
  revalidatePath(`/opportunities/${parsed.opportunityId}`);
}

const territorySchema = z.object({
  kind: z.enum(["POSTAL_CODE", "MUNICIPALITY", "PROVINCE"]),
  value: z.string().min(1).max(60),
});

export async function addTerritory(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  if (user.role === "AGENT") throw new Error("Only agency admins can manage territories");
  const parsed = territorySchema.parse({
    kind: formData.get("kind"),
    value: formData.get("value"),
  });
  const value =
    parsed.kind === "POSTAL_CODE"
      ? parsed.value.replace(/\D/g, "")
      : parsed.value.trim().toLowerCase();
  if (parsed.kind === "POSTAL_CODE" && !/^[1-9]\d{3}$/.test(value)) {
    throw new Error("Invalid Belgian postal code");
  }
  await tenantDb(user.agencyId).createTerritory({
    kind: parsed.kind,
    value,
    label: parsed.kind === "POSTAL_CODE" ? value : parsed.value.trim(),
  });
  revalidatePath("/territories");
}

export async function removeTerritory(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  if (user.role === "AGENT") throw new Error("Only agency admins can manage territories");
  const id = z.string().min(1).parse(formData.get("territoryId"));
  await tenantDb(user.agencyId).deleteTerritory(id);
  revalidatePath("/territories");
}

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function uploadCrmCsv(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");
  if (file.size === 0 || file.size > MAX_CSV_BYTES) {
    throw new Error("CSV must be between 1 byte and 5 MB");
  }
  const content = await file.text();
  const service = new CrmImportService(prisma);
  await service.importCsv(user.agencyId, user.id, file.name, content);
  revalidatePath("/imports");
  revalidatePath("/leadrevive");
}

const settingsSchema = z.object({
  telegramChatId: z.string().max(64).optional(),
  minAlertScore: z.coerce.number().int().min(0).max(100),
  digestHourLocal: z.coerce.number().int().min(0).max(23),
  digestEnabled: z.boolean(),
  instantAlertsEnabled: z.boolean(),
});

export async function updateAgencySettings(formData: FormData): Promise<void> {
  const user = await requireAgencyUser();
  if (user.role === "AGENT") throw new Error("Only agency admins can change settings");
  const parsed = settingsSchema.parse({
    telegramChatId: formData.get("telegramChatId") ?? undefined,
    minAlertScore: formData.get("minAlertScore"),
    digestHourLocal: formData.get("digestHourLocal"),
    digestEnabled: formData.get("digestEnabled") === "on",
    instantAlertsEnabled: formData.get("instantAlertsEnabled") === "on",
  });
  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      telegramChatId: parsed.telegramChatId?.trim() || null,
      minAlertScore: parsed.minAlertScore,
      digestHourLocal: parsed.digestHourLocal,
      digestEnabled: parsed.digestEnabled,
      instantAlertsEnabled: parsed.instantAlertsEnabled,
    },
  });
  await prisma.auditLog.create({
    data: { agencyId: user.agencyId, userId: user.id, action: "SETTINGS_UPDATE", entity: "Agency" },
  });
  revalidatePath("/settings");
}
