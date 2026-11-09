/**
 * Welke OCR-provider draait.
 *
 * Vandaag is er één: de fixture-provider. Dat is een bewuste keuze en geen
 * gebrek — de flow moet volledig werken zonder externe dienst, zodat er geen
 * sleutel nodig is om de app te bouwen, te testen of te demonstreren.
 *
 * EEN ECHTE PROVIDER TOEVOEGEN is één bestand plus één regel hieronder:
 *
 *   1. Maak `openAiVisionProvider.ts` (of azure/google/textract) die
 *      `OcrProvider` implementeert. Daarin, en alleen daarin, staan de
 *      providerspecifieke types en de vertaling van providerfouten naar onze
 *      `AppError`-codes.
 *   2. Voeg hem toe aan de switch hieronder.
 *
 * Er verandert dan niets aan de UI, de state machine, de normalisatie of de
 * analyse. Dat is het hele punt van deze indirectie.
 *
 * WAAR DE AFBEELDING NAARTOE GAAT zodra dat gebeurt: de bytes verlaten dan de
 * server richting die provider. Dat is een privacybeslissing, geen technische —
 * zie de opmerking in `ocrService.ts` en documenteer het in de privacyverklaring
 * voordat een externe provider aangezet wordt.
 */
import { serverEnv } from "@/config/env";
import { FixtureOcrProvider } from "./fixtureProvider";
import type { OcrProvider } from "./types";

let cached: OcrProvider | undefined;

export function getOcrProvider(): OcrProvider {
  cached ??= createOcrProvider();
  return cached;
}

function createOcrProvider(): OcrProvider {
  const env = serverEnv();

  switch (env.OCR_PROVIDER) {
    // case "openai": return new OpenAiVisionProvider(env.OPENAI_API_KEY!, env.OPENAI_MODEL);
    // case "azure":  return new AzureVisionProvider(...);
    case "fixture":
    default:
      return new FixtureOcrProvider({
        scenario: env.OCR_FIXTURE_SCENARIO,
        delayMs: env.NODE_ENV === "development" ? 400 : 0,
      });
  }
}

/** Alleen voor tests. */
export function setOcrProvider(provider: OcrProvider | undefined): void {
  cached = provider;
}

export type {
  OcrConfidencePolicy,
  OcrInput,
  OcrProvenance,
  OcrProvider,
  OcrResult,
} from "./types";
export {
  DEFAULT_LOW_CONFIDENCE_THRESHOLD,
  isLowConfidence,
  MIN_USABLE_TEXT_LENGTH,
} from "./types";
