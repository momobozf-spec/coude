"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leadRequest, organization } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { list, optStr, runAction, str } from "@/lib/action-helpers";
import { addClientUser, createOrganization, deleteOrganizationData, saveProfile } from "@/lib/services/organizations";
import { parseProfileForm } from "@/lib/profile-from-form";
import { audit } from "@/lib/audit";

const subStatus = z.enum(["lead", "pilot", "active", "paused", "ended"]);

export async function createOrgAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/klanten", async () => {
    const org = await createOrganization(
      db,
      { name: z.string().min(2).max(200).parse(str(fd, "name")), isDemo: fd.get("isDemo") === "on", subscriptionStatus: subStatus.parse(str(fd, "subscriptionStatus") || "pilot") },
      admin.id,
    );
    const leadId = optStr(fd, "leadId");
    if (leadId) await db.update(leadRequest).set({ status: "converted" }).where(eq(leadRequest.id, leadId));
    return { redirect: `/admin/klanten/${org.id}`, message: "Klantorganisatie aangemaakt. Vul nu het profiel in of laat de klant dat doen." };
  });
}

export async function addUserAction(fd: FormData) {
  const admin = await requireAdmin();
  const orgId = str(fd, "organizationId");
  await runAction(`/admin/klanten/${orgId}`, async () => {
    await addClientUser(
      db,
      { organizationId: orgId, email: z.email().parse(str(fd, "email")), name: z.string().min(2).parse(str(fd, "name")), password: z.string().min(12, "Minstens 12 tekens").parse(str(fd, "password")) },
      admin.id,
    );
    return "Gebruiker aangemaakt. Bezorg het tijdelijke wachtwoord via een veilig kanaal.";
  });
}

export async function adminSaveProfileAction(fd: FormData) {
  const admin = await requireAdmin();
  const orgId = str(fd, "organizationId");
  await runAction(`/admin/klanten/${orgId}`, async () => {
    await saveProfile(db, orgId, parseProfileForm(fd), { userId: admin.id, confirmedByClient: false });
    return "Profiel opgeslagen. Lopende beoordelingen zijn opnieuw ter controle gezet.";
  });
}

export async function updateSubscriptionAction(fd: FormData) {
  const admin = await requireAdmin();
  const orgId = str(fd, "organizationId");
  await runAction(`/admin/klanten/${orgId}`, async () => {
    await db
      .update(organization)
      .set({ subscriptionStatus: subStatus.parse(str(fd, "subscriptionStatus")), subscriptionNotes: optStr(fd, "subscriptionNotes") })
      .where(eq(organization.id, orgId));
    await audit(db, { actorUserId: admin.id, organizationId: orgId, action: "subscription.updated", entityType: "organization", entityId: orgId });
    return "Abonnementstatus bijgewerkt (facturatie blijft buiten de applicatie).";
  });
}

export async function updateNotificationsAction(fd: FormData) {
  const admin = await requireAdmin();
  const orgId = str(fd, "organizationId");
  await runAction(`/admin/klanten/${orgId}`, async () => {
    const recipients = z.array(z.email()).max(10).parse(list(fd, "recipients").map((s) => s.toLowerCase()));
    await db
      .update(organization)
      .set({ notificationSettings: { weeklyDigest: fd.get("weeklyDigest") === "on", changeAlerts: fd.get("changeAlerts") === "on", recipients } })
      .where(eq(organization.id, orgId));
    await audit(db, { actorUserId: admin.id, organizationId: orgId, action: "notifications.updated", entityType: "organization", entityId: orgId });
    return "Notificatievoorkeuren opgeslagen.";
  });
}

export async function deleteOrgAction(fd: FormData) {
  const admin = await requireAdmin();
  const orgId = str(fd, "organizationId");
  await runAction(`/admin/klanten/${orgId}`, async () => {
    const org = await db.query.organization.findFirst({ where: eq(organization.id, orgId) });
    if (!org) throw new Error("Niet gevonden");
    if (str(fd, "confirmName") !== org.name) throw new Error("Typ de exacte organisatienaam om te bevestigen.");
    await deleteOrganizationData(db, orgId, admin.id);
    return { redirect: "/admin/klanten", message: `Alle klantgegevens van ${org.name} zijn verwijderd.` };
  });
}
