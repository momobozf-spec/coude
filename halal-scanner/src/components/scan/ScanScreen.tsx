"use client";

import { useCallback, useEffect, useReducer } from "react";
import Link from "next/link";
import { Camera, RefreshCw, ScanLine, SearchX } from "lucide-react";
import { ApiClientError, lookupBarcode } from "@/lib/client/apiClient";
import { track } from "@/lib/client/analytics";
import { ProductResult } from "@/components/product/ProductResult";
import { ManualBarcodeInput } from "./ManualBarcodeInput";
import { cameraMessage } from "./cameraMessages";
import { useBarcodeScanner } from "./useBarcodeScanner";
import {
  initialScannerState,
  scannerReducer,
  shouldCameraBeActive,
  statusAnnouncement,
} from "./scannerReducer";

/**
 * Het scannerscherm.
 *
 * Deze component orkestreert, meer niet: de toestand zit in de reducer, de
 * camera in de hook, het oordeel in de backend. Er staat hier geen enkele regel
 * die iets over halal beslist — alleen het weergeven van wat de API teruggeeft.
 */
export function ScanScreen() {
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);

  useEffect(() => {
    track("SCANNER_OPENED");
  }, []);

  const handleDetected = useCallback((barcode: string) => {
    dispatch({ type: "BARCODE_DETECTED", barcode, method: "camera" });
  }, []);

  const handleProblem = useCallback((problem: Parameters<typeof cameraMessage>[0]) => {
    dispatch({ type: "CAMERA_PROBLEM", problem });
    if (problem === "DENIED") track("CAMERA_PERMISSION_DENIED");
  }, []);

  const handleStarted = useCallback(() => {
    dispatch({ type: "PERMISSION_GRANTED" });
    track("CAMERA_PERMISSION_GRANTED");
  }, []);

  const { videoRef } = useBarcodeScanner({
    active: shouldCameraBeActive(state),
    onDetected: handleDetected,
    onProblem: handleProblem,
    onStarted: handleStarted,
  });

  // De lookup hangt aan de toestand, niet aan een klik. Daardoor is er precies
  // één plek waar een barcode een netwerkverzoek wordt, of hij nu van de camera
  // of van het formulier komt.
  useEffect(() => {
    if (state.status !== "BARCODE_DETECTED" || !state.barcode) return;

    const controller = new AbortController();
    const barcode = state.barcode;
    const method = state.inputMethod ?? "camera";

    dispatch({ type: "LOOKUP_STARTED" });
    track(method === "manual" ? "MANUAL_BARCODE_SUBMITTED" : "BARCODE_SCANNED", { method });

    lookupBarcode(barcode, { signal: controller.signal })
      .then((result) => {
        dispatch({ type: "LOOKUP_SUCCEEDED", result });
        track("PRODUCT_RESULT_SHOWN", {
          method,
          status: result.product.halalStatus,
          analysisStatus: result.analysisStatus,
        });
        if (result.analysis) {
          track("ANALYSIS_RESULT_SHOWN", {
            status: result.analysis.status,
            confidence: result.analysis.confidence,
            hasConflict: result.analysis.hasConflict,
          });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (error instanceof ApiClientError && error.kind === "PRODUCT_NOT_FOUND") {
          dispatch({ type: "LOOKUP_NOT_FOUND", barcode });
          track("PRODUCT_NOT_FOUND", { method });
          return;
        }

        const apiError =
          error instanceof ApiClientError
            ? error
            : new ApiClientError("UNKNOWN", "UNKNOWN", "Er ging iets mis.", null);

        dispatch({
          type: "LOOKUP_FAILED",
          kind: apiError.kind,
          message: apiError.message,
          retryable: apiError.retryable,
        });
        track("PRODUCT_RESULT_SHOWN", { method, errorKind: apiError.kind });
      });

    return () => controller.abort();
  }, [state.status, state.barcode, state.inputMethod]);

  const busy = state.status === "LOADING_PRODUCT" || state.status === "BARCODE_DETECTED";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Halal Product Scanner</h1>
        <p className="mt-1 text-[var(--muted)]">
          Scan een barcode om het product te controleren.
        </p>
      </header>

      {/* Elke statuswissel wordt voorgelezen. `polite` zodat het niet door de
          bezigheden van de gebruiker heen snijdt. */}
      <p aria-live="polite" className="sr-only">
        {statusAnnouncement(state)}
      </p>

      {state.status === "PRODUCT_FOUND" && state.result ? (
        <>
          <ProductResult result={state.result} />
          <button
            type="button"
            onClick={() => dispatch({ type: "SCAN_AGAIN" })}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
          >
            <ScanLine aria-hidden="true" className="h-5 w-5" />
            Volgend product scannen
          </button>
        </>
      ) : null}

      {state.status === "PRODUCT_NOT_FOUND" ? (
        <NotFoundPanel barcode={state.barcode} onScanAgain={() => dispatch({ type: "SCAN_AGAIN" })} />
      ) : null}

      {state.status === "ERROR" && state.error ? (
        <ErrorPanel
          message={state.error.message}
          retryable={state.error.retryable}
          onRetry={() => dispatch({ type: "RETRY" })}
        />
      ) : null}

      {busy ? <LookupSkeleton /> : null}

      {state.status !== "PRODUCT_FOUND" && !busy ? (
        <>
          <ScannerViewport
            videoRef={videoRef}
            active={shouldCameraBeActive(state)}
            onStart={() => dispatch({ type: "REQUEST_PERMISSION" })}
            requesting={state.status === "REQUESTING_PERMISSION"}
          />

          {state.cameraProblem ? <CameraProblemPanel problem={state.cameraProblem} onRetry={() => dispatch({ type: "REQUEST_PERMISSION" })} /> : null}

          <ManualBarcodeInput
            disabled={busy}
            onSubmit={(barcode) =>
              dispatch({ type: "BARCODE_DETECTED", barcode, method: "manual" })
            }
          />
        </>
      ) : null}
    </div>
  );
}

