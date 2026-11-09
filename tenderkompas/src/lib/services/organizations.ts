import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import {
  assessment,
  auditLog,
  companyProfile,
  digest,
  feedback,
  membership,
  organization,
  trackedOpportunity,
  user,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { createUserWithPassword } from "@/lib/users";
import type { ProfileForm } from "@/lib/validation/profile";
import { reassessOrganization } from "./assessments";

export async function createOrganization(
  database: DB,
  input: { name: string; isDemo?: boolean; subscriptionStatus?: "lead" | "pilot" | "active" | "paused" | "ended" },
  actorUserId: string | null,
) {
  const [org] = await database
    .insert(organization)
    .values({ name: input.name.trim(), isDemo: input.isDemo ?? false, subscriptionStatus: input.subscriptionStatus ?? "pilot" })
    .returning();
  await audit(database, { actorUserId, organizationId: org.id, action: "organization.created", entityType: "organization", entityId: org.id });
  return org;
}

export async function addClientUser(
  database: DB,
  input: { organizationId: string; email: string; name: string; password: string },
  actorUserId: string | null,
) {
  const userId = await createUserWithPassword(database, { ...input, platformRole: "client" });
  await database.insert(membership).values({ organizationId: input.organizationId, userId, role: "owner" });
  await audit(database, { actorUserId, organizationId: input.organizationId, action: "membership.created", entityType: "user", entityId: userId });
  return userId;
}

/** Profiel opslaan (klant of beheerder). Elke wijziging verhoogt de versie en zet beoordelingen opnieuw ter controle. */
export async function saveProfile(
  database: DB,
  organizationId: string,
  data: ProfileForm,
  actor: { userId: string; confirmedByClient: boolean },
) {
  const existing = await database.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, organizationId) });
  const values = {
    companyName: data.companyName,
    website: data.website,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    services: data.services,
    expertise: data.expertise,
    technologies: data.technologies,
    excludedWork: data.excludedWork,
    languages: data.languages,
    regions: data.regions.map((r) => r.toUpperCase()),
    teamSize: data.teamSize,
    availableCapacityFte: data.availableCapacityFte === null ? null : String(data.availableCapacityFte),
    contractValueMinEur: data.contractValueMinEur === null ? null : String(data.contractValueMinEur),
    contractValueMaxEur: data.contractValueMaxEur === null ? null : String(data.contractValueMaxEur),
    publicSectorExperience: data.publicSectorExperience,
    openToConsortium: data.openToConsortium,
    openToSubcontracting: data.openToSubcontracting,
    annualRevenueEur: data.annualRevenueEur === null ? null : String(data.annualRevenueEur),
    references: data.references,
    certifications: data.certifications,
    ...(actor.confirmedByClient ? { lastConfirmedByClientAt: new Date() } : {}),
  };
  if (!existing) {
    await database.insert(companyProfile).values({ organizationId, ...values, version: 1 });
  } else {
    await database
      .update(companyProfile)
      .set({ ...values, version: existing.version + 1 })
      .where(eq(companyProfile.organizationId, organizationId));
  }
  await audit(database, {
    actorUserId: actor.userId,
    organizationId,
    action: existing ? "profile.updated" : "profile.created",
    entityType: "company_profile",
    entityId: organizationId,
    // geen profielinhoud in de auditlog
    details: { version: existing ? existing.version + 1 : 1 },
  });
  if (existing) await reassessOrganization(database, organizationId, actor.userId);
}

/**
 * Verwijdert alle klantvertrouwelijke gegevens van een organisatie (profiel, beoordelingen, feedback, digests,
 * lidmaatschappen en gebruikersaccounts zonder andere lidmaatschappen). Gedeelde publieke brongegevens blijven.
 */
export async function deleteOrganizationData(database: DB, organizationId: string, actorUserId: string) {
  const members = await database.select().from(membership).where(eq(membership.organizationId, organizationId));
  await database.transaction(async (tx) => {
    await tx.delete(feedback).where(eq(feedback.organizationId, organizationId));
    await tx.delete(trackedOpportunity).where(eq(trackedOpportunity.organizationId, organizationId));
    await tx.delete(digest).where(eq(digest.organizationId, organizationId));
    await tx.delete(assessment).where(eq(assessment.organizationId, organizationId));
    await tx.delete(companyProfile).where(eq(companyProfile.organizationId, organizationId));
    await tx.delete(membership).where(eq(membership.organizationId, organizationId));
    for (const m of members) {
      const other = await tx.select().from(membership).where(eq(membership.userId, m.userId));
      if (other.length === 0) await tx.delete(user).where(eq(user.id, m.userId));
    }
    await tx.update(auditLog).set({ details: {} }).where(eq(auditLog.organizationId, organizationId));
    await tx.delete(organization).where(eq(organization.id, organizationId));
  });
  await audit(database, { actorUserId, action: "organization.deleted", entityType: "organization", entityId: organizationId });
}
