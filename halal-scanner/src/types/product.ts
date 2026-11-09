/**
 * Domeintypes voor productdata en de normalisatie van externe bronnen.
 */
import type { ExternalSource } from "@prisma/client";

export type { ExternalSource };

/** Een ingredient zoals geparsed uit een ruwe ingredientenlijst. */
export interface ParsedIngredient {
  /** Exact zoals op het etiket. */
  rawName: string;
  /** Genormaliseerde matchingsleutel. */
  normalizedName: string;
  /** 0-based positie; etiketten staan gesorteerd op afnemend gewicht. */
  position: number;
  /** Bv. "22%", indien vermeld. */
  quantityText: string | null;
  /** E-nummer dat in deze regel herkend is, in canonieke vorm ("E471"). */
  eNumberCode: string | null;
}

/**
 * Genormaliseerde vorm van een extern product. Elke externe bron (Open Food
 * Facts vandaag, mogelijk andere morgen) wordt hiernaartoe vertaald voordat er
 * ook maar iets in de database belandt.
 */
export interface ExternalProductData {
  barcode: string;
  name?: string;
  brand?: string;
  imageUrl?: string;
  ingredientsText?: string;
  ingredientsLang?: string;
  ingredients?: ParsedIngredient[];
  categories?: string[];
  labels?: string[];
  countries?: string[];
  allergens?: string[];
  externalSource: ExternalSource;
  externalId?: string;
  /** Wanneer de externe bron dit product voor het laatst wijzigde. */
  externalUpdatedAt?: Date;
}

/**
 * Velden waarvan een externe provider de eigenaar is. Alleen deze worden door
 * een synchronisatie aangeraakt; al het andere (halal-status, certificaten,
 * reviews, favorieten, analyses) blijft van ons.
 *
 * Deze lijst is de enige plek waar dat eigenaarschap wordt vastgelegd -
 * ProductSyncService leest hem, en de tests controleren hem.
 */
export const EXTERNALLY_MANAGED_FIELDS = [
  "name",
  "brandName",
  "imageUrl",
  "ingredientsRaw",
  "ingredientsLang",
  "categories",
  "labels",
  "countries",
  "allergens",
  "externalId",
  "externalUpdatedAt",
] as const;

export type ExternallyManagedField = (typeof EXTERNALLY_MANAGED_FIELDS)[number];
