import { z } from "zod";

/** Zod-schema's voor de product-endpoints. Alle input passeert hier. */

export const barcodeParamSchema = z.object({
  // Alleen grofmazig: de echte validatie (lengte, checksum) doet
  // validateBarcode(), zodat de gebruiker een specifieke foutreden krijgt.
  barcode: z.string().min(1).max(32),
});

export const productSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Geef minstens twee tekens op om te zoeken.")
    .max(120, "De zoekterm is te lang."),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  /**
   * Voorbereid maar nog niet actief: externe zoekintegratie komt later. Nu
   * afwijzen is eerlijker dan stilzwijgend negeren.
   */
  includeExternal: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const productIdParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export const refreshBodySchema = z
  .object({
    force: z.boolean().default(true),
  })
  .default({ force: true });

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
