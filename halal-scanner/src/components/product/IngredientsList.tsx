"use client";

import { clsx } from "clsx";
import type { ProductDetailDto, ProductIngredientDto } from "@/server/services/productPresenter";
import { toneClasses } from "@/components/status/statusPresentation";
import { STATUS_PRESENTATION } from "@/types/halal";

/**
 * De ingrediëntenlijst zoals op het etiket, met per regel wat wij ervan weten.
 *
 * Het belangrijkste onderscheid in deze component is er een dat makkelijk te
 * missen is en veel uitmaakt:
 *
 *   "Geen aandachtspunt gevonden"   ≠   "bewezen halal"
 *
 * Een ingrediënt dat in onze referentietabel staat en niet problematisch is,
 * levert het eerste op — niet het tweede. Wij weten dat suiker geen bezwaar
 * oplevert; we weten niet of dít product halal geproduceerd is. Die formulering
 * suggereert dus niets wat de data niet draagt.
 *
 * Een ingrediënt zonder match verdwijnt niet uit de lijst maar krijgt
 * "Oorsprong onbekend": weglaten zou de lijst korter en geruststellender maken
 * dan hij is.
 */

function describeIngredient(item: ProductIngredientDto): { text: string; tone: string } {
  if (!item.matchedIngredient) {
    return { text: "Oorsprong onbekend", tone: "unknown" };
  }

  const status = item.matchedIngredient.defaultStatus;
  const presentation = STATUS_PRESENTATION[status];

  switch (status) {
    case "HARAM":
    case "LIKELY_HARAM":
    case "MUSHBOOH":
      return { text: presentation.label, tone: presentation.tone };
    case "LIKELY_HALAL":
    case "CERTIFIED_HALAL":
      // Bewust niet "halal": wij hebben alleen vastgesteld dat dit ingrediënt
      // geen bezwaar oplevert.
      return { text: "Geen aandachtspunt gevonden", tone: "neutral-positive" };
    default:
      return { text: "Oorsprong onbekend", tone: "unknown" };
  }
}

export function IngredientsList({ product }: { product: ProductDetailDto }) {
  if (product.ingredients.length === 0 && !product.ingredientsRaw) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-medium">Geen ingrediëntenlijst beschikbaar</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Voor dit product is geen ingrediëntenlijst bekend. Zonder die lijst kan er geen
          inhoudelijke beoordeling gemaakt worden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {product.ingredientsRaw ? (
        <section>
          <h3 className="text-sm font-medium">Ingrediënten zoals vermeld</h3>
          <p className="mt-1 rounded-lg border bg-[var(--surface)] p-3 text-sm leading-relaxed" style={{ borderColor: "var(--border)" }}>
            {product.ingredientsRaw}
          </p>
        </section>
      ) : null}

      {product.ingredients.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Per ingrediënt</h3>
          <ul className="mt-2 divide-y rounded-lg border bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
            {[...product.ingredients]
              .sort((a, b) => a.position - b.position)
              .map((item) => {
                const described = describeIngredient(item);
                return (
                  <li
                    key={`${item.position}-${item.normalizedName}`}
                    className="flex items-baseline justify-between gap-3 p-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="min-w-0 break-words">{item.rawName}</span>
                    <span
                      className={clsx(
                        "shrink-0 text-xs font-medium",
                        toneClasses(described.tone).accent,
                      )}
                    >
                      {described.text}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      {product.allergens.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Allergenen</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{product.allergens.join(", ")}</p>
        </section>
      ) : null}
    </div>
  );
}
