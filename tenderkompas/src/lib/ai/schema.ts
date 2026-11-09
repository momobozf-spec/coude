import { z } from "zod/v4";

export const EXTRACTION_SCHEMA_VERSION = "2026-10-23.1";

const evidence = z.object({
  document_id: z.string().describe("ID van het document waaruit het bewijs komt, exact zoals opgegeven"),
  page: z.number().int().nullable().describe("Paginanummer (1-gebaseerd) of null als onbekend"),
  section: z.string().nullable().describe("Sectie- of paragraafaanduiding indien zichtbaar"),
  quote: z.string().describe("LETTERLIJK citaat uit het document (max ~300 tekens) dat de waarde onderbouwt"),
});

export const extractionOutputSchema = z.object({
  source_language: z.string().describe("Taal van de brondocumenten: nl, fr, en of de"),
  summary_nl: z.string().describe("Neutrale Nederlandstalige samenvatting van de gevraagde dienstverlening (max 8 zinnen). Geen beoordeling."),
  summary_is_translation: z.boolean(),
  lots: z.array(z.object({ lot_key: z.string(), title: z.string().nullable(), description: z.string().nullable() })),
  facts: z.array(
    z.object({
      key: z.enum([
        "submission_deadline",
        "participation_deadline",
        "questions_deadline",
        "estimated_value",
        "framework_max_value",
        "lot_value",
        "published_budget",
        "contract_duration",
      ]),
      lot_key: z.string().nullable(),
      raw_value: z.string().describe("Waarde exact zoals in de bron, inclusief eenheid/tijdzone als vermeld"),
      value_number: z.number().nullable().describe("Enkel bij bedragen/duur: het getal uit de bron, anders null"),
      unit: z.string().nullable(),
      evidence,
    }),
  ),
  requirements: z.array(
    z.object({
      kind: z.enum(["exclusion", "selection", "award_criterion", "other"]),
      category: z.enum(["reference", "certification", "financial", "language", "security_clearance", "staffing", "legal", "other"]),
      lot_key: z.string().nullable(),
      text: z.string().describe("De eis in de oorspronkelijke taal, zo letterlijk mogelijk"),
      mandatory: z.boolean().nullable().describe("true als expliciet verplicht/minimumeis; null als onduidelijk"),
      weight: z.string().nullable().describe("Gewicht bij gunningscriteria zoals gepubliceerd"),
      consortium: z.enum(["documented", "not_allowed", "unknown"]).describe("documented = bron staat combinatie/beroep op derden expliciet toe"),
      consortium_quote: z.string().nullable(),
      evidence,
    }),
  ),
  missing: z.array(z.string()).describe("Gegevens die in de documenten ontbreken of onduidelijk zijn"),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
