import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractIngredientText } from "@/server/services/ocrService";
import { AppError } from "@/lib/errors";
import type { OcrProvider } from "@/server/integrations/ocr/types";
import { jpeg } from "./helpers/imageBytes";

/**
 * De privacybelofte omgezet in een test.
 *
 * De regel "OCR-tekst komt niet in de logs" stond tot nu toe alleen in een
 * comment. Dat is precies het soort regel dat over een half jaar sneuvelt
 * doordat iemand `logger.error(event, { input })` toevoegt om een bug te
 * zoeken en dat vergeet weg te halen.
 *
 * De opzet: we vangen af op de PLEK WAAR HET ECHT NAAR BUITEN GAAT — de
 * console — in plaats van op `logger.info`. Daardoor dekt de test ook child
 * loggers, toekomstige logregels en alles wat via een andere route in de
 * output belandt. `LOG_IN_TESTS` zet de sink aan, die normaal in tests zwijgt.
 *
 * Elke gevoelige waarde bevat een unieke marker. Verschijnt zo'n marker ergens
 * in de opgevangen output, dan is er iets gelekt, en dan zegt de assertie ook
 * meteen wát.
 */

const TEXT_MARKER = "SUPER_SECRET_OCR_MARKER_847291";
const FILENAME_MARKER = "PRIVEFOTO_MARKER_552013";
const PROVIDER_MESSAGE_MARKER = "PROVIDER_INTERNALS_MARKER_990321";

/** Herkenbare bytes, zodat een base64- of hex-dump van het beeld opvalt. */
const IMAGE_MARKER_BYTES = [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe];

interface Captured {
  lines: string[];
  text(): string;
}

function captureConsole(): Captured {
  const lines: string[] = [];
  const record = (...args: unknown[]): void => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(record);
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  vi.spyOn(console, "debug").mockImplementation(record);
  return { lines, text: () => lines.join("\n") };
}

/** Een JPEG met de markerbytes erin, zodat lekken van de inhoud zichtbaar is. */
function markedImage(): ArrayBuffer {
  return jpeg({ width: 1200, height: 1600, extraBytes: IMAGE_MARKER_BYTES });
}

function providerReturning(text: string): OcrProvider {
  return {
    name: "spy",
    confidencePolicy: { kind: "threshold", lowBelow: 0.7 },
    extractText: async () => ({ text, confidence: 0.91, providerName: "spy" }),
  };
}

let captured: Captured;
let previousLogFlag: string | undefined;

beforeEach(() => {
  previousLogFlag = process.env.LOG_IN_TESTS;
  // Zet de logsink aan; zonder dit zwijgt de logger in tests en zou deze test
  // altijd slagen zonder ooit iets te controleren.
  process.env.LOG_IN_TESTS = "1";
  captured = captureConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousLogFlag === undefined) delete process.env.LOG_IN_TESTS;
  else process.env.LOG_IN_TESTS = previousLogFlag;
});

/**
 * Wacht op een aanroep die hoort te falen en geeft de `AppError` terug.
 *
 * Zonder deze helper levert `promise.catch(e => e as AppError)` een unie op met
 * het succestype, en dan klaagt de typechecker over `.details` in plaats van
 * dat de test iets zegt.
 */
async function expectAppError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error("de aanroep had moeten falen");
}

/** Bewijst dat de opzet werkt: zonder dit zou een lege logoutput "slagen". */
function expectLoggingActuallyHappened(): void {
  expect(captured.lines.length).toBeGreaterThan(0);
}

function expectNoLeak(): void {
  const output = captured.text();
  expect(output).not.toContain(TEXT_MARKER);
  expect(output).not.toContain(FILENAME_MARKER);
  expect(output.toLowerCase()).not.toContain("deadbeef");
  expect(output).not.toContain("data:image");
  expect(output).not.toContain("base64");
}

