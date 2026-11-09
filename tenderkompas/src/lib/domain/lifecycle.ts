import type { ProcedureLifecycle } from "@/db/schema";
import { deadlineComparable } from "@/lib/time";

/**
 * Afleiding van de levensfase uit notice-type (BT-02) / form-type (BT-03), volgens de officiële eForms-codelijsten
 * (OP-TED/eForms-SDK codelists notice-type_*.gc en form-type.gc, okt 2026).
 * Conservatief: alles wat geen expliciete oproep tot mededinging is, wordt nooit "open".
 *  - competition: cn-standard, cn-social, cn-desg, subco, qu-sy → open; pin-cfc-standard/pin-cfc-social bewust NIET (vooraankondiging
 *    als oproep: interesse kenbaar maken, geen inschrijving) → vooraankondiging, door beheerder te corrigeren.
 *  - planning (pin-*) en consultation (pmc) → vooraankondiging/marktconsultatie.
 *  - result (can-*), cont-modif (can-modif), dir-awa-pre (veat), completion (compl) → gegund/afgerond.
 * Wijzigingsberichten in eForms hebben gewoon het notice-type van het origineel (+ BT-758/BT-140); "change"/"corr" komen enkel uit
 * handmatige invoer of oude TED-formulieren.
 */
export function lifecycleFromNotice(noticeType?: string | null, formType?: string | null): ProcedureLifecycle | "change" {
  const nt = (noticeType ?? "").toLowerCase();
  const ft = (formType ?? "").toLowerCase();
  if (ft === "change" || nt === "corr") return "change";
  if (nt.startsWith("can-") || nt === "veat" || nt === "compl" || ["result", "cont-modif", "dir-awa-pre", "completion"].includes(ft)) return "awarded";
  if (nt.startsWith("pin-") || nt === "pmc" || ft === "planning" || ft === "consultation") return "prior_information";
  if (["cn-standard", "cn-social", "cn-desg", "subco", "qu-sy"].includes(nt) || ft === "competition") return "open";
  return "unknown";
}

/**
 * Intrekkingssignalen. Codelijst change-corrig-justification: "cancel" = aankondiging geannuleerd.
 * "cancel-intent" (voornemen tot annulering) en "susp-review" (geschorst wegens beroep) zijn GEEN intrekking,
 * maar maken de open status onzeker (zie isSuspensionSignal). BT-756 competition-termination-proc = true ⇒ beëindigd.
 */
export function isCancellationSignal(input: {
  changeReasonCodes?: string[];
  competitionTermination?: string[] | string | boolean | null;
}): boolean {
  const codes = (input.changeReasonCodes ?? []).map((c) => c.toLowerCase().trim());
  if (codes.includes("cancel")) return true;
  const term = ([] as unknown[]).concat(input.competitionTermination ?? []);
  return term.some((t) => String(t).toLowerCase() === "true");
}

export function isSuspensionSignal(changeReasonCodes: string[] = []): boolean {
  return changeReasonCodes.map((c) => c.toLowerCase().trim()).some((c) => c === "cancel-intent" || c === "susp-review");
}

/**
 * Levensfase over de volledige publicatiegeschiedenis.
 * Volgorde: intrekking > gunning > (open, maar geschorst/voornemen tot annulering ⇒ onbekend) > open > vooraankondiging.
 */
export function deriveLifecycle(
  notices: { noticeType?: string | null; formType?: string | null; publicationDate?: Date | null; cancelled?: boolean; suspended?: boolean }[],
): ProcedureLifecycle {
  if (notices.some((n) => n.cancelled)) return "cancelled";
  const phases = notices
    .map((n) => ({ phase: lifecycleFromNotice(n.noticeType, n.formType), at: n.publicationDate?.getTime() ?? 0 }))
    .filter((p) => p.phase !== "change" && p.phase !== "unknown") as { phase: ProcedureLifecycle; at: number }[];
  if (phases.some((p) => p.phase === "awarded")) return "awarded";
  if (phases.some((p) => p.phase === "open")) return notices.some((n) => n.suspended) ? "unknown" : "open";
  if (phases.some((p) => p.phase === "prior_information")) return "prior_information";
  return "unknown";
}

export function effectiveLifecycle(p: { lifecycle: ProcedureLifecycle; lifecycleOverride?: ProcedureLifecycle | null }) {
  return p.lifecycleOverride ?? p.lifecycle;
}

export type DeadlineFactLike = {
  key: string;
  lotId: string | null;
  valueInstant: Date | string | null;
  valueDate: string | null;
  supersededAt?: Date | string | null;
};

export type OpportunityState =
  | { open: true; deadlineKnown: boolean; nextDeadline: Date | null }
  | { open: false; reason: "prior_information" | "awarded" | "cancelled" | "expired" | "unknown_status" };

/**
 * Een procedure is alleen een open inschrijvingskans als:
 * - de levensfase "open" is (geen vooraankondiging, gunning of intrekking), en
 * - niet alle bekende indieningsdeadlines verstreken zijn.
 * Een onbekende deadline maakt een kans niet automatisch "open met zekerheid": deadlineKnown=false.
 */
export function opportunityState(
  p: { lifecycle: ProcedureLifecycle; lifecycleOverride?: ProcedureLifecycle | null },
  facts: DeadlineFactLike[],
  now: Date,
): OpportunityState {
  const lc = effectiveLifecycle(p);
  if (lc === "prior_information") return { open: false, reason: "prior_information" };
  if (lc === "awarded") return { open: false, reason: "awarded" };
  if (lc === "cancelled") return { open: false, reason: "cancelled" };
  if (lc !== "open") return { open: false, reason: "unknown_status" };
  const deadlines = facts
    .filter((f) => !f.supersededAt && (f.key === "submission_deadline" || f.key === "participation_deadline"))
    .map((f) => deadlineComparable(f))
    .filter((d): d is Date => d !== null);
  if (deadlines.length === 0) return { open: true, deadlineKnown: false, nextDeadline: null };
  const future = deadlines.filter((d) => d.getTime() > now.getTime()).sort((a, b) => a.getTime() - b.getTime());
  if (future.length === 0) return { open: false, reason: "expired" };
  return { open: true, deadlineKnown: true, nextDeadline: future[0] };
}

export const LIFECYCLE_LABEL: Record<ProcedureLifecycle, string> = {
  prior_information: "Vooraankondiging",
  open: "Oproep tot mededinging",
  awarded: "Gegund / resultaat gepubliceerd",
  cancelled: "Ingetrokken / stopgezet",
  unknown: "Status onbekend",
};
