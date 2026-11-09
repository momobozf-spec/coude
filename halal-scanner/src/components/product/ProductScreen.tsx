"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, lookupBarcode, type BarcodeLookupResult } from "@/lib/client/apiClient";
import { track } from "@/lib/client/analytics";
import { ProductResult } from "./ProductResult";

/**
 * De productpagina buiten de scanner om.
 *
 * Hergebruikt `lookupBarcode` en `ProductResult`, zodat een product er hetzelfde
 * uitziet of je het nu scant of via zoeken opent. De laadtoestand krijgt
 * dezelfde skeletonvorm als de scanner om verspringende layout te voorkomen.
 */
export function ProductScreen({ barcode }: { barcode: string }) {
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    lookupBarcode(barcode, { signal: controller.signal })
      .then((next) => {
        setResult(next);
        setError(null);
        track("PRODUCT_RESULT_SHOWN", {
          method: "manual",
          status: next.product.halalStatus,
          analysisStatus: next.analysisStatus,
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = cause instanceof ApiClientError ? cause : null;
        setError({
          message: apiError?.message ?? "Dit product kon niet worden opgehaald.",
          notFound: apiError?.kind === "PRODUCT_NOT_FOUND",
        });
      });

    return () => controller.abort();
  }, [barcode]);

  if (error) {
    return (
      <div role="alert" className="space-y-4">
        <h1 className="text-xl font-semibold">
          {error.notFound ? "Product niet gevonden" : "Ophalen mislukt"}
        </h1>
        <p className="text-sm text-[var(--muted)]">{error.message}</p>
        {error.notFound ? (
          // Dezelfde uitweg als in de scanner: een onbekend product is geen
          // doodlopende weg, want de ingrediëntenlijst staat op de verpakking.
          <p className="text-sm text-[var(--muted)]">
            Je kunt de ingrediënten van de verpakking scannen zodat we ze alsnog kunnen beoordelen.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {error.notFound ? (
            <Link
              href="/scan/ingredients"
              className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
            >
              Ingrediënten scannen
            </Link>
          ) : null}
          <Link
            href="/scan"
            className={
              error.notFound
                ? "flex min-h-12 items-center justify-center rounded-lg border px-4 font-medium"
                : "flex min-h-12 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
            }
            style={error.notFound ? { borderColor: "var(--border)" } : undefined}
          >
            Naar de scanner
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div role="status" aria-label="Product laden" className="space-y-4">
        <div className="h-44 w-full animate-pulse rounded-xl bg-[var(--surface)]" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--surface)]" />
      </div>
    );
  }

  return <ProductResult result={result} />;
}
