import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ocr/route";
import { setOcrProvider } from "@/server/integrations/ocr";
import { resetRateLimits } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import type { OcrProvider } from "@/server/integrations/ocr/types";
import { heic, jpeg, png, svg, windowsExecutable } from "./helpers/imageBytes";

/**
 * De route zelf, met echte multipart-requests.
 *
 * Tot nu toe was `/api/ocr` alleen door typecheck en build gedekt: de UI-tests
 * mocken `runOcr` en raken de route nooit. Deze suite bouwt echte `FormData`,
 * stuurt die door een echt `Request`-object en laat Next de body parsen. Wat
 * hier getest wordt is dus de laag die in productie als eerste stukgaat op
 * dingen die in een unit-test niet bestaan: contenttypes, veldnamen, en
 * bestanden die geen bestand blijken.
 *
 * Er is geen externe OCR-dienst bij betrokken; de provider is een spy.
 */

const ROUTE = "http://localhost:3000/api/ocr";

interface Spy extends OcrProvider {
  calls: Array<{ bytes: Uint8Array; mimeType: string; hasFileName: boolean }>;
}

function spyProvider(text = "suiker, cacaoboter, melkpoeder, emulgator E322"): Spy {
  const calls: Spy["calls"] = [];
  return {
    name: "spy",
    calls,
    confidencePolicy: { kind: "threshold", lowBelow: 0.7 },
    extractText: async (input) => {
      calls.push({
        bytes: new Uint8Array(input.image),
        mimeType: input.mimeType,
        // De bestandsnaam hoort de provider niet te bereiken.
        hasFileName: "fileName" in input,
      });
      return { text, confidence: 0.93, providerName: "spy" };
    },
  };
}

function multipart(parts: Record<string, File | string>): Request {
  const form = new FormData();
  for (const [name, value] of Object.entries(parts)) form.append(name, value);
  return new Request(ROUTE, { method: "POST", body: form });
}

function file(bytes: ArrayBuffer, name: string, type: string): File {
  return new File([bytes], name, { type });
}

async function body(response: Response): Promise<Record<string, never>> {
  return (await response.json()) as Record<string, never>;
}

let provider: Spy;

beforeEach(() => {
  resetRateLimits();
  provider = spyProvider();
  setOcrProvider(provider);
});

