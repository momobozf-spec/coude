import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSources } from "@/lib/services/sources";
import { createOrganization, saveProfile } from "@/lib/services/organizations";
import { createUserWithPassword } from "@/lib/users";
import type { ProfileForm } from "@/lib/validation/profile";

export async function resetDb() {
  await db.execute(sql`TRUNCATE TABLE
    email_delivery, digest, feedback, tracked_opportunity, review_decision, assessment, scoring_config,
    extraction_run, requirement, fact, document, lot, notice, procedure, import_run, source,
    company_profile, membership, organization, lead_request, audit_log, session, account, verification, "user"
    RESTART IDENTITY CASCADE`);
  await ensureSources(db);
}

let n = 0;
export async function makeAdmin() {
  n++;
  return createUserWithPassword(db, { email: `admin${n}@tenderkompas.test`, name: "Beheerder", password: "test-wachtwoord-123", platformRole: "admin" });
}

export function profile(overrides: Partial<ProfileForm> = {}): ProfileForm {
  return {
    companyName: "DEMO Datawerf BV (fictief)",
    website: null,
    contactName: null,
    contactEmail: null,
    services: ["databricks_engineering", "fabric_powerbi"],
    expertise: null,
    technologies: ["Databricks", "Power BI", "Azure"],
    excludedWork: ["hardwarelevering"],
    languages: ["nl", "en"],
    regions: ["BE"],
    teamSize: 12,
    availableCapacityFte: 2,
    contractValueMinEur: 50_000,
    contractValueMaxEur: 1_000_000,
    publicSectorExperience: "yes",
    openToConsortium: "yes",
    openToSubcontracting: "yes",
    annualRevenueEur: null,
    references: [],
    certifications: [{ id: "c1", holder: "company", name: "ISO 27001", validUntil: null }],
    ...overrides,
  };
}

export async function makeOrg(name: string, opts: { isDemo?: boolean; profile?: Partial<ProfileForm> } = {}) {
  const org = await createOrganization(db, { name, isDemo: opts.isDemo ?? true }, null);
  const admin = await makeAdmin();
  await saveProfile(db, org.id, profile({ companyName: name, ...opts.profile }), { userId: admin, confirmedByClient: false });
  return { org, admin };
}
