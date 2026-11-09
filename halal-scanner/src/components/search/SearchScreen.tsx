"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { ApiClientError, searchProducts } from "@/lib/client/apiClient";
import { track } from "@/lib/client/analytics";
import { StatusIcon, toneClasses } from "@/components/status/statusPresentation";
import { STATUS_PRESENTATION } from "@/types/halal";
import type { ProductSummaryDto } from "@/server/services/productPresenter";

/** Wachttijd na de laatste toetsaanslag voordat er gezocht wordt. */
const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

/**
 * Zoeken op naam, merk of barcode.
 *
 * De invoer is gedebouncet: zonder die pauze wordt elke toetsaanslag een
 * request, en dan doet iemand die "chocolade" typt negen zoekopdrachten waarvan
 * er acht al achterhaald zijn voordat het antwoord binnen is.
 *
 * Elk resultaat toont de statuscache van het product met icoon én tekst — de
 * lijst mag niet leunen op kleurvlekjes om betekenis over te brengen.
 */
export function SearchScreen() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Afgeleid tijdens render, niet opgeslagen. Een `setState` in de effectbody
  // om oude resultaten te wissen levert een extra renderronde op voor iets wat
  // gewoon uit `query` volgt.
  const trimmed = query.trim();
  const queryTooShort = trimmed.length < MIN_QUERY_LENGTH;
  const visibleResults = queryTooShort ? null : results;

  useEffect(() => {
    if (queryTooShort) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      searchProducts(trimmed, { signal: controller.signal })
        .then((products) => {
          setResults(products);
          setError(null);
          track("SEARCH_PERFORMED", { resultCount: products.length });
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setResults(null);
          setError(
            cause instanceof ApiClientError
              ? cause.message
              : "Zoeken lukte niet. Probeer het opnieuw.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, queryTooShort]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Zoeken</h1>
        <p className="mt-1 text-[var(--muted)]">Zoek op productnaam, merk of barcode.</p>
      </header>

      <div>
        <label htmlFor={inputId} className="sr-only">
          Zoekterm
        </label>
        <div className="flex items-center gap-2 rounded-lg border bg-[var(--surface)] px-3" style={{ borderColor: "var(--border)" }}>
          <Search aria-hidden="true" className="h-5 w-5 text-[var(--muted)]" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bijvoorbeeld: chocolade"
            autoComplete="off"
            className="min-h-11 flex-1 bg-transparent py-2 text-base outline-none"
          />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {loading
          ? "Bezig met zoeken."
          : visibleResults
            ? `${visibleResults.length} resultaten gevonden.`
            : ""}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-tone-negative">
          {error}
        </p>
      ) : null}

      {loading && !queryTooShort ? (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <li key={key} className="h-16 animate-pulse rounded-lg bg-[var(--surface)]" />
          ))}
        </ul>
      ) : null}

      {!loading && visibleResults?.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Geen producten gevonden voor deze zoekterm. Probeer een andere naam, of scan de barcode.
        </p>
      ) : null}

      {!loading && visibleResults && visibleResults.length > 0 ? (
        <ul className="space-y-2">
          {visibleResults.map((product) => (
            <SearchResultRow key={product.id} product={product} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchResultRow({ product }: { product: ProductSummaryDto }) {
  const presentation = STATUS_PRESENTATION[product.halalStatus];
  const tone = toneClasses(presentation.tone);

  return (
    <li>
      <Link
        href={`/product/${encodeURIComponent(product.barcode)}`}
        className="flex items-center gap-3 rounded-lg border bg-[var(--surface)] p-3"
        style={{ borderColor: "var(--border)" }}
      >
        <StatusIcon icon={presentation.icon} className={clsx("h-5 w-5 shrink-0", tone.accent)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{product.name ?? "Naam onbekend"}</span>
          {product.brandName ? (
            <span className="block truncate text-sm text-[var(--muted)]">{product.brandName}</span>
          ) : null}
        </span>
        {/* Statuslabel als tekst naast het icoon: kleur alleen is niet genoeg. */}
        <span className={clsx("shrink-0 text-xs font-medium", tone.accent)}>
          {product.halalStatusLabel}
        </span>
      </Link>
    </li>
  );
}
