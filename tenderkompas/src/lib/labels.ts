import type { FactKey } from "@/db/schema";

export const FACT_LABEL: Record<FactKey, string> = {
  submission_deadline: "Deadline indiening offerte",
  participation_deadline: "Deadline aanvraag tot deelneming",
  questions_deadline: "Deadline vragen",
  estimated_value: "Geschatte opdrachtwaarde",
  framework_max_value: "Maximumwaarde raamovereenkomst (plafond, geen gegarandeerde omzet)",
  lot_value: "Geschatte waarde perceel",
  published_budget: "Gepubliceerd budget",
  contract_duration: "Looptijd",
  place_of_performance: "Plaats van uitvoering",
};

export const REQ_KIND_LABEL = {
  exclusion: "Uitsluitingsgrond",
  selection: "Selectie-/toelatingsvoorwaarde",
  award_criterion: "Gunningscriterium",
  other: "Andere voorwaarde",
} as const;

export const REQ_CATEGORY_LABEL: Record<string, string> = {
  reference: "Referenties",
  certification: "Certificering",
  financial: "Financieel",
  language: "Taal",
  security_clearance: "Veiligheidsmachtiging",
  staffing: "Personeel/profielen",
  legal: "Juridisch",
  other: "Overig",
};

export const SOURCE_LABEL: Record<string, string> = {
  ted: "TED",
  "be-eprocurement": "e-Procurement (handmatig)",
  manual: "Handmatig",
  demo: "Demo (fictief)",
};

export const SUBSCRIPTION_LABEL: Record<string, string> = {
  lead: "Lead",
  pilot: "Pilot",
  active: "Actief",
  paused: "Gepauzeerd",
  ended: "Beëindigd",
};

export function money(n: string | number | null, unit?: string | null) {
  if (n === null || n === undefined) return null;
  return `${new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 0 }).format(Number(n))} ${unit ?? ""}`.trim();
}

export const DIGEST_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" | "neutral" }> = {
  draft: { label: "Concept", tone: "neutral" },
  approved: { label: "Goedgekeurd", tone: "info" },
  sending: { label: "Bezig", tone: "info" },
  handed_to_smtp: { label: "Overhandigd aan SMTP — aflevering niet bevestigd", tone: "ok" },
  partially_handed: { label: "Deels overhandigd aan SMTP", tone: "warn" },
  failed: { label: "Mislukt", tone: "bad" },
  not_configured: { label: "Verzending niet ingesteld", tone: "warn" },
};


export const DELIVERY_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" | "neutral" }> = {
  pending: { label: "In wachtrij", tone: "neutral" },
  sending: { label: "Bezig", tone: "info" },
  handed_to_smtp: { label: "Aanvaard door SMTP-server", tone: "ok" },
  failed: { label: "Mislukt / geweigerd", tone: "bad" },
  not_configured: { label: "Niet verzonden: geen SMTP ingesteld", tone: "warn" },
};
export const DELIVERY_STATE: Record<string, string> = {
  unknown: "Aflevering in mailbox niet bevestigd",
  delivered: "Afgeleverd (bevestigd door provider)",
  bounced: "Gebounced",
};