function ScannerViewport({
  videoRef,
  active,
  requesting,
  onStart,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  requesting: boolean;
  onStart: () => void;
}) {
  return (
    <section aria-label="Camerabeeld" className="space-y-3">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-black"
        style={{ borderColor: "var(--border)" }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          // Het videobeeld draagt geen informatie voor screenreaders; de status
          // wordt via de live region gemeld.
          aria-hidden="true"
        />

        {active ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-4/5 rounded-lg border-2 border-white/80" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
            <Camera aria-hidden="true" className="h-8 w-8" />
            <p className="text-sm">De camera staat uit.</p>
            <button
              type="button"
              onClick={onStart}
              disabled={requesting}
              className="min-h-11 rounded-lg bg-white px-4 font-medium text-black disabled:opacity-60"
            >
              {requesting ? "Camera starten…" : "Camera starten"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CameraProblemPanel({
  problem,
  onRetry,
}: {
  problem: Parameters<typeof cameraMessage>[0];
  onRetry: () => void;
}) {
  const message = cameraMessage(problem);

  return (
    <div role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="font-semibold">{message.title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{message.body}</p>
      {message.canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border px-4 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Opnieuw proberen
        </button>
      ) : null}
    </div>
  );
}

function NotFoundPanel({ barcode, onScanAgain }: { barcode: string | null; onScanAgain: () => void }) {
  return (
    <div role="status" className="space-y-4 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start gap-3">
        <SearchX aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[var(--muted)]" />
        <div>
          <h2 className="font-semibold">Product niet gevonden</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {barcode ? `Barcode ${barcode} staat niet in de database. ` : ""}
            Je kunt de ingrediënten van de verpakking scannen zodat we het product alsnog kunnen
            beoordelen.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/scan/ingredients"
          className="flex min-h-12 items-center justify-center rounded-lg bg-[var(--foreground)] px-4 font-medium text-[var(--background)]"
        >
          Ingrediënten scannen
        </Link>
        <button
          type="button"
          onClick={onScanAgain}
          className="flex min-h-12 items-center justify-center rounded-lg border px-4 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          Andere barcode proberen
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  retryable,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="font-semibold">Het lukte niet om dit product op te halen</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
      {/* Bij een ongeldige barcode heeft opnieuw proberen geen zin: dan wordt
          hier geen knop getoond, want die zou alleen frustratie opleveren. */}
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border px-4 font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Opnieuw proberen
        </button>
      ) : null}
    </div>
  );
}

/**
 * Skeletons in plaats van een spinner: de vorm van wat er komt is al zichtbaar,
 * waardoor het wachten korter voelt en de layout niet verspringt zodra het
 * resultaat binnen is.
 */
function LookupSkeleton() {
  return (
    <div role="status" aria-label="Product controleren" className="space-y-4">
      <p className="text-sm text-[var(--muted)]">Product controleren…</p>
      <div className="h-44 w-full animate-pulse rounded-xl bg-[var(--surface)]" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--surface)]" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--surface)]" />
      <p className="text-sm text-[var(--muted)]">Ingrediënten worden gecontroleerd…</p>
    </div>
  );
}
