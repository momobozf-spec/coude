import { profileFormSchema } from "@/lib/validation/profile";
import { str } from "@/lib/action-helpers";
import type { companyProfile } from "@/db/schema";

export function parseProfileForm(fd: FormData) {
  let references: unknown = [];
  let certifications: unknown = [];
  try {
    references = JSON.parse(str(fd, "references_json") || "[]");
    certifications = JSON.parse(str(fd, "certifications_json") || "[]");
  } catch {
    throw new Error("Referenties of certificeringen konden niet gelezen worden.");
  }
  return profileFormSchema.parse({
    companyName: str(fd, "companyName"),
    website: str(fd, "website"),
    contactName: str(fd, "contactName"),
    contactEmail: str(fd, "contactEmail"),
    services: fd.getAll("services").map(String),
    expertise: str(fd, "expertise"),
    technologies: str(fd, "technologies"),
    excludedWork: str(fd, "excludedWork"),
    languages: fd.getAll("languages").map(String),
    regions: fd.getAll("regions").map(String),
    teamSize: str(fd, "teamSize"),
    availableCapacityFte: str(fd, "availableCapacityFte"),
    contractValueMinEur: str(fd, "contractValueMinEur"),
    contractValueMaxEur: str(fd, "contractValueMaxEur"),
    publicSectorExperience: str(fd, "publicSectorExperience") || "unknown",
    openToConsortium: str(fd, "openToConsortium") || "unknown",
    openToSubcontracting: str(fd, "openToSubcontracting") || "unknown",
    annualRevenueEur: str(fd, "annualRevenueEur"),
    references: (references as { title?: string }[]).filter((r) => r.title?.trim()),
    certifications: (certifications as { name?: string }[]).filter((c) => c.name?.trim()),
  });
}

export function profileToFormData(p: typeof companyProfile.$inferSelect | null | undefined) {
  if (!p) return null;
  return {
    companyName: p.companyName,
    website: p.website,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    services: p.services,
    expertise: p.expertise,
    technologies: p.technologies,
    excludedWork: p.excludedWork,
    languages: p.languages,
    regions: p.regions,
    teamSize: p.teamSize,
    availableCapacityFte: p.availableCapacityFte,
    contractValueMinEur: p.contractValueMinEur,
    contractValueMaxEur: p.contractValueMaxEur,
    publicSectorExperience: p.publicSectorExperience,
    openToConsortium: p.openToConsortium,
    openToSubcontracting: p.openToSubcontracting,
    annualRevenueEur: p.annualRevenueEur,
    references: p.references,
    certifications: p.certifications,
  };
}
