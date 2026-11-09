// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useBarcodeScanner } from "@/components/scan/useBarcodeScanner";

/**
 * Camera-lifecycle zonder camera.
 *
 * ZXing en `getUserMedia` zijn gemockt; er wordt geen echt apparaat
 * aangesproken. Wat hier bewezen wordt is het gedrag dat in een echte browser
 * duur is om te ontdekken: dat het cameralampje uitgaat bij unmount, dat er
 * nooit twee readers tegelijk draaien, en dat de camera stopt zodra de pagina
 * naar de achtergrond gaat.
 */

const stop = vi.fn();
const decodeFromConstraints = vi.fn();

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints = decodeFromConstraints;
  },
}));

/** Minimale component die alleen de hook aanstuurt. */
function ScannerHarness({
  active,
  onDetected = vi.fn(),
  onProblem = vi.fn(),
  onStarted = vi.fn(),
}: {
  active: boolean;
  onDetected?: (barcode: string) => void;
  onProblem?: (problem: never) => void;
  onStarted?: () => void;
}) {
  const { videoRef } = useBarcodeScanner({
    active,
    onDetected,
    onProblem: onProblem as never,
    onStarted,
  });
  return <video ref={videoRef} data-testid="video" />;
}

beforeEach(() => {
  stop.mockClear();
  decodeFromConstraints.mockReset();
  decodeFromConstraints.mockImplementation(async () => ({ stop }));

  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});

afterEach(cleanup);

describe("camera starten en stoppen", () => {
  it("start de reader zodra de scanner actief is", async () => {
    const onStarted = vi.fn();
    render(<ScannerHarness active onStarted={onStarted} />);

    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
  });

  it("start niets zolang de scanner inactief is", async () => {
    render(<ScannerHarness active={false} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(decodeFromConstraints).not.toHaveBeenCalled();
  });

  it("stopt de camera bij unmount", async () => {
    const { unmount } = render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalled());

    unmount();

    // Zonder deze stop blijft het cameralampje branden nadat de gebruiker
    // weggenavigeerd is.
    expect(stop).toHaveBeenCalled();
  });

  it("stopt de camera zodra hij niet meer actief hoort te zijn", async () => {
    const { rerender } = render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalled());

    rerender(<ScannerHarness active={false} />);
    expect(stop).toHaveBeenCalled();
  });

  it("houdt nooit twee readers tegelijk actief", async () => {
    const { rerender } = render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalledTimes(1));

    // Een gewone re-render mag geen tweede reader opleveren.
    rerender(<ScannerHarness active />);
    rerender(<ScannerHarness active />);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(decodeFromConstraints).toHaveBeenCalledTimes(1);
  });

  it("kan opnieuw starten nadat hij gestopt is", async () => {
    const { rerender } = render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalledTimes(1));

    rerender(<ScannerHarness active={false} />);
    rerender(<ScannerHarness active />);

    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalledTimes(2));
  });

  it("vraagt om de achtercamera zonder die te eisen", async () => {
    render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalled());

    const constraints = decodeFromConstraints.mock.calls[0]?.[0] as MediaStreamConstraints;
    // `ideal` en niet `exact`: op een laptop met alleen een frontcamera moet de
    // scanner gewoon werken in plaats van te falen.
    expect(constraints.video).toEqual({ facingMode: { ideal: "environment" } });
  });
});

describe("achtergrond en fouten", () => {
  it("geeft de camera vrij wanneer de pagina naar de achtergrond gaat", async () => {
    render(<ScannerHarness active />);
    await waitFor(() => expect(decodeFromConstraints).toHaveBeenCalled());

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(stop).toHaveBeenCalled();
  });

  it("meldt een geweigerde camera als DENIED", async () => {
    const denied = new Error("geweigerd");
    denied.name = "NotAllowedError";
    decodeFromConstraints.mockRejectedValueOnce(denied);

    const onProblem = vi.fn();
    render(<ScannerHarness active onProblem={onProblem} />);

    await waitFor(() => expect(onProblem).toHaveBeenCalledWith("DENIED"));
  });

  it("start niet zonder beveiligde verbinding", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });

    const onProblem = vi.fn();
    render(<ScannerHarness active onProblem={onProblem} />);

    await waitFor(() => expect(onProblem).toHaveBeenCalledWith("INSECURE_CONTEXT"));
    expect(decodeFromConstraints).not.toHaveBeenCalled();
  });

  it("levert gedetecteerde barcodes door aan de aanroeper", async () => {
    const onDetected = vi.fn();
    decodeFromConstraints.mockImplementation(
      async (_constraints: unknown, _video: unknown, callback: (result: unknown) => void) => {
        callback({ getText: () => "5411234567890" });
        return { stop };
      },
    );

    render(<ScannerHarness active onDetected={onDetected} />);

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("5411234567890"));
  });
});
