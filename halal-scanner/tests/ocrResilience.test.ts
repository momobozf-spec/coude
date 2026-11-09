import { describe, expect, it, vi } from "vitest";
import {
  callProviderWithResilience,
  isTransientProviderError,
} from "@/server/integrations/ocr/resilience";
import { AppError } from "@/lib/errors";
import type { OcrProvider, OcrResult } from "@/server/integrations/ocr/types";
import { jpeg } from "./helpers/imageBytes";

/**
 * Timeout- en retrygedrag, zonder echt te wachten.
 *
 * `sleep` wordt geïnjecteerd zodat de backoff meetbaar is in plaats van traag:
 * de test controleert wélke wachttijden gekozen zijn, niet dat de suite een
 * seconde stilstaat.
 */

const INPUT = { image: jpeg(), mimeType: "image/jpeg" };

function provider(extractText: OcrProvider["extractText"]): OcrProvider {
  return { name: "test", extractText };
}

function ok(text = "suiker, cacao"): OcrResult {
  return { text, providerName: "test" };
}

/** Verzamelt de gekozen wachttijden en keert onmiddellijk terug. */
function fakeSleep(): { delays: number[]; sleep: (ms: number) => Promise<void> } {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms) => {
      delays.push(ms);
    },
  };
}

describe("welke fouten tijdelijk zijn", () => {
  it("rekent timeout, 5xx en 429 als tijdelijk", () => {
    for (const code of ["PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE", "PROVIDER_RATE_LIMITED"] as const) {
      expect(isTransientProviderError(new AppError(code, "…"))).toBe(true);
    }
  });

  it("rekent invoerfouten niet als tijdelijk", () => {
    for (const code of ["VALIDATION_ERROR", "UNSUPPORTED_MEDIA_TYPE", "PAYLOAD_TOO_LARGE"] as const) {
      expect(isTransientProviderError(new AppError(code, "…"))).toBe(false);
    }
    expect(isTransientProviderError(new Error("gewone fout"))).toBe(false);
  });
});

describe("timeout", () => {
  it("breekt af wanneer de provider blijft hangen", async () => {
    const hanging = provider(() => new Promise(() => {}));

    await expect(
      callProviderWithResilience(hanging, INPUT, { timeoutMs: 5, maxRetries: 0 }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("geeft de provider een abort-signaal mee", async () => {
    // Zodat een echte implementatie zijn HTTP-call kan annuleren en de aanroep
    // niet op de achtergrond doorloopt en alsnog geld kost.
    let seen: AbortSignal | undefined;
    const spy = provider(async (input) => {
      seen = input.signal;
      return ok();
    });

    await callProviderWithResilience(spy, INPUT, { timeoutMs: 1000, maxRetries: 0 });

    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen?.aborted).toBe(false);
  });

  it("zet het abort-signaal wanneer de tijd om is", async () => {
    let seen: AbortSignal | undefined;
    const hanging = provider((input) => {
      seen = input.signal;
      return new Promise(() => {});
    });

    await expect(
      callProviderWithResilience(hanging, INPUT, { timeoutMs: 5, maxRetries: 0 }),
    ).rejects.toThrowError(AppError);

    expect(seen?.aborted).toBe(true);
  });

  it("laat een snel antwoord gewoon door", async () => {
    const fast = provider(async () => ok("suiker, cacaoboter"));
    const result = await callProviderWithResilience(fast, INPUT, {
      timeoutMs: 1000,
      maxRetries: 0,
    });
    expect(result.text).toBe("suiker, cacaoboter");
  });
});

describe("herpogingen", () => {
  it("probeert opnieuw na een tijdelijke storing en slaagt alsnog", async () => {
    let calls = 0;
    const flaky = provider(async () => {
      calls += 1;
      if (calls === 1) throw new AppError("PROVIDER_UNAVAILABLE", "502");
      return ok();
    });

    const { sleep, delays } = fakeSleep();
    const result = await callProviderWithResilience(flaky, INPUT, {
      timeoutMs: 1000,
      maxRetries: 1,
      sleep,
    });

    expect(result.text).toBe("suiker, cacao");
    expect(calls).toBe(2);
    expect(delays).toEqual([500]);
  });

  it("probeert opnieuw bij 429", async () => {
    let calls = 0;
    const limited = provider(async () => {
      calls += 1;
      if (calls < 3) throw new AppError("PROVIDER_RATE_LIMITED", "429");
      return ok();
    });

    const { sleep, delays } = fakeSleep();
    await callProviderWithResilience(limited, INPUT, {
      timeoutMs: 1000,
      maxRetries: 2,
      sleep,
    });

    expect(calls).toBe(3);
    // Begrensde exponentiële backoff: 500, dan 1000.
    expect(delays).toEqual([500, 1000]);
  });

  it("probeert NIET opnieuw bij een invoerfout", async () => {
    // Dit is de regel die bij "even een retry eromheen" als eerste sneuvelt:
    // een afgekeurd bestand wordt niet beter door het nog eens te sturen, en
    // bij een betaalde provider kost elke poging opnieuw geld.
    const rejecting = vi.fn(async () => {
      throw new AppError("UNSUPPORTED_MEDIA_TYPE", "geen afbeelding");
    });

    await expect(
      callProviderWithResilience(provider(rejecting), INPUT, {
        timeoutMs: 1000,
        maxRetries: 3,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    expect(rejecting).toHaveBeenCalledTimes(1);
  });

  it("probeert NIET opnieuw bij een gewone fout van onbekende herkomst", async () => {
    const broken = vi.fn(async () => {
      throw new TypeError("undefined is not a function");
    });

    await expect(
      callProviderWithResilience(provider(broken), INPUT, {
        timeoutMs: 1000,
        maxRetries: 3,
        sleep: async () => {},
      }),
    ).rejects.toThrowError(TypeError);

    expect(broken).toHaveBeenCalledTimes(1);
  });

  it("houdt op na het maximum en geeft de laatste fout door", async () => {
    const down = vi.fn(async () => {
      throw new AppError("PROVIDER_UNAVAILABLE", "503");
    });

    await expect(
      callProviderWithResilience(provider(down), INPUT, {
        timeoutMs: 1000,
        maxRetries: 2,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    // Eerste poging plus twee herpogingen.
    expect(down).toHaveBeenCalledTimes(3);
  });

  it("doet met maxRetries 0 precies één poging", async () => {
    const down = vi.fn(async () => {
      throw new AppError("PROVIDER_TIMEOUT", "traag");
    });

    await expect(
      callProviderWithResilience(provider(down), INPUT, { timeoutMs: 1000, maxRetries: 0 }),
    ).rejects.toThrowError(AppError);

    expect(down).toHaveBeenCalledTimes(1);
  });

  it("meldt elke herpoging zonder beeld of tekst mee te geven", async () => {
    let calls = 0;
    const flaky = provider(async () => {
      calls += 1;
      if (calls === 1) throw new AppError("PROVIDER_TIMEOUT", "traag");
      return ok();
    });

    const seen: Array<{ attempt: number; code: string; delayMs: number }> = [];
    await callProviderWithResilience(flaky, INPUT, {
      timeoutMs: 1000,
      maxRetries: 1,
      sleep: async () => {},
      onRetry: (info) => seen.push(info),
    });

    expect(seen).toEqual([{ attempt: 1, code: "PROVIDER_TIMEOUT", delayMs: 500 }]);
    // De vorm van het object is de garantie: er is geen veld waar beeld of
    // tekst in zou kunnen zitten.
    expect(Object.keys(seen[0]!).sort()).toEqual(["attempt", "code", "delayMs"]);
  });
});
