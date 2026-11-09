/**
 * Analyse-DTO's: wat de API teruggeeft.
 *
 * Geen Prisma-records naar buiten. Dat is niet alleen netjes maar noodzakelijk:
 * de scanner-UI wordt hierop gebouwd, en een kolom hernoemen mag geen breaking
 * change voor de app zijn.
 *
 * Elk statusveld reist met zijn presentatie mee (label, icoon, tone). De UI mag
 * kleur nooit als enige onderscheid gebruiken — door label en icoon hier al mee
 * te sturen is de toegankelijke variant de makkelijkste, en niet iets wat elke
 * component opnieuw moet bedenken.
 */
import type { ConfidenceLevel, HalalStatus } from "@prisma/client";
import { STATUS_PRESENTATION } from "@/types/halal";
import type { StoredAnalysis, StoredFinding } from "@/server/repositories/analysisRepository";
import type { AnalysisResult } from "@/server/halal/engine";
import type { CertificateEvidence } from "@/types/halal";

export interface AnalysisFindingDto {
  findingType: StoredFinding["findingType"];
  status: HalalStatus;
  statusLabel: string;
  confidence: ConfidenceLevel;
  label: string;
  reason: string;
  position: number;
  ingredientId: string | null;
  eNumberId: string | null;
  certificateId: string | null;
  sourceId: string | null;
}

export interface AnalysisDto {
  id: string;
  status: HalalStatus;
  statusLabel: string;
  statusDescription: string;
  /** Iconaanduiding; de UI mapt dit op een component. Nooit alleen kleur. */
  statusIcon: string;
  statusTone: string;
  confidence: ConfidenceLevel;
  summary: string;
  hasConflict: boolean;
  needsHumanReview: boolean;
  engineVersion: string;
  analyzedAt: string;
  findings: AnalysisFindingDto[];
}

export function toAnalysisFindingDto(finding: StoredFinding): AnalysisFindingDto {
  return {
    findingType: finding.findingType,
    status: finding.status,
    statusLabel: STATUS_PRESENTATION[finding.status].label,
    confidence: finding.confidence,
    label: finding.label,
    reason: finding.reason,
    position: finding.position,
    ingredientId: finding.ingredientId,
    eNumberId: finding.eNumberId,
    certificateId: finding.certificateId,
    sourceId: finding.sourceId,
  };
}

export function toAnalysisDto(analysis: StoredAnalysis): AnalysisDto {
  const presentation = STATUS_PRESENTATION[analysis.status];

  return {
    id: analysis.id,
    status: analysis.status,
    statusLabel: presentation.label,
    statusDescription: presentation.description,
    statusIcon: presentation.icon,
    statusTone: presentation.tone,
    confidence: analysis.confidence,
    summary: analysis.summary,
    hasConflict: analysis.hasConflict,
    needsHumanReview: analysis.needsHumanReview,
    engineVersion: analysis.engineVersion,
    analyzedAt: analysis.createdAt.toISOString(),
    // De findings zijn al op `position` gesorteerd opgehaald; die volgorde is
    // door de engine deterministisch bepaald en mag hier niet veranderen.
    findings: analysis.findings.map(toAnalysisFindingDto),
  };
}

/**
 * Presenteert een analyse die niet is opgeslagen — de uitkomst van losse
 * ingrediëntentekst (OCR of handmatig ingevoerd).
 *
 * Dezelfde DTO als een opgeslagen analyse, zodat de UI één component kan
 * gebruiken. Twee velden verschillen noodgedwongen: er is geen database-id, en
 * de posities komen uit de volgorde die de engine al deterministisch bepaald
 * heeft in plaats van uit de opgeslagen `position`-kolom.
 */
export function toAnalysisDtoFromResult(result: AnalysisResult): AnalysisDto {
  const presentation = STATUS_PRESENTATION[result.status];

  return {
    id: "",
    status: result.status,
    statusLabel: presentation.label,
    statusDescription: presentation.description,
    statusIcon: presentation.icon,
    statusTone: presentation.tone,
    confidence: result.confidence,
    summary: result.summary,
    hasConflict: result.hasConflict,
    needsHumanReview: result.needsHumanReview,
    engineVersion: result.engineVersion,
    analyzedAt: result.analyzedAt,
    findings: result.findings.map((finding, position) => ({
      findingType: finding.findingType,
      status: finding.status,
      statusLabel: STATUS_PRESENTATION[finding.status].label,
      confidence: finding.confidence,
      label: finding.label,
      reason: finding.reason,
      position,
      ingredientId: finding.ingredientId,
      eNumberId: finding.eNumberId,
      certificateId: null,
      sourceId: finding.source?.id ?? null,
    })),
  };
}

export interface CertificateEvidenceDto extends CertificateEvidence {
  /** Wat de UI toont wanneer het certificaat géén geldig bewijs is. */
  stateLabel: string;
}

export function toCertificateEvidenceDto(evidence: CertificateEvidence): CertificateEvidenceDto {
  return {
    ...evidence,
    stateLabel: evidence.isActive
      ? "Geverifieerd certificaat"
      : evidence.status === "PENDING" || evidence.status === "COMMUNITY_REVIEWED"
        ? "Certificaat in verificatie"
        : evidence.status === "EXPIRED"
          ? "Certificaat verlopen"
          : "Certificaat niet geldig",
  };
}
