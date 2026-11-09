/**
 * Domeintypes voor de halal-analyse.
 *
 * Deze module hangt bewust alleen af van de door Prisma gegenereerde enums en
 * niet van Prisma-modeltypes of Next.js. De rules engine, de API-laag en de
 * tests delen deze vorm; de UI krijgt exact dit terug.
 */
import type {
  ConfidenceLevel,
  FindingType,
  HalalStatus,
  SourceType,
} from "@prisma/client";

export type { ConfidenceLevel, FindingType, HalalStatus, SourceType };

/** Verwijzing naar de onderbouwing van een bevinding. */
export interface SourceReference {
  id: string;
  name: string;
  organization: string;
  url: string | null;
  sourceType: SourceType;
  /** True voor sourceType INTERNAL_RULE: eigen heuristiek, geen autoriteit. */
  isInternal: boolean;
  lastVerifiedAt: string | null;
}

/** Een enkele, uitlegbare bevinding over een ingredient of E-nummer. */
export interface IngredientFinding {
  findingType: FindingType;
  status: HalalStatus;
  confidence: ConfidenceLevel;
  /** Wat beoordeeld is, zoals de gebruiker het op het etiket ziet. */
  label: string;
  /** Zoals het op het etiket stond, voor als label genormaliseerd is. */
  rawLabel: string | null;
  /** Waarom. Wordt letterlijk aan de gebruiker getoond. */
  reason: string;
  ingredientId: string | null;
  eNumberId: string | null;
  eNumberCode: string | null;
  source: SourceReference | null;
}

/** Bewijskracht van een certificaat, zoals meegenomen in de analyse. */
export interface CertificateEvidence {
  certificateId: string;
  certificateNumber: string;
  certificationBodyName: string;
  certificationBodyOfficial: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  /** True als status VERIFIED is en het certificaat niet verlopen is. */
  isActive: boolean;
  status: string;
}

/** Volledige uitkomst van analyzeProductIngredients(). */
export interface HalalAnalysis {
  status: HalalStatus;
  confidence: ConfidenceLevel;
  summary: string;
  findings: IngredientFinding[];
  certificateEvidence: CertificateEvidence[];
  sources: SourceReference[];
  /** True wanneer certificaat en ingredienten elkaar tegenspreken. */
  hasConflict: boolean;
  engineVersion: string;
  analyzedAt: string;
}

/** Presentatiemetadata per status. Kleur is nooit het enige onderscheid. */
export interface StatusPresentation {
  status: HalalStatus;
  /** Korte label voor badges. */
  label: string;
  /** Uitleg van wat de status betekent. */
  description: string;
  /** Icoon-aanduiding; de UI mapt dit op een component, niet op enkel kleur. */
  icon: "check-circle" | "check" | "alert-triangle" | "x-circle" | "help-circle";
  tone: "positive" | "neutral-positive" | "caution" | "negative" | "unknown";
}

export const STATUS_PRESENTATION: Record<HalalStatus, StatusPresentation> = {
  CERTIFIED_HALAL: {
    status: "CERTIFIED_HALAL",
    label: "Gecertificeerd halal",
    description:
      "Er is een geldig, geverifieerd certificaat van een geregistreerde certificerende instantie.",
    icon: "check-circle",
    tone: "positive",
  },
  LIKELY_HALAL: {
    status: "LIKELY_HALAL",
    label: "Waarschijnlijk halal",
    description:
      "Op basis van de bekende ingredienten zijn geen problematische bestanddelen gevonden. Er is geen certificaat dat dit bevestigt.",
    icon: "check",
    tone: "neutral-positive",
  },
  MUSHBOOH: {
    status: "MUSHBOOH",
    label: "Twijfelachtig (mushbooh)",
    description:
      "Van een of meer ingredienten is de herkomst niet vast te stellen. Daarom kan de halal-status niet met voldoende zekerheid worden bepaald.",
    icon: "alert-triangle",
    tone: "caution",
  },
  LIKELY_HARAM: {
    status: "LIKELY_HARAM",
    label: "Waarschijnlijk niet halal",
    description:
      "Er is een sterke aanwijzing voor een verboden ingredient, zonder harde bevestiging.",
    icon: "x-circle",
    tone: "negative",
  },
  HARAM: {
    status: "HARAM",
    label: "Niet halal",
    description: "Er is een expliciet verboden ingredient aangetroffen.",
    icon: "x-circle",
    tone: "negative",
  },
  UNKNOWN: {
    status: "UNKNOWN",
    label: "Onvoldoende informatie",
    description:
      "Er is te weinig informatie beschikbaar om dit product te beoordelen. Voeg een foto van de ingredientenlijst toe om verder te komen.",
    icon: "help-circle",
    tone: "unknown",
  },
};
