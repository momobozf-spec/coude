"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { clsx } from "clsx";
import { ImageOff } from "lucide-react";
import type { BarcodeLookupResult } from "@/lib/client/apiClient";
import { StatusBanner } from "./StatusBanner";
import { AnalysisFindingList } from "./AnalysisFindingCard";
import { IngredientsList } from "./IngredientsList";
import { SourcesSection } from "./SourcesSection";

/**
 * Het resultaatscherm.
 *
 * Krijgt focus zodra het verschijnt: iemand die met een screenreader werkt moet
 * merken dat de scan iets heeft opgeleverd, en niet in de scanner-viewport
 * blijven hangen terwijl het antwoord eronder staat.
 */
const TABS = [
  { id: "overzicht", label: "Overzicht" },
  { id: "ingredienten", label: "Ingrediënten" },
  { id: "certificaten", label: "Certificaten" },
  { id: "community", label: "Community" },
  { id: "bronnen", label: "Bronnen" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProductResult({ result }: { result: BarcodeLookupResult }) {
  const { product, analysis, analysisStatus } = result;
  const [tab, setTab] = useState<TabId>("overzicht");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus verplaatsen na een geslaagde scan. `preventScroll` omdat de browser
  // anders naar de kop springt terwijl de gebruiker het beeld nog vasthoudt.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [product.id]);

  return (
    <article className="space-y-5">
      <header className="space-y-3">
        <ProductImage src={product.imageUrl} alt={product.name} />

        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold leading-tight">
            {product.name ?? "Naam onbekend"}
          </h1>
          {product.brandName ? (
            <p className="text-[var(--muted)]">{product.brandName}</p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{product.barcode}</p>
        </div>
      </header>

      {analysis ? (
        <StatusBanner analysis={analysis} />
      ) : (
        <MissingAnalysisNotice analysisStatus={analysisStatus} />
      )}

      <nav aria-label="Productdetails">
        <ul role="tablist" className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={clsx(
                  "min-h-10 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium",
                  tab === item.id
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--surface)] text-[var(--muted)]",
                )}
                style={{ borderColor: "var(--border)" }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === "overzicht" ? (
          <section aria-labelledby="why-heading" className="space-y-3">
            <h2 id="why-heading" className="text-lg font-semibold">
              Waarom deze beoordeling?
            </h2>
            {analysis ? (
              <AnalysisFindingList findings={analysis.findings} />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Er is nog geen beoordeling beschikbaar, dus er zijn ook geen bevindingen om te tonen.
              </p>
            )}
          </section>
        ) : null}

        {tab === "ingredienten" ? <IngredientsList product={product} /> : null}

        {tab === "certificaten" ? (
          <EmptySection
            title="Nog geen certificaten"
            body="Voor dit product zijn geen certificaten vastgelegd. Certificaatbeheer wordt in een volgende stap toegevoegd."
          />
        ) : null}

        {tab === "community" ? (
          <EmptySection
            title="Nog geen community-informatie"
            body="Reacties en meldingen van andere gebruikers worden in een volgende stap toegevoegd. Community-informatie beïnvloedt de halal-status niet."
          />
        ) : null}

        {tab === "bronnen" ? <SourcesSection product={product} /> : null}
      </div>
    </article>
  );
}

function ProductImage({ src, alt }: { src: string | null; alt: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-[var(--surface)] text-[var(--muted)]"
        style={{ borderColor: "var(--border)" }}
      >
        <ImageOff aria-hidden="true" className="h-6 w-6" />
        <p className="text-sm">Geen productafbeelding beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-xl border bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
      <Image
        src={src}
        alt={alt ? `Verpakking van ${alt}` : "Productverpakking"}
        fill
        sizes="(max-width: 448px) 100vw, 448px"
        className="object-contain"
        // Een kapotte externe URL levert een nette placeholder op in plaats van
        // een gebroken afbeelding.
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Het product is gevonden, de analyse niet. Dat is een wezenlijk andere
 * boodschap dan "product onbekend", en de gebruiker houdt hier iets bruikbaars
 * over: naam, merk, foto en de ingrediëntenlijst kloppen gewoon.
 */
function MissingAnalysisNotice({ analysisStatus }: { analysisStatus: "OK" | "NONE" | "FAILED" }) {
  const failed = analysisStatus === "FAILED";

  return (
    <div role="status" className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="font-semibold">Product gevonden</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {failed
          ? "De ingrediëntenanalyse kon op dit moment niet worden uitgevoerd. Probeer het later opnieuw, of bekijk hieronder zelf de ingrediënten."
          : "Voor dit product is nog geen beoordeling gemaakt. Bekijk hieronder de ingrediënten zoals ze bij ons bekend zijn."}
      </p>
    </div>
  );
}

function EmptySection({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
