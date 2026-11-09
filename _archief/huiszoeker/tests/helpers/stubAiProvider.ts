/**
 * Stub-AI-provider.
 *
 * Geen enkele test doet een echte aanroep naar Anthropic of OpenAI. Deze stub
 * legt de *ruwe* modeloutput vast — inclusief de slordigheden die een model
 * werkelijk produceert, zoals "450k" of "GARDEN" — en laat hem door precies
 * dezelfde normalisatie- en validatieketen lopen als in productie.
 *
 * Wat de tests daarmee aantonen: dat onze keten die output correct opschoont,
 * valideert en verzonnen velden weigert. Wat ze níet aantonen is dat het model
 * de goede JSON produceert; dat is een eigenschap van het model en hoort in een
 * evaluatie tegen de echte API, niet in een unittest.
 */
import type { AiProvider, StructuredRequest, TextRequest } from "../../src/types/ai.js";
import { AiParseError } from "../../src/lib/errors.js";

export class StubAiProvider implements AiProvider {
  readonly name = "anthropic" as const;
  /** Ruwe antwoorden, in volgorde. De laatste wordt herhaald bij retries. */
  private readonly responses: unknown[];
  readonly calls: { system: string; user: string }[] = [];
  private index = 0;

  constructor(...responses: unknown[]) {
    this.responses = responses;
  }

  complete<T>(req: StructuredRequest<T>): Promise<T> {
    this.calls.push({ system: req.system, user: req.user });

    const raw = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;

    // Exact dezelfde volgorde als in de echte providers.
    const normalized = req.normalize ? req.normalize(raw) : raw;
    const result = req.schema.safeParse(normalized);
    if (!result.success) {
      return Promise.reject(
        new AiParseError("De output van het model voldeed niet aan het schema", {
          issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        }),
      );
    }
    return Promise.resolve(result.data);
  }

  completeText(_req: TextRequest): Promise<string> {
    return Promise.resolve("stub");
  }
}

/** Provider die altijd faalt; voor de foutpaden. */
export class FailingAiProvider implements AiProvider {
  readonly name = "anthropic" as const;
  constructor(private readonly error: Error) {}
  complete<T>(): Promise<T> {
    return Promise.reject(this.error);
  }
  completeText(): Promise<string> {
    return Promise.reject(this.error);
  }
}
