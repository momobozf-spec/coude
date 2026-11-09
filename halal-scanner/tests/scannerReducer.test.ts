import { describe, expect, it } from "vitest";
import {
  RECENT_BARCODE_MEMORY,
  initialScannerState,
  scannerReducer,
  shouldCameraBeActive,
  shouldHandleBarcode,
  statusAnnouncement,
  type ScannerState,
} from "@/components/scan/scannerReducer";
import type { BarcodeLookupResult } from "@/lib/client/apiClient";

/**
 * De reducer is puur, dus de hele scannerflow is hier te doorlopen zonder
 * browser, camera of netwerk. Dat is precies waarom de toestand in een reducer
 * zit en niet verspreid over losse booleans in een component.
 */

const RESULT = {
  product: { id: "p1", barcode: "5411234567890", name: "Testkoek", halalStatus: "MUSHBOOH" },
  analysis: null,
  analysisStatus: "NONE",
  cached: false,
  provider: null,
} as unknown as BarcodeLookupResult;

function reduce(state: ScannerState, ...actions: Parameters<typeof scannerReducer>[1][]): ScannerState {
  return actions.reduce(scannerReducer, state);
}

describe("begintoestand", () => {
  it("start inactief, zonder camera en zonder resultaat", () => {
    expect(initialScannerState.status).toBe("IDLE");
    expect(shouldCameraBeActive(initialScannerState)).toBe(false);
    expect(initialScannerState.result).toBeNull();
  });
});

describe("cameratoestemming", () => {
  it("gaat scannen zodra de camera draait", () => {
    const state = reduce(initialScannerState, { type: "REQUEST_PERMISSION" }, { type: "PERMISSION_GRANTED" });
    expect(state.status).toBe("SCANNING");
    expect(shouldCameraBeActive(state)).toBe(true);
  });

  it("valt bij een geweigerde camera terug op IDLE, niet op ERROR", () => {
    const state = reduce(
      initialScannerState,
      { type: "REQUEST_PERMISSION" },
      { type: "CAMERA_PROBLEM", problem: "DENIED" },
    );
    // De app is niet stuk: handmatig invoeren werkt nog. ERROR zou het scherm
    // met een foutmelding vullen en die uitweg verbergen.
    expect(state.status).toBe("IDLE");
    expect(state.cameraProblem).toBe("DENIED");
    expect(shouldCameraBeActive(state)).toBe(false);
  });

  it("onderscheidt de camerasituaties van elkaar", () => {
    for (const problem of ["DENIED", "NO_CAMERA", "UNAVAILABLE", "INSECURE_CONTEXT", "UNSUPPORTED"] as const) {
      const state = scannerReducer(initialScannerState, { type: "CAMERA_PROBLEM", problem });
      expect(state.cameraProblem).toBe(problem);
    }
  });
});

describe("barcodedetectie en ontdubbeling", () => {
  const scanning = reduce(initialScannerState, { type: "PERMISSION_GRANTED" });

  it("neemt een gedetecteerde barcode aan", () => {
    const state = scannerReducer(scanning, { type: "BARCODE_DETECTED", barcode: "123", method: "camera" });
    expect(state.status).toBe("BARCODE_DETECTED");
    expect(state.barcode).toBe("123");
    expect(state.inputMethod).toBe("camera");
    // Camera uit zodra er iets gevonden is: anders blijft hij scannen terwijl
    // de lookup loopt.
    expect(shouldCameraBeActive(state)).toBe(false);
  });

  it("negeert dezelfde barcode een tweede keer", () => {
    const first = scannerReducer(scanning, { type: "BARCODE_DETECTED", barcode: "123", method: "camera" });
    const loaded = reduce(first, { type: "LOOKUP_STARTED" }, { type: "LOOKUP_SUCCEEDED", result: RESULT });
    const again = scannerReducer(loaded, { type: "BARCODE_DETECTED", barcode: "123", method: "camera" });

    // ZXing vuurt tientallen keren per seconde; zonder deze regel zou dat
    // evenzoveel netwerkverzoeken worden.
    expect(again).toBe(loaded);
  });

  it("negeert nieuwe detecties zolang er een lookup loopt", () => {
    const loading = reduce(
      scanning,
      { type: "BARCODE_DETECTED", barcode: "123", method: "camera" },
      { type: "LOOKUP_STARTED" },
    );
    const during = scannerReducer(loading, { type: "BARCODE_DETECTED", barcode: "456", method: "camera" });
    expect(during).toBe(loading);
  });

  it("onthoudt een beperkt aantal recente barcodes", () => {
    let state = scanning;
    for (let index = 0; index < RECENT_BARCODE_MEMORY + 3; index++) {
      state = reduce(
        state,
        { type: "BARCODE_DETECTED", barcode: `code-${index}`, method: "camera" },
        { type: "LOOKUP_STARTED" },
        { type: "LOOKUP_SUCCEEDED", result: RESULT },
        { type: "SCAN_AGAIN" },
      );
    }
    expect(state.recentlyHandled).toHaveLength(RECENT_BARCODE_MEMORY);
    // De oudste is vergeten, dus die mag weer gescand worden.
    expect(shouldHandleBarcode(state, "code-0")).toBe(true);
  });

  it("laat een handmatige invoer dezelfde weg lopen als een camerascan", () => {
    const state = scannerReducer(initialScannerState, {
      type: "BARCODE_DETECTED",
      barcode: "5411234567890",
      method: "manual",
    });
    expect(state.status).toBe("BARCODE_DETECTED");
    expect(state.inputMethod).toBe("manual");
  });
});

