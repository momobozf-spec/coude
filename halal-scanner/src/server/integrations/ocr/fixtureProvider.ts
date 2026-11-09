/**
 * OCR-provider zonder externe dienst.
 *
 * Deze bestaat om twee redenen die allebei blijven gelden zodra er een echte
 * provider is:
 *
 *  1. De hele flow — foto kiezen, tekst herkennen, corrigeren, analyseren —
 *     werkt en is te testen zonder API-sleutel, zonder netwerk en zonder kosten.
 *  2. De tests zijn deterministisch. Een echte OCR-dienst geeft bij dezelfde
 *     foto niet gegarandeerd dezelfde tekst; daar kun je geen assertie op
 *     bouwen.
 *
 * Wat hij NIET is: een simulatie van OCR-kwaliteit. Hij leest de afbeelding niet
 * en doet geen enkele poging tot herkenning. Hij geeft een vast scenario terug.
 * Alles wat deze provider "kan", is dus per definitie niet bewezen voor een
 * echte provider.
 *
 * Het scenario kwam eerder uit de bestandsnaam. Dat is eruit gehaald: daarvoor
 * moest de bestandsnaam door de service heen worden gesleept, en foto's op een
 * telefoon heten naar tijdstip en soms naar locatie. Nu kiest `OCR_FIXTURE_SCENARIO`
 * (development) of de constructor (tests) het scenario, en komt de bestandsnaam
 * nergens voorbij de routegrens.
 */
import { AppError } from "@/lib/errors";
import type { OcrConfidencePolicy, OcrInput, OcrProvider, OcrResult } from "./types";

export type FixtureScenario =
  | "clear"
  | "low-confidence"
  | "no-text"
  | "not-an-ingredient-list"
  | "provider-error";

const SCENARIOS: Record<Exclude<FixtureScenario, "provider-error">, OcrResult> = {
  clear: {
    text: "INGREDIENTS: Sugar, cocoa butter,\nMILK powder, emulsifier (E322),\nnatural flavouring.",
    confidence: 0.94,
    providerName: "fixture",
    providerModel: "fixture@1",
  },
  "low-confidence": {
    // Met opzet een verkeerd gelezen woord erin: "geiatine" in plaats van
    // "gelatine". Dat is precies wat de gebruiker moet kunnen corrigeren.
    text: "Ingrediënten: suiker, geiatine, aroma, emulgator E471",
    confidence: 0.42,
    warnings: ["De afbeelding is onscherp; delen van de tekst zijn mogelijk verkeerd gelezen."],
    providerName: "fixture",
    providerModel: "fixture@1",
  },
  "no-text": {
    text: "",
    confidence: 0,
    providerName: "fixture",
    providerModel: "fixture@1",
  },
  "not-an-ingredient-list": {
    text: "Chocolade Deluxe",
    confidence: 0.88,
    providerName: "fixture",
    providerModel: "fixture@1",
  },
};

export interface FixtureOcrProviderOptions {
  /** Welk scenario deze instantie teruggeeft. Standaard het normale geval. */
  scenario?: FixtureScenario;
  /** Kunstmatige vertraging, zodat laadtoestanden in de UI zichtbaar zijn. */
  delayMs?: number;
}

export class FixtureOcrProvider implements OcrProvider {
  readonly name = "fixture";

  /**
   * De fixture geeft zelfverzonnen getallen terug, dus deze drempel is niets
   * meer dan de standaard. Bij een echte provider hoort hier een waarde te
   * staan met een bron erbij — zie `docs/OCR-PROVIDERS.md`.
   */
  readonly confidencePolicy: OcrConfidencePolicy = { kind: "threshold", lowBelow: 0.7 };

  constructor(private readonly options: FixtureOcrProviderOptions = {}) {}

  async extractText(input: OcrInput): Promise<OcrResult> {
    if (this.options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }

    // Een echte provider hoort hier zijn HTTP-call af te breken; de fixture kan
    // alleen controleren of het signaal al gezet is.
    if (input.signal?.aborted) {
      throw new AppError("PROVIDER_TIMEOUT", "De tekstherkenning is afgebroken.");
    }

    const scenario = this.options.scenario ?? "clear";

    if (scenario === "provider-error") {
      throw new AppError("PROVIDER_UNAVAILABLE", "De tekstherkenning is tijdelijk niet bereikbaar.");
    }

    return SCENARIOS[scenario];
  }
}
