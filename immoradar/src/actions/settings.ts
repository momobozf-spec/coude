"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { assertPermission } from "@/lib/auth/permissions";
import { toSafeErrorMessage } from "@/lib/errors";
import { audit } from "@/services/audit";

function isRedirect(err: unknown): boolean {
  return !!err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

const agencySettingsSchema = z.object({
  telegramChatId: z.string().trim().max(64).optional().transform((v) => (v ? v : null)),
  alertMinScore: z.coerce.number().int().min(0).max(100),
  digestEnabled: z.coerce.boolean(),
  digestHourLocal: z.coerce.number().int().min(0).max(23),
  dormantMonths: z.coerce.number().int().min(1).max(120),
  crmRetentionDays: z.union([z.literal(""), z.coerce.number().int().min(30).max(3650)]).transform((v) => (v === "" ? null : v)),
  autoAssignByAgent: z.coerce.boolean(),
});

export async function updateAgencySettingsAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  try {
    assertPermission(ctx, "settings:write");
    const data = agencySettingsSchema.parse({
      telegramChatId: formData.get("telegramChatId") ?? "",
      alertMinScore: formData.get("alertMinScore"),
      digestEnabled: formData.get("digestEnabled") === "on",
      digestHourLocal: formData.get("digestHourLocal"),
      dormantMonths: formData.get("dormantMonths"),
      crmRetentionDays: formData.get("crmRetentionDays") ?? "",
      autoAssignByAgent: formData.get("autoAssignByAgent") === "on",
    });
    await db.agency.update({ where: { id: ctx.agencyId }, data });
    await db.alertRule.upsert({ where: { agencyId_type_channel: { agencyId: ctx.agencyId, type: "HOT_OPPORTUNITY", channel: "TELEGRAM" } }, create: { agencyId: ctx.agencyId, type: "HOT_OPPORTUNITY", minScore: data.alertMinScore }, update: { minScore: data.alertMinScore } });
    await db.alertRule.upsert({ where: { agencyId_type_channel: { agencyId: ctx.agencyId, type: "MORNING_DIGEST", channel: "TELEGRAM" } }, create: { agencyId: ctx.agencyId, type: "MORNING_DIGEST", enabled: data.digestEnabled }, update: { enabled: data.digestEnabled } });
    await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "settings.agency.update", metadata: { alertMinScore: data.alertMinScore, digestHourLocal: data.digestHourLocal, dormantMonths: data.dormantMonths, crmRetentionDays: data.crmRetentionDays } });
    redirect("/settings?ok=Settings+saved");
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`/settings?error=${encodeURIComponent(toSafeErrorMessage(err))}`);
  }
}

export async function updateMyTelegramAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const chatId = z.string().trim().max(64).parse(formData.get("telegramChatId") ?? "");
  await db.user.update({ where: { id: ctx.userId }, data: { telegramChatId: chatId || null } });
  await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "settings.user.telegram" });
  redirect("/settings?ok=Your+Telegram+chat+was+saved");
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  try {
    assertPermission(ctx, "crm:delete");
    const id = z.string().min(1).parse(formData.get("contactId"));
    const contact = await db.crmContact.findFirst({ where: { id, agencyId: ctx.agencyId } });
    if (!contact) throw new Error("Contact not found");
    await db.$transaction([
      db.crmContact.update({ where: { id }, data: { deletedAt: new Date(), firstName: null, lastName: null, email: null, normalizedEmail: null, phone: null, normalizedPhone: null, address: null, normalizedAddressKey: null, notes: null, sourceValues: undefined } }),
      db.crmInteraction.deleteMany({ where: { contactId: id, agencyId: ctx.agencyId } }),
      db.contactPropertyRelationship.deleteMany({ where: { contactId: id, agencyId: ctx.agencyId } }),
      db.opportunity.updateMany({ where: { contactId: id, agencyId: ctx.agencyId, status: { in: ["NEW", "ASSIGNED", "TO_CONTACT"] } }, data: { status: "DISMISSED", closedAt: new Date() } }),
    ]);
    await audit(db, { agencyId: ctx.agencyId, userId: ctx.userId, action: "crm.contact.delete", entityType: "CrmContact", entityId: id });
    redirect("/leadrevive?ok=Contact+deleted+and+personal+data+erased");
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`/leadrevive?error=${encodeURIComponent(toSafeErrorMessage(err))}`);
  }
}