describe("lookup", () => {
  const detected = reduce(initialScannerState, {
    type: "BARCODE_DETECTED",
    barcode: "123",
    method: "camera",
  });

  it("toont het resultaat bij succes", () => {
    const state = reduce(detected, { type: "LOOKUP_STARTED" }, { type: "LOOKUP_SUCCEEDED", result: RESULT });
    expect(state.status).toBe("PRODUCT_FOUND");
    expect(state.result).toBe(RESULT);
  });

  it("onderscheidt 'niet gevonden' van een fout", () => {
    const state = reduce(detected, { type: "LOOKUP_STARTED" }, { type: "LOOKUP_NOT_FOUND", barcode: "123" });
    expect(state.status).toBe("PRODUCT_NOT_FOUND");
    expect(state.error).toBeNull();
  });

  it("bewaart bij een fout of opnieuw proberen zin heeft", () => {
    const state = reduce(
      detected,
      { type: "LOOKUP_STARTED" },
      { type: "LOOKUP_FAILED", kind: "PROVIDER_UNAVAILABLE", message: "bron plat", retryable: true },
    );
    expect(state.status).toBe("ERROR");
    expect(state.error?.retryable).toBe(true);
  });

  it("markeert een ongeldige barcode als niet-herhaalbaar", () => {
    const state = reduce(
      detected,
      { type: "LOOKUP_STARTED" },
      { type: "LOOKUP_FAILED", kind: "INVALID_BARCODE", message: "ongeldig", retryable: false },
    );
    expect(state.error?.retryable).toBe(false);
  });
});

describe("opnieuw proberen en opnieuw scannen", () => {
  it("laat dezelfde barcode na een fout wél opnieuw toe", () => {
    const failed = reduce(
      initialScannerState,
      { type: "BARCODE_DETECTED", barcode: "123", method: "camera" },
      { type: "LOOKUP_STARTED" },
      { type: "LOOKUP_FAILED", kind: "NETWORK_ERROR", message: "geen verbinding", retryable: true },
    );

    const retried = scannerReducer(failed, { type: "RETRY" });

    expect(retried.status).toBe("BARCODE_DETECTED");
    expect(retried.error).toBeNull();
    // Zonder deze uitzondering zou de ontdubbeling de retry blokkeren.
    expect(retried.recentlyHandled).not.toContain("123");
  });

  it("zet bij opnieuw scannen alles terug behalve het ontdubbelgeheugen", () => {
    const found = reduce(
      initialScannerState,
      { type: "BARCODE_DETECTED", barcode: "123", method: "camera" },
      { type: "LOOKUP_STARTED" },
      { type: "LOOKUP_SUCCEEDED", result: RESULT },
    );

    const again = scannerReducer(found, { type: "SCAN_AGAIN" });

    expect(again.status).toBe("SCANNING");
    expect(again.result).toBeNull();
    expect(again.error).toBeNull();
    // De verpakking ligt nog voor de lens; direct opnieuw scannen zou meteen
    // hetzelfde product opleveren.
    expect(again.recentlyHandled).toContain("123");
  });
});

describe("aankondigingen voor screenreaders", () => {
  it("meldt elke betekenisvolle toestand in gewone taal", () => {
    const scanning = reduce(initialScannerState, { type: "PERMISSION_GRANTED" });
    expect(statusAnnouncement(scanning)).toContain("camera is actief");

    const loading = reduce(scanning, { type: "BARCODE_DETECTED", barcode: "1", method: "camera" });
    expect(statusAnnouncement(loading)).toContain("gecontroleerd");

    const found = reduce(loading, { type: "LOOKUP_STARTED" }, { type: "LOOKUP_SUCCEEDED", result: RESULT });
    expect(statusAnnouncement(found)).toContain("Testkoek");

    const notFound = scannerReducer(loading, { type: "LOOKUP_NOT_FOUND", barcode: "1" });
    expect(statusAnnouncement(notFound)).toContain("niet in de database");
  });
});
