"use client";

import { clsx } from "clsx";
import type { AnalysisFindingDto } from "@/server/services/analysisPresenter";
import {
  confidenceLabel,
  StatusIcon,
  toneClasses,
} from "@/components/status/statusPresentation";
import { STATUS_PRESENTATION } from "@/types/halal";

/**
 * Eén bevinding uit "Waarom deze beoordeling?".
 *
 * De tekst in `reason` komt letterlijk uit de engine en wordt hier niet
 * herschreven of aangevuld. Dat is de hele reden dat de engine per bevinding
 * een reden meestuurt: de uitleg die de gebruiker leest moet dezelfde zijn als
 * de uitleg die tot de status leidde. Zou de frontend hier zelf zinnen
 * genereren, dan kan de uitleg gaan afwijken van de beslissing.
 */
export interface AnalysisFindingCardProps {
  finding: AnalysisFindingDto;
  /** Naam van de bron, opgezocht via `sourceId`. Ontbreekt vaak. */
  sourceName?: string | null;
}

export function AnalysisFindingCard({ finding, sourceName }: AnalysisFindingCardProps) {
  const presentation = STATUS_PRESENTATION[finding.status];
  const tone = toneClasses(presentation.tone);

  const isUnknown = finding.findingType === "UNKNOWN_INGREDIENT";

  return (
    <li className={clsx("rounded-lg border bg-[var(--surface)] p-3", tone.border)}>
      <div className="flex items-start gap-3">
        <StatusIcon icon={presentation.icon} className={clsx("mt-0.5 h-5 w-5 shrink-0", tone.accent)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h4 className="font-medium">
              {isUnknown ? "Onbekend ingrediënt" : finding.label}
            </h4>
            {/* Statuslabel als tekst, niet alleen als kleur van de rand. */}
            <span className={clsx("text-xs font-medium", tone.accent)}>{finding.statusLabel}</span>
          </div>

          {isUnknown ? (
            // De ruwe etiketterm blijft staan: dat is precies wat de gebruiker
            // op de verpakking terugziet en zelf kan opzoeken.
            <p className="mt-1 text-sm font-mono text-[var(--muted)]">&ldquo;{finding.label}&rdquo;</p>
          ) : null}

          <p className="mt-1 text-sm">{finding.reason}</p>

          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <div className="flex gap-1">
              <dt>Betrouwbaarheid:</dt>
              <dd>{confidenceLabel(finding.confidence)}</dd>
            </div>
            {sourceName ? (
              <div className="flex gap-1">
                <dt>Bron:</dt>
                <dd>{sourceName}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </li>
  );
}

/**
 * De volledige lijst. De volgorde komt uit de backend (conflict → haram →
 * certificaat → …) en wordt hier bewust niet opnieuw gesorteerd.
 */
export function AnalysisFindingList({
  findings,
  sourceNames = {},
}: {
  findings: AnalysisFindingDto[];
  sourceNames?: Record<string, string>;
}) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Er zijn geen afzonderlijke bevindingen vastgelegd voor dit product.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {findings.map((finding) => (
        <AnalysisFindingCard
          key={`${finding.position}-${finding.label}`}
          finding={finding}
          sourceName={finding.sourceId ? sourceNames[finding.sourceId] : null}
        />
      ))}
    </ul>
  );
}
