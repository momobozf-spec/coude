"use client";

import { useCallback, useEffect, useId, useReducer, useRef } from "react";
import Link from "next/link";
import { Camera, FileWarning, ImagePlus, Info, Pencil, RefreshCw } from "lucide-react";
import { ApiClientError, analyzeIngredientText, runOcr } from "@/lib/client/apiClient";
import { track } from "@/lib/client/analytics";
import { StatusBanner } from "@/components/product/StatusBanner";
import { AnalysisFindingList } from "@/components/product/AnalysisFindingCard";
import { ocrMessage, problemFromReason } from "./ocrMessages";
import {
  canAnalyze,
  ingredientScanAnnouncement,
  ingredientScanReducer,
  initialIngredientScanState,
  isBusy,
  type OcrProblem,
} from "./ingredientScanReducer";

/**
 * De ingrediëntenscanner.
 *
 * De flow is bewust in twee helften geknipt met een menselijke stap ertussen:
 *
 *   foto  →  OCR  →  [ GEBRUIKER CONTROLEERT ]  →  analyse  →  resultaat
 *
 * Die middelste stap is niet optioneel. OCR leest "geiatine" waar "gelatine"
 * staat, en het verschil tussen die twee is het verschil tussen "onbekend
 * ingrediënt" en "verboden ingrediënt". Automatisch doorgaan zou een leesfout
 * omzetten in een halal-oordeel.
 *
 * Voor het maken van de foto gebruiken we een gewone bestandsinvoer met
 * `capture`. Dat opent op mobiel de camera-app en geeft op desktop een
 * bestandskiezer — twee flows, één stuk code, en de camera-afhandeling ligt bij
 * het besturingssysteem dat er beter in is dan wij.
 */
