"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CameraProblem } from "./scannerReducer";

/**
 * De camera-lifecycle, los van de UI.
 *
 * Alles wat met resources te maken heeft zit hier, en de regels zijn strak:
 *
 *  - Er is nooit meer dan één actieve reader. `controlsRef` is de enige
 *    verwijzing; voordat er een nieuwe start wordt de oude gestopt.
 *  - Bij unmount gaat de camera uit. Zonder dat blijft het lampje branden
 *    nadat de gebruiker weggenavigeerd is, en dat is voor een scanner-app het
 *    soort bug dat vertrouwen kost.
 *  - Gaat de pagina naar de achtergrond, dan stopt de camera. Bij terugkomst
 *    start hij weer, mits de scanner nog actief hoort te zijn.
 *
 * De hook doet niets aan lookups of statussen; hij levert alleen barcodes en
 * problemen af bij de reducer.
 */

export interface UseBarcodeScannerOptions {
  /** Moet de camera nu draaien? Komt uit de state machine. */
  active: boolean;
  onDetected: (barcode: string) => void;
  onProblem: (problem: CameraProblem) => void;
  onStarted: () => void;
}

/** Waarom kan de camera niet? Elke reden krijgt een eigen, bruikbare tekst. */
export function classifyCameraError(error: unknown): CameraProblem {
  const name = error instanceof Error ? error.name : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "DENIED";
    case "NotFoundError":
    case "OverconstrainedError":
      return "NO_CAMERA";
    case "NotReadableError":
    case "AbortError":
      // Camera bestaat maar is bezet door een andere app of tab.
      return "UNAVAILABLE";
    default:
      return "UNAVAILABLE";
  }
}

/** Kan deze omgeving überhaupt een camera aanbieden? */
export function detectEnvironmentProblem(): CameraProblem | null {
  if (typeof window === "undefined") return null;

  // getUserMedia bestaat alleen in een secure context. Zonder deze check
  // krijgt de gebruiker een onbegrijpelijke TypeError in plaats van uitleg.
  if (window.isSecureContext === false) return "INSECURE_CONTEXT";

  if (!navigator.mediaDevices?.getUserMedia) return "UNSUPPORTED";

  return null;
}

interface ScannerControls {
  stop: () => void;
}

export function useBarcodeScanner(options: UseBarcodeScannerOptions) {
  const { active, onDetected, onProblem, onStarted } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const startingRef = useRef(false);

  // De callbacks in refs: zo hoeft het effect niet opnieuw te draaien wanneer
  // een parent-render een nieuwe functie-identiteit oplevert. Zonder dit start
  // en stopt de camera bij elke render, wat er als geflikker uitziet.
  const handlersRef = useRef({ onDetected, onProblem, onStarted });
  useEffect(() => {
    handlersRef.current = { onDetected, onProblem, onStarted };
  }, [onDetected, onProblem, onStarted]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    // ZXing stopt de tracks, maar niet in elke browserversie even grondig.
    // Expliciet opruimen zodat het cameralampje gegarandeerd uitgaat.
    const stream = videoRef.current?.srcObject;
    if (stream && typeof (stream as MediaStream).getTracks === "function") {
      for (const track of (stream as MediaStream).getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || controlsRef.current) return;

    const environmentProblem = detectEnvironmentProblem();
    if (environmentProblem) {
      handlersRef.current.onProblem(environmentProblem);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    startingRef.current = true;

    try {
      // Dynamisch geladen: ZXing is fors en hoort niet in de bundle van een
      // pagina waar de gebruiker misschien alleen handmatig zoekt.
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      const controls = await reader.decodeFromConstraints(
        {
          // Achtercamera als voorkeur, geen eis: `ideal` laat de browser
          // terugvallen op de enige beschikbare camera in plaats van te falen.
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        },
        video,
        (result) => {
          if (!result) return;
          const text = result.getText();
          if (text) handlersRef.current.onDetected(text);
        },
      );

      controlsRef.current = controls;
      handlersRef.current.onStarted();
    } catch (error) {
      handlersRef.current.onProblem(classifyCameraError(error));
    } finally {
      startingRef.current = false;
    }
  }, []);

  // Start en stop volgen de state machine. Eén effect, één verantwoordelijkheid.
  useEffect(() => {
    if (active) void start();
    else stop();

    return stop;
  }, [active, start, stop]);

  // Achtergrond: camera vrijgeven. Andere apps mogen hem dan gebruiken, en het
  // scheelt batterij.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") stop();
      else if (active) void start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [active, start, stop]);

  return { videoRef, stop };
}
