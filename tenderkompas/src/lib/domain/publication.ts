import type { AssessmentStatus } from "@/db/schema";

/** Toegestane overgangen in de reviewworkflow: concept → te controleren → goedgekeurd → gepubliceerd. */
const TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  draft: ["to_review"],
  to_review: ["approved", "rejected", "draft"],
  approved: ["published", "to_review"],
  published: ["superseded", "to_review"],
  rejected: ["draft"],
  superseded: [],
};

export function canTransition(from: AssessmentStatus, to: AssessmentStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type PublishCheck = { ok: true } | { ok: false; reasons: string[] };

/**
 * Publicatiepoort: alleen goedgekeurde, actuele beoordelingen bereiken klanten.
 */
export function checkPublishable(input: {
  assessment: { status: AssessmentStatus; stale: boolean; procedureFingerprint: string; isCurrent: boolean; profileVersion: number };
  procedureFingerprint: string;
  currentProfileVersion: number;
  procedureIsDemo: boolean;
  organizationIsDemo: boolean;
}): PublishCheck {
  const reasons: string[] = [];
  const a = input.assessment;
  if (a.status !== "approved") reasons.push("Beoordeling is niet goedgekeurd.");
  if (!a.isCurrent) reasons.push("Er bestaat een nieuwere versie van deze beoordeling.");
  if (a.stale) reasons.push("Bron is gewijzigd sinds de beoordeling; eerst opnieuw controleren.");
  if (a.procedureFingerprint !== input.procedureFingerprint)
    reasons.push("Brongegevens zijn gewijzigd sinds de beoordeling (vingerafdruk verschilt).");
  if (a.profileVersion !== input.currentProfileVersion)
    reasons.push("Bedrijfsprofiel is gewijzigd sinds de beoordeling.");
  if (input.procedureIsDemo !== input.organizationIsDemo)
    reasons.push("Demogegevens en live gegevens mogen niet gemengd worden.");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  draft: "Concept",
  to_review: "Te controleren",
  approved: "Goedgekeurd",
  published: "Gepubliceerd",
  superseded: "Vervangen",
  rejected: "Afgewezen",
};