describe("privacy - de gelukte flow", () => {
  it("logt de herkende tekst niet", async () => {
    const outcome = await extractIngredientText(
      { image: markedImage(), mimeType: "image/jpeg" },
      { provider: providerReturning(`Ingrediënten: suiker, cacao, ${TEXT_MARKER}, aroma`) },
    );

    // De tekst komt wél bij de aanroeper terecht; alleen niet in de logs.
    expect(outcome.text).toContain(TEXT_MARKER);
    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("logt ook de ruwe providertekst niet", async () => {
    // De ruwe tekst wijkt af van de genormaliseerde: als alleen op de
    // genormaliseerde gecontroleerd wordt, zou een lek van `rawText` erdoor
    // glippen. Daarom een eigen marker in de kopregel, die normalisatie weghaalt.
    const raw = `Ingrediënten: ${TEXT_MARKER} suiker, cacao, melkpoeder, aroma`;
    const outcome = await extractIngredientText(
      { image: markedImage(), mimeType: "image/jpeg" },
      { provider: providerReturning(raw) },
    );

    expect(outcome.rawText).toContain(TEXT_MARKER);
    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("logt de bestandsnaam niet, ook niet als die wordt meegegeven", async () => {
    await extractIngredientText(
      {
        image: markedImage(),
        mimeType: "image/jpeg",
        fileName: `${FILENAME_MARKER}.jpg`,
      },
      { provider: providerReturning("suiker, cacaoboter, melkpoeder, aroma") },
    );

    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("logt wel genoeg om een storing te kunnen onderzoeken", async () => {
    // De tegenhanger: een test die alleen "niets lekt" controleert, zou ook
    // slagen als er helemaal niets meer gelogd werd.
    await extractIngredientText(
      { image: markedImage(), mimeType: "image/jpeg" },
      { provider: providerReturning("suiker, cacaoboter, melkpoeder, aroma") },
    );

    const output = captured.text();
    expect(output).toContain("OCR_STARTED");
    expect(output).toContain("OCR_COMPLETED");
    expect(output).toContain("durationMs");
    expect(output).toContain("characters");
  });
});

describe("privacy - de foutpaden", () => {
  /**
   * Foutpaden zijn waar het misgaat: daar staat iemand met een debugger en
   * plakt `{ input }` in de logregel. Elk pad krijgt daarom dezelfde controle.
   */

  it("lekt niets wanneer de provider onbereikbaar is", async () => {
    const provider: OcrProvider = {
      name: "spy",
      extractText: async () => {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          // Providerboodschappen bevatten in het echt soms een stuk van de
          // payload of een URL met een token erin.
          `upstream 502: ${PROVIDER_MESSAGE_MARKER}`,
        );
      },
    };

    const error = await expectAppError(
      extractIngredientText({ image: markedImage(), mimeType: "image/jpeg" }, { provider }),
    );

    expectLoggingActuallyHappened();
    expectNoLeak();
    // De boodschap van de provider hoort ook niet in onze logs.
    expect(captured.text()).not.toContain(PROVIDER_MESSAGE_MARKER);
    // En al helemaal niet in de fout die naar de browser gaat: `message` en
    // `details` komen allebei letterlijk in de HTTP-respons terecht.
    expect(error.message).not.toContain(PROVIDER_MESSAGE_MARKER);
    expect(JSON.stringify(error.details ?? {})).not.toContain(PROVIDER_MESSAGE_MARKER);
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    // Wat er wel in hoort: de code, zodat je de storing terugvindt.
    expect(captured.text()).toContain("PROVIDER_UNAVAILABLE");
  });

  it("lekt niets bij een timeout", async () => {
    const provider: OcrProvider = {
      name: "traag",
      extractText: () => new Promise(() => {}),
    };

    await expect(
      extractIngredientText(
        { image: markedImage(), mimeType: "image/jpeg" },
        { provider, timeoutMs: 5, maxRetries: 0 },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });

    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("lekt niets bij een herpoging", async () => {
    let calls = 0;
    const provider: OcrProvider = {
      name: "wisselvallig",
      extractText: async () => {
        calls += 1;
        if (calls === 1) throw new AppError("PROVIDER_UNAVAILABLE", PROVIDER_MESSAGE_MARKER);
        return { text: `suiker, cacao, ${TEXT_MARKER}, aroma`, providerName: "wisselvallig" };
      },
    };

    await extractIngredientText(
      { image: markedImage(), mimeType: "image/jpeg" },
      { provider, timeoutMs: 1000, maxRetries: 1, sleep: async () => {} },
    );

    expect(captured.text()).toContain("OCR_RETRIED");
    expectNoLeak();
    expect(captured.text()).not.toContain(PROVIDER_MESSAGE_MARKER);
  });

  it("lekt niets wanneer er geen tekst gevonden is", async () => {
    await expect(
      extractIngredientText(
        { image: markedImage(), mimeType: "image/jpeg" },
        { provider: providerReturning("") },
      ),
    ).rejects.toMatchObject({ details: { reason: "NO_TEXT" } });

    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("lekt niets wanneer er te weinig tekst is", async () => {
    // Te kort voor een ingrediëntenlijst, maar wél met de marker erin: als de
    // afgekeurde tekst gelogd zou worden, valt dat hier door de mand.
    await expect(
      extractIngredientText(
        { image: markedImage(), mimeType: "image/jpeg" },
        { provider: providerReturning(TEXT_MARKER.slice(0, 10)) },
      ),
    ).rejects.toMatchObject({ details: { reason: "TOO_LITTLE_TEXT" } });

    expectLoggingActuallyHappened();
    expectNoLeak();
  });

  it("lekt niets wanneer het bestand geen geldige afbeelding is", async () => {
    const notAnImage = new TextEncoder().encode(
      `MZ${TEXT_MARKER} dit is een uitvoerbaar bestand`,
    );

    await expect(
      extractIngredientText(
        { image: notAnImage.buffer as ArrayBuffer, mimeType: "image/jpeg" },
        { provider: providerReturning("nooit aangeroepen") },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    expectNoLeak();
  });
});

describe("privacy - de foutdetails die naar de client gaan", () => {
  /**
   * `AppError.details` gaat één op één de HTTP-respons in. Wat daar in staat,
   * staat dus in de browser van de gebruiker en in elke proxy ertussen.
   */

  it("zet geen tekst of beeld in de details van een OCR-fout", async () => {
    const error = await expectAppError(
      extractIngredientText(
        { image: markedImage(), mimeType: "image/jpeg" },
        { provider: providerReturning(TEXT_MARKER.slice(0, 8)) },
      ),
    );
    const serialized = JSON.stringify(error.details ?? {});

    expect(serialized).not.toContain(TEXT_MARKER);
    expect(serialized.toLowerCase()).not.toContain("deadbeef");
    // Wel bruikbaar voor de UI:
    expect(error.details?.reason).toBe("TOO_LITTLE_TEXT");
  });

  it("zet de bestandsnaam niet in de details van een afgekeurd bestand", async () => {
    const error = await expectAppError(
      extractIngredientText(
        {
          image: markedImage(),
          mimeType: "application/pdf",
          fileName: `${FILENAME_MARKER}.pdf`,
        },
        { provider: providerReturning("x") },
      ),
    );

    expect(JSON.stringify(error.details ?? {})).not.toContain(FILENAME_MARKER);
  });
});