afterEach(() => {
  setOcrProvider(undefined);
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("een geldige upload", () => {
  it("bereikt de provider met precies de verstuurde bytes", async () => {
    const bytes = jpeg({ width: 1600, height: 1200, extraBytes: [0x11, 0x22, 0x33] });
    const response = await POST(
      multipart({ image: file(bytes, "achterkant.jpg", "image/jpeg") }) as never,
    );

    expect(response.status).toBe(200);
    expect(provider.calls).toHaveLength(1);

    const call = provider.calls[0]!;
    expect(call.mimeType).toBe("image/jpeg");
    // Byte-voor-byte gelijk: de multipart-laag heeft niets verminkt.
    expect(Array.from(call.bytes)).toEqual(Array.from(new Uint8Array(bytes)));
  });

  it("geeft de opgeschoonde tekst terug in de envelope", async () => {
    const response = await POST(
      multipart({ image: file(jpeg(), "achterkant.jpg", "image/jpeg") }) as never,
    );

    const json = (await response.json()) as {
      data: { text: string; confidence: number; lowConfidence: boolean; warnings: string[] };
      meta: { requestId: string; characters: number };
    };

    expect(json.data.text).toBe("suiker, cacaoboter, melkpoeder, emulgator E322");
    expect(json.data.lowConfidence).toBe(false);
    expect(json.meta.characters).toBe(json.data.text.length);
    expect(json.meta.requestId).toBeTruthy();
  });

  it("stuurt de ruwe providertekst en de herkomst niet naar de client", async () => {
    setOcrProvider({
      name: "spy",
      extractText: async () => ({
        text: "INGREDIENTEN: suiker, cacaoboter, melkpoeder",
        providerName: "geheime-leverancier",
        providerModel: "intern-model-v3",
        confidence: 0.9,
      }),
    });

    const response = await POST(
      multipart({ image: file(jpeg(), "a.jpg", "image/jpeg") }) as never,
    );
    const raw = JSON.stringify(await body(response));

    // De kopregel is weggenormaliseerd; de ruwe versie hoort er niet in te staan.
    expect(raw).not.toContain("INGREDIENTEN:");
    // Providerinterna sturen de UI niet.
    expect(raw).not.toContain("geheime-leverancier");
    expect(raw).not.toContain("intern-model-v3");
  });

  it("accepteert PNG en HEIC", async () => {
    for (const [bytes, type] of [
      [png({ width: 1000, height: 800 }), "image/png"],
      [heic(), "image/heic"],
    ] as const) {
      resetRateLimits();
      const response = await POST(multipart({ image: file(bytes, "x", type) }) as never);
      expect(response.status).toBe(200);
    }
  });

  it("geeft de bestandsnaam niet door aan de provider", async () => {
    await POST(
      multipart({ image: file(jpeg(), "IMG_20260809_Brussel_thuis.jpg", "image/jpeg") }) as never,
    );
    expect(provider.calls[0]!.hasFileName).toBe(false);
  });
});

describe("een upload die niet deugt", () => {
  it("weigert een request dat geen multipart is", async () => {
    const response = await POST(
      new Request(ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: "…" }),
      }) as never,
    );

    expect(response.status).toBe(415);
    expect(provider.calls).toHaveLength(0);
  });

  it("weigert een multipart zonder het veld image", async () => {
    const response = await POST(multipart({ foto: file(jpeg(), "a.jpg", "image/jpeg") }) as never);

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { details: { reason: string } } };
    expect(json.error.details.reason).toBe("MISSING_IMAGE");
  });

  it("weigert een tekstveld dat zich voordoet als image", async () => {
    const response = await POST(multipart({ image: "gewoon een string" }) as never);

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { details: { reason: string } } };
    expect(json.error.details.reason).toBe("MISSING_IMAGE");
  });

  it("weigert een leeg bestand", async () => {
    const response = await POST(
      multipart({ image: file(new ArrayBuffer(0), "leeg.jpg", "image/jpeg") }) as never,
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { details: { reason: string } } };
    expect(json.error.details.reason).toBe("EMPTY_FILE");
  });

  it("weigert een niet-ondersteund mimetype", async () => {
    const response = await POST(
      multipart({ image: file(jpeg(), "doc.pdf", "application/pdf") }) as never,
    );

    expect(response.status).toBe(415);
    expect(provider.calls).toHaveLength(0);
  });

  it("weigert SVG", async () => {
    const response = await POST(multipart({ image: file(svg(), "x.svg", "image/svg+xml") }) as never);
    expect(response.status).toBe(415);
  });

  it("weigert een uitvoerbaar bestand met een .jpg-naam", async () => {
    // De client zegt image/jpeg en de naam eindigt op .jpg; alleen de bytes
    // verraden wat het is.
    const response = await POST(
      multipart({ image: file(windowsExecutable(), "ingredients.jpg", "image/jpeg") }) as never,
    );

    expect(response.status).toBe(415);
    expect(provider.calls).toHaveLength(0);
  });

  it("weigert een decompressiebom voordat de provider hem ziet", async () => {
    const response = await POST(
      multipart({
        image: file(png({ width: 50_000, height: 50_000 }), "bom.png", "image/png"),
      }) as never,
    );

    expect(response.status).toBe(413);
    // De belangrijkste assertie: er is niets naar de provider gegaan, dus ook
    // niets betaald.
    expect(provider.calls).toHaveLength(0);
  });

  it("verwerkt één afbeelding, ook als er meer velden meekomen", async () => {
    const form = new FormData();
    form.append("image", file(jpeg(), "een.jpg", "image/jpeg"));
    form.append("image2", file(jpeg(), "twee.jpg", "image/jpeg"));
    form.append("notitie", "iets anders");

    const response = await POST(new Request(ROUTE, { method: "POST", body: form }) as never);

    expect(response.status).toBe(200);
    expect(provider.calls).toHaveLength(1);
  });

  it("geeft een nette fout bij een kapotte multipart-body", async () => {
    // Een boundary die niet klopt met de inhoud: de parser struikelt hier op.
    const response = await POST(
      new Request(ROUTE, {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----kapot" },
        body: "----andere-boundary\r\nrommel zonder headers\r\n",
      }) as never,
    );

    // Geen 500 met een stacktrace maar een begrijpelijke 4xx.
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("providerfouten door de route heen", () => {
  it("vertaalt een storing naar 502 zonder providerdetails", async () => {
    setOcrProvider({
      name: "kapot",
      extractText: async () => {
        throw new AppError("PROVIDER_UNAVAILABLE", "upstream 502 van intern-endpoint-x");
      },
    });

    const response = await POST(multipart({ image: file(jpeg(), "a.jpg", "image/jpeg") }) as never);

    expect(response.status).toBe(502);
    expect(JSON.stringify(await body(response))).not.toContain("intern-endpoint-x");
  });

  it("meldt te weinig tekst met een reden waar de UI iets mee kan", async () => {
    setOcrProvider({
      name: "spy",
      extractText: async () => ({ text: "abc", providerName: "spy" }),
    });

    const response = await POST(multipart({ image: file(jpeg(), "a.jpg", "image/jpeg") }) as never);
    const json = (await response.json()) as { error: { details: { reason: string } } };

    expect(response.status).toBe(400);
    expect(json.error.details.reason).toBe("TOO_LITTLE_TEXT");
  });
});

describe("rate limiting", () => {
  it("blokkeert na de ingestelde limiet per afzender", async () => {
    const send = (): Promise<Response> => {
      const form = new FormData();
      form.append("image", file(jpeg(), "a.jpg", "image/jpeg"));
      return POST(
        new Request(ROUTE, {
          method: "POST",
          body: form,
          headers: { "x-forwarded-for": "203.0.113.9" },
        }) as never,
      );
    };

    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await send()).status);

    // Standaard staat OCR_RATE_LIMIT op 10; de elfde moet geweigerd worden.
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(statuses[11]).toBe(429);

    // En er is niet vaker betaald dan toegestaan.
    expect(provider.calls).toHaveLength(10);
  });

  it("telt afzenders apart", async () => {
    const send = (ip: string): Promise<Response> => {
      const form = new FormData();
      form.append("image", file(jpeg(), "a.jpg", "image/jpeg"));
      return POST(
        new Request(ROUTE, {
          method: "POST",
          body: form,
          headers: { "x-forwarded-for": ip },
        }) as never,
      );
    };

    for (let i = 0; i < 10; i += 1) await send("198.51.100.1");
    expect((await send("198.51.100.1")).status).toBe(429);
    // Een andere afzender heeft daar geen last van.
    expect((await send("198.51.100.2")).status).toBe(200);
  });
});
