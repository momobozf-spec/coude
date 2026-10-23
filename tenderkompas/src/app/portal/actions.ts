"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireClient } from "@/lib/dal";
import { list, optStr, runAction, str } from "@/lib/action-helpers";
import { recordFeedback, setTracking } from "@/lib/services/client";
import { saveProfile } from "@/lib/services/organizations";
import { parseProfileForm } from "@/lib/profile-from-form";
import { audit } from "@/lib/audit";

/* Organisatie komt ALTIJD uit de sessie, nooit uit het formulier. */

export async function feedbackAction(fd: FormData) {
  const c = await requireClient();
  const procedureId = z.uuid().parse(str(fd, "procedureId"));
  await runAction(`/portal/kansen/${procedureId}`, async () => {
    const kind = z.enum(["interesting", "not_relevant", "investigating", "bid_submitted", "won", "lost"]).parse(str(fd, "kind"));
    await recordFeedback(db, { organizationId: c.organizationId, procedureId, userId: c.user.id, kind, reason: optStr(fd, "reason") });
    return "Bedankt, uw feedback is opgeslagen.";
  });
}

export async function trackAction(fd: FormData) {
  const c = await requireClient();
  const procedureId = z.uuid().parse(str(fd, "procedureId"));
  await runAction(str(fd, "returnTo") === "list" ? "/portal" : `/portal/kansen/${procedureId}`, async () => {
    const follow = str(fd, "follow") === "1";
    await setTracking(db, { organizationId: c.organizationId, procedureId, userId: c.user.id, follow });
    return follow ? "Kans opgeslagen; u krijgt meldingen bij belangrijke wijzigingen." : "Kans niet langer gevolgd.";
  });
}

export async function clientSaveProfileAction(fd: FormData) {
  const c = await requireClient();
  await runAction("/portal/profiel", async () => {
    await saveProfile(db, c.organizationId, parseProfileForm(fd), { userId: c.user.id, confirmedByClient: fd.get("confirm") === "on" });
    return "Profiel opgeslagen. Lopende beoordelingen worden opnieuw gecontroleerd.";
  });
}

export async function clientNotificationsAction(fd: FormData) {
  const c = await requireClient();
  await runAction("/portal/instellingen", async () => {
    const recipients = z.array(z.email()).max(10).parse(list(fd, "recipients").map((s) => s.toLowerCase()));
    await db
      .update(organization)
      .set({ notificationSettings: { weeklyDigest: fd.get("weeklyDigest") === "on", changeAlerts: fd.get("changeAlerts") === "on", recipients } })
      .where(eq(organization.id, c.organizationId));
    await audit(db, { actorUserId: c.user.id, organizationId: c.organizationId, action: "notifications.updated", entityType: "organization", entityId: c.organizationId });
    return "Voorkeuren opgeslagen.";
  });
}
