/**
 * Request- en responseschema's voor de REST API.
 *
 * Elke route valideert zijn invoer hiermee vóór de service wordt aangeroepen.
 * De services valideren daarna nóg een keer wat ze zelf nodig hebben — dat is
 * geen dubbel werk maar een bewuste keuze: de CLI en de scheduler roepen
 * dezelfde services aan zonder door deze schema's te gaan.
 */
import { z } from "zod";
import { searchCriteriaSchema } from "./searchCriteria.js";

export const searchFrequencySchema = z.enum(["HOURLY", "EVERY_6_HOURS", "DAILY"]);

export const parseSearchBodySchema = z
  .object({
    query: z.string().trim().min(3).max(2000),
  })
  .strict();

export const createSearchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    query: z.string().trim().min(3).max(2000).optional(),
    criteria: searchCriteriaSchema.optional(),
    frequency: searchFrequencySchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.query !== undefined || b.criteria !== undefined, {
    message: "Geef 'query' (vrije tekst) of 'criteria' (gestructureerd) mee",
    path: ["query"],
  });

export const updateSearchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    query: z.string().trim().min(3).max(2000).optional(),
    criteria: searchCriteriaSchema.optional(),
    frequency: searchFrequencySchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Geef minstens één veld om te wijzigen" });

export const idParamSchema = z.object({ id: z.string().min(1).max(64) }).strict();

export const listQuerySchema = z
  .object({
    active: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const runQuerySchema = z
  .object({
    force: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .default(false),
  })
  .strict();

export type ParseSearchBody = z.infer<typeof parseSearchBodySchema>;
export type CreateSearchBody = z.infer<typeof createSearchBodySchema>;
export type UpdateSearchBody = z.infer<typeof updateSearchBodySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type RunQuery = z.infer<typeof runQuerySchema>;
