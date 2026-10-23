import { z } from "zod";
import { BUDGETS, COUNTRIES, LISTING_TYPES } from "./format";

/** "180.000", "180 000", "180000,50" -> 180000 / 180000.5 */
export function parseAmount(input: unknown): number | undefined {
  if (input === null || input === undefined) return undefined;
  const s = String(input).trim().replace(/[€\s]/g, "");
  if (s === "") return undefined;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

const amount = (label: string, opts: { min?: number; allowNegative?: boolean } = {}) =>
  z.preprocess(
    parseAmount,
    z
      .number({ required_error: `${label} is verplicht.`, invalid_type_error: `${label} moet een bedrag zijn.` })
      .refine((n) => !Number.isNaN(n), `${label} moet een bedrag zijn.`)
      .refine((n) => opts.allowNegative || n >= (opts.min ?? 0), `${label} mag niet negatief zijn.`)
      .refine((n) => Math.abs(n) < 1e10, `${label} is te groot.`),
  );

const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || String(v).trim() === "" ? undefined : Number(String(v).trim())),
    z
      .number({ invalid_type_error: `${label} moet een getal zijn.` })
      .int(`${label} moet een geheel getal zijn.`)
      .min(min, `${label} moet minstens ${min} zijn.`)
      .max(max, `${label} mag hoogstens ${max} zijn.`)
      .optional(),
  );

const checkbox = (message: string) =>
  z.preprocess((v) => v === "on" || v === "true" || v === true, z.literal(true, { errorMap: () => ({ message }) }));

const email = z
  .string({ required_error: "E-mailadres is verplicht." })
  .trim()
  .max(254, "E-mailadres is te lang.")
  .email("Vul een geldig e-mailadres in.");

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max, `Maximaal ${max} tekens.`).optional().default(""));

export const listingSchema = z
  .object({
    title: z.string().trim().min(5, "Omschrijving: minstens 5 tekens.").max(120, "Omschrijving: maximaal 120 tekens."),
    type: z.enum(LISTING_TYPES, { errorMap: () => ({ message: "Kies een type." }) }),
    country: z.enum(COUNTRIES, { errorMap: () => ({ message: "Kies een land." }) }),
    founded_year: optionalInt("Startjaar", 1990, new Date().getFullYear()),
    asking_price: amount("Vraagprijs", { min: 1 }).refine((n) => n > 0, "Vraagprijs moet groter dan 0 zijn."),
    revenue_12m: amount("Omzet"),
    profit_12m: amount("Nettowinst", { allowNegative: true }),
    customers: optionalInt("Aantal klanten", 0, 10_000_000),
    tech_stack: optionalText(200),
    sale_reason: optionalText(300),
    description: z.string().trim().min(20, "Beschrijving: minstens 20 tekens.").max(4000, "Beschrijving: maximaal 4000 tekens."),
    contact_email: email,
    consent_accuracy: checkbox("Bevestig dat de cijfers kloppen naar je beste weten."),
    consent_publish: checkbox("Geef toestemming om de aanbieding na controle te publiceren."),
  })
  .strict();

export type ListingInput = z.infer<typeof listingSchema>;

export const interestSchema = z
  .object({
    listing_id: z.string().uuid("Onbekende aanbieding."),
    message: z.string().trim().min(10, "Schrijf minstens één zin (10 tekens).").max(2000, "Maximaal 2000 tekens."),
    contact_email: email,
    budget: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.enum(BUDGETS).optional()),
    consent_confidential: checkbox("Bevestig dat je de informatie vertrouwelijk behandelt."),
    consent_share: checkbox("Geef toestemming om je bericht door te geven aan de verkoper."),
  })
  .strict();

export type InterestInput = z.infer<typeof interestSchema>;

export const loginSchema = z.object({ email, next: z.string().optional() });

export function formToObject(form: FormData, keys: readonly string[]): Record<string, FormDataEntryValue | undefined> {
  const out: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of keys) {
    const v = form.get(k);
    out[k] = v === null ? undefined : v;
  }
  return out;
}

export type FieldErrors = Record<string, string>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const LISTING_KEYS = [
  "title", "type", "country", "founded_year", "asking_price", "revenue_12m", "profit_12m",
  "customers", "tech_stack", "sale_reason", "description", "contact_email", "consent_accuracy", "consent_publish",
] as const;

export const INTEREST_KEYS = ["listing_id", "message", "contact_email", "budget", "consent_confidential", "consent_share"] as const;
