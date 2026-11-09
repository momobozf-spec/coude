"use client";

import { clsx } from "clsx";
import { AlertTriangle, UserCheck } from "lucide-react";
import type { AnalysisDto } from "@/server/services/analysisPresenter";
import {
  confidenceDescription,
  confidenceLabel,
  StatusIcon,
  toneClasses,
} from "@/components/status/statusPresentation";

/**
 * De statusband: het eerste en belangrijkste wat iemand ziet.
 *
 * Drie dragers van dezelfde boodschap, altijd alle drie aanwezig:
 * een icoon, een tekstlabel en een kleur. Wie kleuren niet onderscheidt leest
 * "Niet halal"; wie het icoon niet ziet leest hetzelfde. De kleur voegt
 * snelheid toe, geen informatie die er niet ook in tekst staat.
 *
 * Alle inhoud komt uit het backend-contract. Er wordt hier niets afgeleid.
 */
export interface StatusBannerProps {
  analysis: AnalysisDto;
}

export function StatusBanner({ analysis }: StatusBannerProps) {
  const tone = toneClasses(analysis.statusTone);

  return (
    <section aria-labelledby="status-heading" className="space-y-3">
      <div className={clsx("rounded-xl border p-4", tone.surface)}>
        <div className="flex items-start gap-3">
          <StatusIcon icon={analysis.statusIcon} className="mt-0.5 h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <h2 id="status-heading" className="text-xl font-semibold leading-tight">
              {analysis.statusLabel}
            </h2>
            <p className="mt-1 text-sm opacity-90">{analysis.statusDescription}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">{analysis.summary}</p>

      <p className="text-sm">
        <span className="font-medium">Betrouwbaarheid: {confidenceLabel(analysis.confidence)}</span>{" "}
        <span className="text-[var(--muted)]">{confidenceDescription(analysis.confidence)}</span>
      </p>

      {analysis.hasConflict ? <ConflictNotice /> : null}
      {analysis.needsHumanReview && !analysis.hasConflict ? <HumanReviewNotice /> : null}
    </section>
  );
}

/**
 * Een conflict mag er visueel nooit uitzien als een normale goedkeuring.
 *
 * Daarom een eigen blok met een waarschuwingstoon, een eigen kop en een
 * expliciete oproep om niet zomaar een conclusie te trekken — precies omdat een
 * gebruiker die "geldig certificaat" ziet staan anders zou stoppen met lezen.
 */
function ConflictNotice() {
  return (
    <div
      role="alert"
      className={clsx("rounded-xl border p-4", toneClasses("caution").surface)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h3 className="font-semibold">Tegenstrijdige informatie gevonden</h3>
          <p className="mt-1 text-sm">
            Dit product heeft een geldig certificaat, maar de ingrediënteninformatie bevat een
            mogelijk conflicterende vermelding. Controleer de details hieronder voordat je een
            conclusie trekt.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
            <UserCheck aria-hidden="true" className="h-4 w-4" />
            Menselijke controle aanbevolen
          </p>
        </div>
      </div>
    </div>
  );
}

function HumanReviewNotice() {
  return (
    <div role="status" className={clsx("rounded-xl border p-4", toneClasses("caution").surface)}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <UserCheck aria-hidden="true" className="h-4 w-4" />
        Menselijke controle aanbevolen
      </p>
    </div>
  );
}
