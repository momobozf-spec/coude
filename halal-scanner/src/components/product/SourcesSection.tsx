"use client";

import { Info } from "lucide-react";
import type { ProductDetailDto } from "@/server/services/productPresenter";

/**
 * Waar komt deze informatie vandaan?
 *
 * Alleen bronnen die de backend daadwerkelijk teruggeeft. Er wordt hier niets
 * bijverzonnen om de lijst voller te maken — een verzonnen bron is erger dan
 * een korte lijst, want hij suggereert onderbouwing die er niet is.
 *
 * De waarschuwing over externe communitydata staat hier en niet boven elke
 * scan: het is relevante context bij de herkomst, geen boodschap die iemand bij
 * elk product opnieuw moet wegklikken.
 */
const SOURCE_LABELS: Record<string, string> = {
  OPEN_FOOD_FACTS: "Open Food Facts",
  MANUAL: "Handmatig ingevoerd",
  USER: "Door een gebruiker aangeleverd",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

export function SourcesSection({ product }: { product: ProductDetailDto }) {
  const { provenance } = product;
  const externalLabel = provenance.externalSource
    ? (SOURCE_LABELS[provenance.externalSource] ?? provenance.externalSource)
    : null;
  const syncedAt = formatDate(provenance.lastSyncedAt);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {externalLabel ? (
          <li className="rounded-lg border bg-[var(--surface)] p-3" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-medium">{externalLabel}</h3>
            <p className="text-sm text-[var(--muted)]">Productinformatie</p>
            {syncedAt ? (
              <p className="mt-1 text-xs text-[var(--muted)]">Laatst gesynchroniseerd: {syncedAt}</p>
            ) : null}
          </li>
        ) : null}

        {product.analysisVersion ? (
          <li className="rounded-lg border bg-[var(--surface)] p-3" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-medium">Interne referentiedatabase</h3>
            <p className="text-sm text-[var(--muted)]">Ingrediëntenanalyse</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Beoordeeld met {product.analysisVersion}
            </p>
          </li>
        ) : null}
      </ul>

      {externalLabel ? (
        <p className="flex items-start gap-2 text-xs text-[var(--muted)]">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Productinformatie kan afkomstig zijn uit externe communitydatabases en kan verouderd of
            onvolledig zijn. Controleer bij twijfel het etiket op de verpakking.
          </span>
        </p>
      ) : null}
    </div>
  );
}