export function IngredientScanScreen() {
  const [state, dispatch] = useReducer(ingredientScanReducer, initialIngredientScanState);
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Object-URL's blijven bestaan tot ze expliciet worden vrijgegeven. Zonder
  // deze opruiming houdt de browser elke gekozen foto in het geheugen, ook
  // nadat de gebruiker allang een andere heeft gekozen.
  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const handleFile = useCallback(
    async (file: File) => {
      releasePreview();

      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;

      dispatch({
        type: "IMAGE_SELECTED",
        image: { previewUrl, fileName: file.name, sizeBytes: file.size },
      });

      dispatch({ type: "OCR_STARTED" });
      track("OCR_STARTED");

      try {
        const result = await runOcr(file);
        dispatch({
          type: "OCR_SUCCEEDED",
          text: result.text,
          confidence: result.confidence,
          lowConfidence: result.lowConfidence,
          warnings: result.warnings,
        });
        track("OCR_COMPLETED", { lowConfidence: result.lowConfidence });
      } catch (error) {
        const apiError = error instanceof ApiClientError ? error : null;
        const problem: OcrProblem = apiError
          ? problemFromReason(
              apiError.details?.reason,
              apiError.kind === "NETWORK_ERROR"
                ? "NETWORK_ERROR"
                : apiError.kind === "PROVIDER_UNAVAILABLE"
                  ? "PROVIDER_UNAVAILABLE"
                  : "UNKNOWN",
            )
          : "UNKNOWN";

        dispatch({
          type: "OCR_FAILED",
          problem,
          message: apiError?.message ?? "Het lezen van de tekst is mislukt.",
          retryable: apiError?.retryable ?? false,
        });
        track("OCR_FAILED", { errorKind: problem });
      }
    },
    [releasePreview],
  );

  const handleAnalyze = useCallback(async () => {
    dispatch({ type: "ANALYSIS_REQUESTED" });

    try {
      const { analysis, warnings } = await analyzeIngredientText(state.text);
      dispatch({ type: "ANALYSIS_SUCCEEDED", analysis, warnings });
      track("ANALYSIS_RESULT_SHOWN", {
        method: "manual",
        status: analysis.status,
        confidence: analysis.confidence,
        hasConflict: analysis.hasConflict,
      });
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      dispatch({
        type: "ANALYSIS_FAILED",
        message: apiError?.message ?? "De analyse is mislukt.",
        retryable: apiError?.retryable ?? true,
      });
    }
  }, [state.text]);

  // Focus naar het resultaat: wie met een screenreader werkt moet merken dat er
  // een oordeel is, en niet in de textarea blijven staan.
  useEffect(() => {
    if (state.status === "ANALYSIS_SUCCESS") {
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [state.status]);

  const busy = isBusy(state);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ingrediënten scannen</h1>
        <p className="mt-1 text-[var(--muted)]">
          Fotografeer de ingrediëntenlijst op de achterkant van de verpakking.
        </p>
      </header>

      <p aria-live="polite" className="sr-only">
        {ingredientScanAnnouncement(state)}
      </p>

      {state.status === "ANALYSIS_SUCCESS" && state.analysis ? (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-labelledby="ocr-result-heading"
          className="space-y-5"
        >
          <h2 id="ocr-result-heading" className="sr-only">
            Resultaat van de ingrediëntenanalyse
          </h2>

          <StatusBanner analysis={state.analysis} />

          {/*
            De waarschuwingen horen juist hier te staan, niet alleen in het
            controlescherm. Ze bepalen hoe het oordeel gelezen moet worden: een
            onscherpe foto of een stuk tekst dat niet meegenomen kon worden,
            maakt "geen aandachtspunt gevonden" iets anders dan een schone lei.
          */}
          {state.warnings.length > 0 ? (
            <ul className="space-y-2">
              {state.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 rounded-lg border border-tone-caution-border bg-tone-caution-bg p-3 text-sm text-tone-caution"
                >
                  <FileWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <NoProductNotice />

          <section aria-labelledby="ocr-why-heading" className="space-y-3">
            <h3 id="ocr-why-heading" className="text-lg font-semibold">
              Waarom deze beoordeling?
            </h3>
            <AnalysisFindingList findings={state.analysis.findings} />
          </section>

          <button
            type="button"
            onClick={() => {
              releasePreview();
              dispatch({ type: "RESET" });
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
          >
            <Camera aria-hidden="true" className="h-5 w-5" />
            Nog een verpakking scannen
          </button>
        </section>
      ) : (
        <>
          <ImagePicker
            ref={fileInputRef}
            disabled={busy}
            previewUrl={state.image?.previewUrl ?? null}
            onFile={(file) => void handleFile(file)}
          />

          {state.status === "PROCESSING_OCR" ? <OcrSkeleton /> : null}

          {state.status === "OCR_FAILED" && state.ocrProblem ? (
            <OcrProblemPanel
              problem={state.ocrProblem}
              onRetryImage={() => fileInputRef.current?.click()}
              onManualEntry={() => dispatch({ type: "MANUAL_ENTRY_STARTED" })}
            />
          ) : null}

          {state.status === "REVIEWING_TEXT" ||
          state.status === "ANALYZING" ||
          state.status === "ANALYSIS_FAILED" ? (
            <section aria-labelledby="review-heading" className="space-y-3">
              <h2 id="review-heading" className="text-lg font-semibold">
                {state.image ? "We hebben deze ingrediënten herkend" : "Typ de ingrediënten"}
              </h2>

              {state.warnings.map((warning) => (
                <p
                  key={warning}
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-tone-caution-border bg-tone-caution-bg p-3 text-sm text-tone-caution"
                >
                  <FileWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}

              <div>
                <label htmlFor={textareaId} className="block text-sm font-medium">
                  Ingrediënten
                </label>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Controleer de tekst en corrigeer leesfouten voordat je verdergaat. Scheid de
                  ingrediënten met komma&apos;s.
                </p>
                <textarea
                  id={textareaId}
                  value={state.text}
                  disabled={busy}
                  rows={6}
                  onChange={(event) => dispatch({ type: "TEXT_CHANGED", text: event.target.value })}
                  className="mt-2 w-full rounded-lg border bg-[var(--surface)] p-3 text-base leading-relaxed"
                  style={{ borderColor: "var(--border)" }}
                  placeholder="suiker, cacaoboter, melkpoeder, emulgator (E322)"
                />
              </div>

              {state.error ? (
                <p role="alert" className="text-sm text-tone-negative">
                  {state.error.message}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={!canAnalyze(state) || busy}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)] disabled:opacity-50"
                >
                  {state.status === "ANALYZING" ? "Bezig met analyseren…" : "Ingrediënten analyseren"}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 font-medium disabled:opacity-50"
                  style={{ borderColor: "var(--border)" }}
                >
                  <ImagePlus aria-hidden="true" className="h-4 w-4" />
                  Andere foto kiezen
                </button>
              </div>
            </section>
          ) : null}

          {state.status === "IDLE" ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "MANUAL_ENTRY_STARTED" })}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Ingrediënten zelf intypen
            </button>
          ) : null}

          <Link
            href="/scan"
            className="block text-center text-sm text-[var(--muted)] underline"
          >
            Terug naar barcode scannen
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * Foto maken of kiezen.
 *
 * `capture="environment"` opent op mobiel direct de achtercamera; op desktop
 * negeert de browser het attribuut en toont een gewone bestandskiezer. Eén
 * invoerelement voor beide, zonder eigen camera-code.
 */
function ImagePicker({
  ref,
  disabled,
  previewUrl,
  onFile,
}: {
  ref: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  previewUrl: string | null;
  onFile: (file: File) => void;
}) {
  const inputId = useId();

  return (
    <section aria-labelledby={`${inputId}-label`} className="space-y-3">
      <h2 id={`${inputId}-label`} className="sr-only">
        Afbeelding kiezen
      </h2>

      {previewUrl ? (
        <div
          className="overflow-hidden rounded-xl border bg-[var(--surface)]"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Geen next/image: dit is een lokale object-URL die niet door de
              optimalisatiepijplijn hoeft en ook niet mag. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Voorbeeld van de gekozen foto van de ingrediëntenlijst"
            className="max-h-64 w-full object-contain"
          />
        </div>
      ) : null}

      <input
        ref={ref}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // De waarde leegmaken zodat dezelfde foto opnieuw kiezen ook een
          // change-event geeft.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)] disabled:opacity-50"
      >
        <Camera aria-hidden="true" className="h-5 w-5" />
        {previewUrl ? "Andere foto maken of kiezen" : "Foto maken of kiezen"}
      </button>
    </section>
  );
}

function OcrProblemPanel({
  problem,
  onRetryImage,
  onManualEntry,
}: {
  problem: OcrProblem;
  onRetryImage: () => void;
  onManualEntry: () => void;
}) {
  const message = ocrMessage(problem);

  return (
    <div role="alert" className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <div>
        <h2 className="font-semibold">{message.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{message.body}</p>
      </div>

      <ul className="list-inside list-disc space-y-1 text-sm text-[var(--muted)]">
        {message.suggestions.map((suggestion) => (
          <li key={suggestion}>{suggestion}</li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRetryImage}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {message.canRetrySameImage ? "Opnieuw proberen" : "Nieuwe foto kiezen"}
        </button>

        {/* De uitweg die altijd blijft bestaan. */}
        <button
          type="button"
          onClick={onManualEntry}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Ingrediënten zelf intypen
        </button>
      </div>
    </div>
  );
}

/**
 * Waarom dit resultaat minder zegt dan een productscan.
 *
 * Zonder product zijn er geen certificaten, dus deze route kan nooit tot
 * "gecertificeerd halal" leiden. Dat expliciet zeggen voorkomt dat iemand een
 * groenige uitkomst leest als een goedkeuring van het product.
 */
function NoProductNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border p-3 text-sm text-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Deze beoordeling gaat alleen over de ingrediënten die je hebt ingevoerd. Er is geen product
        aan gekoppeld, dus er zijn geen certificaten meegewogen en er is niets opgeslagen.
      </span>
    </p>
  );
}

function OcrSkeleton() {
  return (
    <div role="status" aria-label="Tekst lezen" className="space-y-3">
      <p className="text-sm text-[var(--muted)]">De tekst in de foto wordt gelezen…</p>
      <div className="h-4 w-full animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
    </div>
  );
}
