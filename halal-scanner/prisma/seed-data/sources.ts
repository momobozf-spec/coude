import type { SourceType } from "@prisma/client";

/**
 * Bronnen die daadwerkelijk bestaan en verifieerbaar zijn.
 *
 * Belangrijk: hier staan GEEN religieuze uitspraken namens deze organisaties.
 * De EU-verordening en EFSA beschrijven wat een additief chemisch is en welke
 * grondstofroutes bestaan - niet of iets halal is. De halal-interpretatie in
 * deze seed komt uit `INTERNAL_RULE` en is expliciet als zodanig gemarkeerd.
 */
export interface SeedSource {
  key: string;
  name: string;
  organization: string;
  url: string | null;
  country: string | null;
  sourceType: SourceType;
  description: string;
}

export const SOURCE_KEYS = {
  OPEN_FOOD_FACTS: "open-food-facts",
  EU_1333_2008: "eu-reg-1333-2008",
  EFSA_ADDITIVES: "efsa-food-additives",
  INTERNAL_RULES: "internal-ruleset",
} as const;

export const seedSources: SeedSource[] = [
  {
    key: SOURCE_KEYS.OPEN_FOOD_FACTS,
    name: "Open Food Facts",
    organization: "Open Food Facts",
    url: "https://world.openfoodfacts.org",
    country: null,
    sourceType: "FOOD_DATABASE",
    description:
      "Open, door de gemeenschap onderhouden productdatabase. Levert productnaam, merk, afbeelding en ingrediententekst. Zegt niets over halal-status.",
  },
  {
    key: SOURCE_KEYS.EU_1333_2008,
    name: "Verordening (EG) nr. 1333/2008 inzake levensmiddelenadditieven",
    organization: "Europese Unie",
    url: "https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32008R1333",
    country: "EU",
    sourceType: "SCIENTIFIC_REFERENCE",
    description:
      "Wettelijke lijst van toegelaten levensmiddelenadditieven en hun E-nummers. Gebruikt als referentie voor code en naamgeving, niet voor halal-beoordeling.",
  },
  {
    key: SOURCE_KEYS.EFSA_ADDITIVES,
    name: "EFSA - Food additives",
    organization: "European Food Safety Authority",
    url: "https://www.efsa.europa.eu/en/topics/topic/food-additives",
    country: "EU",
    sourceType: "SCIENTIFIC_REFERENCE",
    description:
      "Wetenschappelijke evaluaties van additieven, inclusief beschrijving van productieprocessen en mogelijke grondstoffen. Gebruikt om te onderbouwen dat een additief plantaardig, dierlijk of synthetisch kan zijn.",
  },
  {
    key: SOURCE_KEYS.INTERNAL_RULES,
    name: "Halal Scanner interne regelset",
    organization: "Halal Scanner",
    url: null,
    country: null,
    sourceType: "INTERNAL_RULE",
    description:
      "Conservatieve, eigen heuristiek van deze applicatie. Wanneer de herkomst van een ingredient onbekend kan zijn, wordt MUSHBOOH toegekend in plaats van een positieve uitspraak. Dit is geen uitspraak van een religieuze autoriteit.",
  },
];
